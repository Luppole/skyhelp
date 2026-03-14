import re
import struct
import asyncio
import gzip
import base64
import io
from fastapi import APIRouter, HTTPException, Request, Header
from typing import Optional

from ..utils.hypixel import (
    get_player_uuid, get_player_data,
    get_skyblock_profiles, get_skyblock_profile,
    get_player_auctions, get_profile_auctions,
    get_server_api_key,
)
from ..utils.calculators import analyze_profile
from ..limiter import limiter

router = APIRouter(prefix="/player", tags=["player"])

_COLOR_STRIP = re.compile(r'§.')

# ── Minimal binary NBT parser (no external dependency) ────────────────────────
# Only parses what Hypixel inventory NBT needs; skips over everything else.

_TAG_END        = 0
_TAG_BYTE       = 1
_TAG_SHORT      = 2
_TAG_INT        = 3
_TAG_LONG       = 4
_TAG_FLOAT      = 5
_TAG_DOUBLE     = 6
_TAG_BYTE_ARRAY = 7
_TAG_STRING     = 8
_TAG_LIST       = 9
_TAG_COMPOUND   = 10
_TAG_INT_ARRAY  = 11
_TAG_LONG_ARRAY = 12

_SCALAR_SIZES = {
    _TAG_BYTE: 1, _TAG_SHORT: 2, _TAG_INT: 4,
    _TAG_LONG: 8, _TAG_FLOAT: 4, _TAG_DOUBLE: 8,
}


def _nbt_read(buf: memoryview, pos: int, tag: int):
    """Read a single NBT payload (no name) starting at buf[pos].
    Returns (value, new_pos). Raises struct.error on truncated data.
    Compounds are returned as dicts; lists as Python lists.
    Strings and scalars as Python native types.
    Byte/Int/Long arrays returned as None (we skip them).
    """
    if tag in _SCALAR_SIZES:
        sz = _SCALAR_SIZES[tag]
        val = int.from_bytes(buf[pos:pos + sz], 'big', signed=True)
        return val, pos + sz

    if tag == _TAG_STRING:
        slen = struct.unpack_from('>H', buf, pos)[0]
        pos += 2
        return bytes(buf[pos:pos + slen]).decode('utf-8', errors='replace'), pos + slen

    if tag == _TAG_BYTE_ARRAY:
        alen = struct.unpack_from('>i', buf, pos)[0]
        return None, pos + 4 + alen

    if tag == _TAG_INT_ARRAY:
        alen = struct.unpack_from('>i', buf, pos)[0]
        return None, pos + 4 + alen * 4

    if tag == _TAG_LONG_ARRAY:
        alen = struct.unpack_from('>i', buf, pos)[0]
        return None, pos + 4 + alen * 8

    if tag == _TAG_LIST:
        elem_tag = buf[pos]; pos += 1
        count    = struct.unpack_from('>i', buf, pos)[0]; pos += 4
        result   = []
        for _ in range(count):
            val, pos = _nbt_read(buf, pos, elem_tag)
            result.append(val)
        return result, pos

    if tag == _TAG_COMPOUND:
        result = {}
        while True:
            child_tag = buf[pos]; pos += 1
            if child_tag == _TAG_END:
                break
            nlen = struct.unpack_from('>H', buf, pos)[0]; pos += 2
            name = bytes(buf[pos:pos + nlen]).decode('utf-8', errors='replace'); pos += nlen
            val, pos = _nbt_read(buf, pos, child_tag)
            result[name] = val
        return result, pos

    # Unknown tag — we can't safely skip, so raise to abort
    raise ValueError(f"Unknown NBT tag {tag}")


def _parse_nbt_inventory(data: bytes) -> list:
    """Parse raw (decompressed) Hypixel inventory NBT.
    Returns the list stored under the root compound's 'i' key, or [].
    """
    if not data:
        return []
    buf = memoryview(data)
    root_tag = buf[0]
    if root_tag != _TAG_COMPOUND:
        return []
    # Skip root name
    pos = 1
    nlen = struct.unpack_from('>H', buf, pos)[0]; pos += 2 + nlen
    root, _ = _nbt_read(buf, pos, _TAG_COMPOUND)
    return root.get("i", [])


def _decode_inventory(data_b64: str) -> list[dict]:
    """Decode a base64-gzipped Hypixel NBT inventory blob → list[{id, count, name}]."""
    if not data_b64:
        return []
    try:
        raw = base64.b64decode(data_b64)
        try:
            raw = gzip.decompress(raw)
        except Exception:
            pass  # already uncompressed
        items = []
        for item in _parse_nbt_inventory(raw):
            if not isinstance(item, dict):
                continue
            tag   = item.get("tag")
            if not isinstance(tag, dict):
                continue
            extra   = tag.get("ExtraAttributes") or {}
            item_id = str(extra.get("id", "") or "").strip()
            if not item_id:
                continue
            count      = int(item.get("Count", 1) or 1)
            display    = tag.get("display") or {}
            raw_name   = str(display.get("Name", "") or "")
            clean_name = _COLOR_STRIP.sub("", raw_name).strip() or None
            items.append({"id": item_id, "count": count, "name": clean_name})
        return items
    except Exception:
        return []


# ── Known approximate market values ──────────────────────────────────────────
_KNOWN_VALUES: dict[str, float] = {
    # Swords / Melee
    "ASPECT_OF_THE_DRAGONS":    3_500_000,
    "SHADOW_FURY":             12_000_000,
    "HYPERION":               700_000_000,
    "SCYLLA":                 400_000_000,
    "VALKYRIE":               300_000_000,
    "TERMINATOR":             550_000_000,
    "NECRON_BLADE":           200_000_000,
    "LIVID_DAGGER":             8_000_000,
    "PIGMAN_SWORD":             2_500_000,
    "ASPECT_OF_THE_END":          600_000,
    "GIANTS_SWORD":            15_000_000,
    "FLOWER_OF_TRUTH":          5_000_000,
    "ATOMSPLIT_KATANA":        25_000_000,
    "VORPAL_KATANA":            8_000_000,
    "LAST_BREATH":             50_000_000,
    "REAPER_SCYTHE":          100_000_000,
    "MIDAS_SWORD":            200_000_000,
    "MIDAS_STAFF":            120_000_000,
    "DREADLORD_SWORD":            500_000,
    "ZOMBIE_SWORD":               800_000,
    "SHREDDER":                 1_000_000,
    "SOUL_WHIP":                3_000_000,
    # Bows
    "JUJU_SHORTBOW":           50_000_000,
    "HURRICANE_BOW":            2_000_000,
    # Wand / staff
    "WAND_OF_RESTORATION":        800_000,
    "WAND_OF_HEALING":            300_000,
    # Necron armour
    "NECRON_HANDLE":           10_000_000,
    "WITHER_HELMET":            5_000_000,
    "WITHER_CHESTPLATE":        8_000_000,
    "WITHER_LEGGINGS":          6_000_000,
    "WITHER_BOOTS":             5_000_000,
    "NECRON_HELMET":           25_000_000,
    "NECRON_CHESTPLATE":       40_000_000,
    "NECRON_LEGGINGS":         30_000_000,
    "NECRON_BOOTS":            20_000_000,
    # Storm armour
    "STORM_HELMET":            15_000_000,
    "STORM_CHESTPLATE":        25_000_000,
    "STORM_LEGGINGS":          18_000_000,
    "STORM_BOOTS":             12_000_000,
    # Goldor armour
    "GOLDOR_HELMET":            8_000_000,
    "GOLDOR_CHESTPLATE":       12_000_000,
    "GOLDOR_LEGGINGS":         10_000_000,
    "GOLDOR_BOOTS":             7_000_000,
    # Dragon armours
    "SUPERIOR_DRAGON_HELMET":       3_000_000,
    "SUPERIOR_DRAGON_CHESTPLATE":   5_000_000,
    "SUPERIOR_DRAGON_LEGGINGS":     4_000_000,
    "SUPERIOR_DRAGON_BOOTS":        3_000_000,
    "STRONG_DRAGON_HELMET":         1_000_000,
    "STRONG_DRAGON_CHESTPLATE":     2_000_000,
    "STRONG_DRAGON_LEGGINGS":       1_500_000,
    "STRONG_DRAGON_BOOTS":          1_000_000,
    "YOUNG_DRAGON_HELMET":          2_000_000,
    "YOUNG_DRAGON_CHESTPLATE":      3_500_000,
    "YOUNG_DRAGON_LEGGINGS":        2_500_000,
    "YOUNG_DRAGON_BOOTS":           2_000_000,
    "WISE_DRAGON_HELMET":           1_500_000,
    "WISE_DRAGON_CHESTPLATE":       3_000_000,
    "WISE_DRAGON_LEGGINGS":         2_000_000,
    "WISE_DRAGON_BOOTS":            1_500_000,
    "UNSTABLE_DRAGON_HELMET":         600_000,
    "UNSTABLE_DRAGON_CHESTPLATE":   1_000_000,
    "UNSTABLE_DRAGON_LEGGINGS":       800_000,
    "UNSTABLE_DRAGON_BOOTS":          600_000,
    "OLD_DRAGON_HELMET":              800_000,
    "OLD_DRAGON_CHESTPLATE":        1_500_000,
    "OLD_DRAGON_LEGGINGS":          1_200_000,
    "OLD_DRAGON_BOOTS":               800_000,
    "PROTECTOR_DRAGON_HELMET":        400_000,
    "PROTECTOR_DRAGON_CHESTPLATE":    700_000,
    "PROTECTOR_DRAGON_LEGGINGS":      500_000,
    "PROTECTOR_DRAGON_BOOTS":         400_000,
    # Slayer armours
    "ENDER_HELMET":             3_000_000,
    "ENDER_CHESTPLATE":         5_000_000,
    "ENDER_LEGGINGS":           4_000_000,
    "ENDER_BOOTS":              3_000_000,
    "BLAZE_HELMET":             2_000_000,
    "BLAZE_CHESTPLATE":         3_000_000,
    "BLAZE_LEGGINGS":           2_500_000,
    "BLAZE_BOOTS":              2_000_000,
    # Accessories
    "RECOMBOBULATOR_3000":     15_000_000,
    "HEGEMONY_ARTIFACT":      200_000_000,
    "WITHER_ARTIFACT":         50_000_000,
    "WITHER_RELIC":            80_000_000,
    "WITHER_SHIELD":           15_000_000,
    "MANA_FLUX":               10_000_000,
    "OVERFLUX_CAPACITOR":      25_000_000,
    "PLASMA_BUCKET":          100_000_000,
    "ENDER_RELIC":             30_000_000,
    "ABICASE":                 50_000_000,
    "STONKS_TALISMAN":          3_000_000,
    "MASTER_SKULL_TIER_7":    200_000_000,
    # Special
    "GOLDEN_TALISMAN":         50_000_000,
    "DUNGEON_CHEST_KEY":          200_000,
    "NEW_YEAR_CAKE":            5_000_000,
}

# ── Pet values ────────────────────────────────────────────────────────────────
PET_BASE_VALUES: dict[str, dict[str, float]] = {
    "TIGER":         {"COMMON": 100_000, "UNCOMMON": 500_000, "RARE": 2_000_000, "EPIC": 8_000_000,   "LEGENDARY": 50_000_000},
    "LION":          {"COMMON": 50_000,  "UNCOMMON": 200_000, "RARE": 1_000_000, "EPIC": 4_000_000,   "LEGENDARY": 20_000_000},
    "ENDER DRAGON":  {"EPIC": 100_000_000, "LEGENDARY": 300_000_000},
    "GOLDEN DRAGON": {"LEGENDARY": 800_000_000},
    "GRIFFIN":       {"RARE": 2_000_000,  "EPIC": 10_000_000,  "LEGENDARY": 80_000_000},
    "ENDERMAN":      {"UNCOMMON": 300_000, "RARE": 1_000_000,  "EPIC": 4_000_000, "LEGENDARY": 15_000_000},
    "BLAZE":         {"UNCOMMON": 200_000, "RARE": 800_000,    "EPIC": 3_000_000, "LEGENDARY": 10_000_000},
    "BEE":           {"UNCOMMON": 150_000, "RARE": 600_000,    "EPIC": 2_000_000, "LEGENDARY": 8_000_000},
    "WOLF":          {"UNCOMMON": 200_000, "RARE": 700_000,    "EPIC": 2_500_000, "LEGENDARY": 10_000_000},
    "SPIDER":        {"UNCOMMON": 150_000, "RARE": 500_000,    "EPIC": 2_000_000, "LEGENDARY": 7_000_000},
    "ZOMBIE":        {"UNCOMMON": 100_000, "RARE": 400_000,    "EPIC": 1_500_000, "LEGENDARY": 5_000_000},
    "HORSE":         {"RARE": 500_000,    "EPIC": 2_000_000,   "LEGENDARY": 8_000_000},
    "JERRY":         {"LEGENDARY": 200_000_000},
}


def _estimate_pet_value(pet: dict) -> float:
    ptype = pet.get("type", "").upper().replace("_", " ")
    tier  = pet.get("tier", "COMMON").upper()
    return PET_BASE_VALUES.get(ptype, {}).get(tier, 50_000)


# ── Internal helpers ──────────────────────────────────────────────────────────

async def _safe_player_data(api_key: str, uuid: str) -> dict:
    """Fetch /v2/player — non-fatal, returns {} on error."""
    try:
        return await get_player_data(api_key, uuid)
    except Exception:
        return {}


def _find_active_profile(profiles: list[dict], clean_uuid: str) -> Optional[dict]:
    """Return the most-recently-saved profile from a profiles list."""
    best, latest = None, 0
    for p in profiles:
        save = p.get("members", {}).get(clean_uuid, {}).get("last_save", 0)
        if save > latest:
            latest, best = save, p
    return best or next((p for p in profiles if p.get("selected")), None)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/{username}")
@limiter.limit("20/minute")
async def player_lookup(
    request: Request,
    username: str,
    x_api_key: Optional[str] = Header(None, alias="x-api-key"),
):
    api_key = _resolve_key(x_api_key)

    try:
        uuid = await get_player_uuid(username)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Player '{username}' not found")
    if not uuid:
        raise HTTPException(status_code=404, detail=f"Player '{username}' not found")

    clean_uuid = uuid.replace("-", "")

    # Fetch profiles list + general player data in parallel
    try:
        profiles_result, player_data_result = await asyncio.gather(
            get_skyblock_profiles(api_key, uuid),
            _safe_player_data(api_key, uuid),
            return_exceptions=True,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Hypixel error: {e}")

    if isinstance(profiles_result, Exception):
        raise HTTPException(status_code=502, detail=str(profiles_result))
    player_data: dict = player_data_result if not isinstance(player_data_result, Exception) else {}

    profiles: list = profiles_result.get("profiles", []) or []
    active_stub     = _find_active_profile(profiles, clean_uuid)

    # Fetch full profile data (includes complete inventory + player_data) separately
    # because /v2/skyblock/profiles may return trimmed member objects
    full_member: dict = {}
    last_save_ms = 0
    analyzed     = None

    if active_stub:
        try:
            full_resp    = await get_skyblock_profile(api_key, active_stub["profile_id"])
            full_profile = full_resp.get("profile") or full_resp
            full_member  = (full_profile.get("members") or {}).get(clean_uuid, {})
            last_save_ms = full_member.get("last_save", 0)
            analyzed     = analyze_profile(full_profile, uuid)
        except Exception:
            # Fall back to stub data if single-profile fetch fails
            try:
                analyzed = analyze_profile(active_stub, uuid)
            except Exception:
                pass

    return {
        "uuid":     uuid,
        "username": username,
        "player":   player_data.get("player", {}),
        "profiles": [
            {
                "profile_id": p.get("profile_id"),
                "cute_name":  p.get("cute_name"),
                "selected":   p.get("selected", False),
            }
            for p in profiles
        ],
        "active_profile": {
            "cute_name":    active_stub.get("cute_name")    if active_stub else None,
            "profile_id":   active_stub.get("profile_id")   if active_stub else None,
            "last_save_ms": last_save_ms,
            "stats":        analyzed,
        },
    }


@router.get("/{username}/profile/{profile_id}")
@limiter.limit("20/minute")
async def profile_stats(
    request: Request,
    username: str,
    profile_id: str,
    x_api_key: Optional[str] = Header(None, alias="x-api-key"),
):
    api_key = _resolve_key(x_api_key)

    try:
        uuid = await get_player_uuid(username)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Player '{username}' not found")
    if not uuid:
        raise HTTPException(status_code=404, detail=f"Player '{username}' not found")

    try:
        full_resp = await get_skyblock_profile(api_key, profile_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    target = full_resp.get("profile") or full_resp
    if not target:
        raise HTTPException(status_code=404, detail="Profile not found")

    try:
        stats = analyze_profile(target, uuid)
        error = None
    except Exception as exc:
        stats, error = None, str(exc)

    clean_uuid   = uuid.replace("-", "")
    last_save_ms = (target.get("members") or {}).get(clean_uuid, {}).get("last_save", 0)

    return {
        "profile_id":   profile_id,
        "cute_name":    target.get("cute_name"),
        "last_save_ms": last_save_ms,
        "stats":        stats,
        "error":        error,
    }


@router.get("/{username}/networth")
@limiter.limit("10/minute")
async def networth(
    request: Request,
    username: str,
    profile_id: Optional[str] = None,
    x_api_key: Optional[str] = Header(None, alias="x-api-key"),
):
    """Estimate a player's net worth across ALL storage locations."""
    api_key = _resolve_key(x_api_key)

    try:
        uuid = await get_player_uuid(username)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Player '{username}' not found")
    if not uuid:
        raise HTTPException(status_code=404, detail=f"Player '{username}' not found")

    # ── Resolve profile_id if not provided ────────────────────────────────
    if not profile_id:
        try:
            profiles_data = await get_skyblock_profiles(api_key, uuid)
        except Exception as e:
            raise HTTPException(status_code=502, detail=str(e))
        profiles      = profiles_data.get("profiles", []) or []
        active_stub   = _find_active_profile(profiles, uuid.replace("-", ""))
        if not active_stub:
            raise HTTPException(status_code=404, detail="No profile found")
        profile_id = active_stub["profile_id"]

    # ── Always fetch FULL single-profile data (includes inventory NBT) ────
    try:
        full_resp = await get_skyblock_profile(api_key, profile_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    profile = full_resp.get("profile") or full_resp
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    clean_uuid = uuid.replace("-", "")
    member: dict = (profile.get("members") or {}).get(clean_uuid, {})

    # ── Inventory helper ──────────────────────────────────────────────────
    # v2: all inventory lives under member.inventory.*
    # v1: flat on member
    inv_v2: dict = member.get("inventory") or {}

    def _inv_data(v2_key: str, v1_key: str) -> str:
        """Return base64 data string trying v2 path then v1 fallback."""
        node = inv_v2.get(v2_key) or member.get(v1_key) or {}
        if isinstance(node, dict):
            return node.get("data", "")
        return ""

    def _inv_data_v2_only(v2_key: str) -> str:
        node = inv_v2.get(v2_key) or {}
        if isinstance(node, dict):
            return node.get("data", "")
        return ""

    # ── Price helper ──────────────────────────────────────────────────────
    def price_items(items: list[dict]) -> tuple[float, list[dict], list[dict]]:
        """Returns (total_value, valued_only, all_with_value_field)."""
        valued, all_ann = [], []
        total = 0.0
        for it in items:
            val = _KNOWN_VALUES.get(it["id"], 0) * it["count"]
            ann = {**it, "value": val}
            all_ann.append(ann)
            if val > 0:
                total += val
                valued.append(ann)
        return total, valued, all_ann

    # ── Coins ─────────────────────────────────────────────────────────────
    # v2: member.currencies.coin_purse
    # v1: member.coin_purse
    currencies_v2 = member.get("currencies") or {}
    purse = float(
        currencies_v2.get("coin_purse")
        or member.get("coin_purse")
        or member.get("purse")
        or 0
    )

    # Co-op banking lives at the profile level (not member level)
    banking = float((profile.get("banking") or {}).get("balance", 0) or 0)

    # ── Pets ──────────────────────────────────────────────────────────────
    # v2: member.pets_data.pets  |  v1: member.pets
    pets_raw   = (member.get("pets_data") or {}).get("pets", []) or member.get("pets", []) or []
    pets_value = sum(_estimate_pet_value(p) for p in pets_raw)
    pets_list  = [
        {
            "type":   p.get("type"),
            "tier":   p.get("tier"),
            "active": p.get("active", False),
            "value":  _estimate_pet_value(p),
        }
        for p in sorted(pets_raw, key=_estimate_pet_value, reverse=True)[:20]
    ]

    # ── Decode all inventory slots ────────────────────────────────────────

    # Main 36-slot inventory
    inv_items  = _decode_inventory(_inv_data("inv_contents",         "inv_contents"))

    # Ender chest (typically 9 pages × 54 slots — stored as one large NBT)
    ec_items   = _decode_inventory(_inv_data("ender_chest_contents", "ender_chest_contents"))

    # Wardrobe (4 pages of armour sets)
    ward_items = _decode_inventory(_inv_data("wardrobe_contents",    "wardrobe_contents"))

    # Talisman / accessory bag
    # v2 name: bag_contents  |  v1 name: talisman_bag  |  alt: talismans
    talisman_raw = (
        _decode_inventory(_inv_data_v2_only("bag_contents"))
        or _decode_inventory(_inv_data("talismans", "talisman_bag"))
    )

    # Backpack contents — dict keyed by slot index, each {"data": base64}
    bp_raw: list[dict] = []
    bp_contents = inv_v2.get("backpack_contents") or member.get("backpack_contents") or {}
    if isinstance(bp_contents, dict):
        for slot_val in bp_contents.values():
            if isinstance(slot_val, dict):
                bp_raw.extend(_decode_inventory(slot_val.get("data", "")))

    # Personal vault (safe) — 5-slot personal storage
    vault_raw = _decode_inventory(_inv_data("personal_vault_contents", "personal_vault_contents"))

    # Fishing bag
    fishing_raw = _decode_inventory(_inv_data("fishing_bag", "fishing_bag"))

    # Potion bag
    potion_raw = _decode_inventory(_inv_data("potion_bag", "potion_bag"))

    # Quiver (arrows/bolts)
    quiver_raw = _decode_inventory(_inv_data("quiver", "quiver"))

    # Equipment (armour worn in non-armour slots — charms, necklace, belt, gloves)
    equip_raw = _decode_inventory(_inv_data_v2_only("equipment_contents"))

    # ── Price all inventory sources ───────────────────────────────────────
    inv_val,      inv_valued,      inv_all      = price_items(inv_items)
    ec_val,       ec_valued,       ec_all       = price_items(ec_items)
    ward_val,     ward_valued,     ward_all     = price_items(ward_items)
    talisman_val, talisman_valued, talisman_all = price_items(talisman_raw)
    bp_val,       bp_valued,       bp_all       = price_items(bp_raw)
    vault_val,    vault_valued,    vault_all    = price_items(vault_raw)
    fishing_val,  _,               fishing_all  = price_items(fishing_raw)
    potion_val,   _,               potion_all   = price_items(potion_raw)
    quiver_val,   _,               quiver_all   = price_items(quiver_raw)
    equip_val,    _,               equip_all    = price_items(equip_raw)

    # ── Minions ───────────────────────────────────────────────────────────
    player_data_v2 = member.get("player_data") or {}
    crafted        = player_data_v2.get("crafted_generators") or member.get("crafted_generators") or []
    minion_count   = len(crafted)

    # ── Net worth total ───────────────────────────────────────────────────
    total = (
        purse + banking + pets_value
        + inv_val + ec_val + ward_val
        + talisman_val + bp_val + vault_val
        + fishing_val + potion_val + quiver_val + equip_val
    )

    def _top(lst: list[dict], n: int) -> list[dict]:
        return sorted(lst, key=lambda x: x["value"], reverse=True)[:n]

    return {
        "username": username,
        "profile":  profile.get("cute_name"),
        "total":    round(total),
        "breakdown": {
            "purse":       round(purse),
            "bank":        round(banking),
            "pets":        round(pets_value),
            "inventory":   round(inv_val),
            "ender_chest": round(ec_val),
            "wardrobe":    round(ward_val),
            "talismans":   round(talisman_val),
            "backpack":    round(bp_val),
            "vault":       round(vault_val),
            "fishing_bag": round(fishing_val),
            "equipment":   round(equip_val),
        },
        "pets": pets_list,
        # Valued-only (backwards-compat with NetWorth.jsx)
        "inv_items":  _top(inv_valued,      30),
        "ec_items":   _top(ec_valued,       30),
        "ward_items": _top(ward_valued,     20),
        # All items per slot (for PlayerStats inventory display)
        "inv_all":       _top(inv_all,       100),
        "ec_all":        _top(ec_all,        100),
        "ward_all":      _top(ward_all,      100),
        "talisman_all":  _top(talisman_all,  100),
        "backpack_all":  _top(bp_all,        100),
        "vault_all":     _top(vault_all,      50),
        "fishing_all":   _top(fishing_all,    50),
        "equipment_all": _top(equip_all,      20),
        "minion_count":  minion_count,
    }


@router.get("/{username}/auctions")
@limiter.limit("15/minute")
async def player_auction_list(
    request: Request,
    username: str,
    profile_id: Optional[str] = None,
    x_api_key: Optional[str] = Header(None, alias="x-api-key"),
):
    """Active AH auctions for a player (or a specific profile)."""
    api_key = _resolve_key(x_api_key)

    try:
        uuid = await get_player_uuid(username)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Player '{username}' not found")
    if not uuid:
        raise HTTPException(status_code=404, detail=f"Player '{username}' not found")

    try:
        raw = await get_profile_auctions(api_key, profile_id) if profile_id \
              else await get_player_auctions(api_key, uuid)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))

    now_ms   = __import__("time").time() * 1000
    auctions = []
    for a in raw.get("auctions", []):
        end_ms    = a.get("end", 0)
        time_left = max(0, int((end_ms - now_ms) / 1000))
        auctions.append({
            "uuid":         a.get("uuid"),
            "item_name":    a.get("item_name", "Unknown"),
            "tier":         a.get("tier", "COMMON"),
            "category":     a.get("category", "misc"),
            "starting_bid": a.get("starting_bid", 0),
            "highest_bid":  a.get("highest_bid_amount", 0),
            "bin":          a.get("bin", False),
            "claimed":      a.get("claimed", False),
            "bids":         len(a.get("bids", [])),
            "end_ms":       end_ms,
            "time_left_s":  time_left,
        })

    auctions.sort(key=lambda x: (x["claimed"], -x["highest_bid"]))

    return {
        "username": username,
        "uuid":     uuid,
        "count":    len(auctions),
        "auctions": auctions,
    }
