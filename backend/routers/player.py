import re
import gzip
import base64
import io
from fastapi import APIRouter, HTTPException, Request, Header
from typing import Optional

try:
    import nbtlib
    HAS_NBTLIB = True
except ImportError:
    HAS_NBTLIB = False

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


def _resolve_key(header_key: Optional[str]) -> str:
    key = get_server_api_key() or header_key
    if not key:
        raise HTTPException(
            status_code=401,
            detail="No Hypixel API key configured. Set HYPIXEL_API_KEY in .env or pass X-Api-Key header.",
        )
    return key


def _decode_inventory(data_b64: str) -> list[dict]:
    """Decode base64-gzipped NBT inventory to list of {id, count, name}."""
    if not HAS_NBTLIB or not data_b64:
        return []
    try:
        raw = base64.b64decode(data_b64)
        try:
            raw = gzip.decompress(raw)
        except Exception:
            pass
        nbt = nbtlib.load(fileobj=io.BytesIO(raw))
        items = []
        for item in nbt.get("", {}).get("i", []):
            if not item:
                continue
            tag = item.get("tag", {})
            if not tag:
                continue
            extra = tag.get("ExtraAttributes", {})
            item_id = str(extra.get("id", "")).strip()
            count = int(item.get("Count", 1))
            if not item_id:
                continue
            # Extract human-readable display name, stripping Minecraft §colour codes
            display = tag.get("display") or {}
            raw_name = str(display.get("Name", ""))
            clean_name = _COLOR_STRIP.sub("", raw_name).strip() or None
            items.append({"id": item_id, "count": count, "name": clean_name})
        return items
    except Exception:
        return []


# ── Known approximate market values ──────────────────────────────────────────
_KNOWN_VALUES: dict[str, float] = {
    # Swords / Melee
    "ASPECT_OF_THE_DRAGONS":   3_500_000,
    "SHADOW_FURY":            12_000_000,
    "HYPERION":              700_000_000,
    "SCYLLA":                400_000_000,
    "VALKYRIE":              300_000_000,
    "TERMINATOR":            550_000_000,
    "NECRON_BLADE":          200_000_000,
    "LIVID_DAGGER":            8_000_000,
    "PIGMAN_SWORD":            2_500_000,
    "ASPECT_OF_THE_END":         600_000,
    "GIANTS_SWORD":           15_000_000,
    "FLOWER_OF_TRUTH":         5_000_000,
    "ATOMSPLIT_KATANA":       25_000_000,
    "VORPAL_KATANA":           8_000_000,
    "LAST_BREATH":            50_000_000,
    "REAPER_SCYTHE":         100_000_000,
    "MIDAS_SWORD":           200_000_000,
    "MIDAS_STAFF":           120_000_000,
    "DREADLORD_SWORD":           500_000,
    "ZOMBIE_SWORD":              800_000,
    "SHREDDER":                1_000_000,
    # Bows
    "JUJU_SHORTBOW":          50_000_000,
    "HURRICANE_BOW":           2_000_000,
    # Wands / Staves
    "SOUL_WHIP":               3_000_000,
    # Necron armour
    "NECRON_HANDLE":          10_000_000,
    "WITHER_HELMET":           5_000_000,
    "WITHER_CHESTPLATE":       8_000_000,
    "WITHER_LEGGINGS":         6_000_000,
    "WITHER_BOOTS":            5_000_000,
    "NECRON_HELMET":          25_000_000,
    "NECRON_CHESTPLATE":      40_000_000,
    "NECRON_LEGGINGS":        30_000_000,
    "NECRON_BOOTS":           20_000_000,
    # Storm armour
    "STORM_HELMET":           15_000_000,
    "STORM_CHESTPLATE":       25_000_000,
    "STORM_LEGGINGS":         18_000_000,
    "STORM_BOOTS":            12_000_000,
    # Goldor armour
    "GOLDOR_HELMET":           8_000_000,
    "GOLDOR_CHESTPLATE":      12_000_000,
    "GOLDOR_LEGGINGS":        10_000_000,
    "GOLDOR_BOOTS":            7_000_000,
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
    "ENDER_HELMET":            3_000_000,
    "ENDER_CHESTPLATE":        5_000_000,
    "ENDER_LEGGINGS":          4_000_000,
    "ENDER_BOOTS":             3_000_000,
    "BLAZE_HELMET":            2_000_000,
    "BLAZE_CHESTPLATE":        3_000_000,
    "BLAZE_LEGGINGS":          2_500_000,
    "BLAZE_BOOTS":             2_000_000,
    # Accessories
    "RECOMBOBULATOR_3000":    15_000_000,
    "HEGEMONY_ARTIFACT":     200_000_000,
    "WITHER_ARTIFACT":        50_000_000,
    "WITHER_RELIC":           80_000_000,
    "WITHER_SHIELD":          15_000_000,
    "MANA_FLUX":              10_000_000,
    "OVERFLUX_CAPACITOR":     25_000_000,
    "PLASMA_BUCKET":         100_000_000,
    "ENDER_RELIC":            30_000_000,
    "ABICASE":                50_000_000,
    "STONKS_TALISMAN":         3_000_000,
    "MASTER_SKULL_TIER_7":   200_000_000,
    # Materials
    "GOLDEN_TALISMAN":        50_000_000,
    "DUNGEON_CHEST_KEY":         200_000,
    "NEW_YEAR_CAKE":           5_000_000,
}

# ── Pet values ────────────────────────────────────────────────────────────────
PET_BASE_VALUES: dict[str, dict[str, float]] = {
    "TIGER":        {"COMMON": 100_000, "UNCOMMON": 500_000, "RARE": 2_000_000, "EPIC": 8_000_000,   "LEGENDARY": 50_000_000},
    "LION":         {"COMMON": 50_000,  "UNCOMMON": 200_000, "RARE": 1_000_000, "EPIC": 4_000_000,   "LEGENDARY": 20_000_000},
    "ENDER DRAGON": {"EPIC": 100_000_000, "LEGENDARY": 300_000_000},
    "GOLDEN DRAGON":{"LEGENDARY": 800_000_000},
    "GRIFFIN":      {"RARE": 2_000_000, "EPIC": 10_000_000, "LEGENDARY": 80_000_000},
    "ENDERMAN":     {"UNCOMMON": 300_000, "RARE": 1_000_000, "EPIC": 4_000_000, "LEGENDARY": 15_000_000},
    "BLAZE":        {"UNCOMMON": 200_000, "RARE": 800_000,   "EPIC": 3_000_000, "LEGENDARY": 10_000_000},
    "BEE":          {"UNCOMMON": 150_000, "RARE": 600_000,   "EPIC": 2_000_000, "LEGENDARY": 8_000_000},
    "WOLF":         {"UNCOMMON": 200_000, "RARE": 700_000,   "EPIC": 2_500_000, "LEGENDARY": 10_000_000},
    "SPIDER":       {"UNCOMMON": 150_000, "RARE": 500_000,   "EPIC": 2_000_000, "LEGENDARY": 7_000_000},
    "ZOMBIE":       {"UNCOMMON": 100_000, "RARE": 400_000,   "EPIC": 1_500_000, "LEGENDARY": 5_000_000},
    "HORSE":        {"RARE": 500_000,  "EPIC": 2_000_000,  "LEGENDARY": 8_000_000},
    "JERRY":        {"LEGENDARY": 200_000_000},
}


def _estimate_pet_value(pet: dict) -> float:
    ptype = pet.get("type", "").upper().replace("_", " ")
    tier = pet.get("tier", "COMMON").upper()
    tiers = PET_BASE_VALUES.get(ptype, {})
    return tiers.get(tier, 50_000)


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

    try:
        profiles_data = await get_skyblock_profiles(api_key, uuid)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Hypixel profiles error: {e}")

    try:
        player_data = await get_player_data(api_key, uuid)
    except Exception:
        player_data = {}

    profiles = profiles_data.get("profiles", []) or []
    clean_uuid = uuid.replace("-", "")

    # Find most recently active profile
    selected_profile = None
    latest_save = 0
    for p in profiles:
        member = p.get("members", {}).get(clean_uuid, {})
        save_time = member.get("last_save", 0)
        if save_time > latest_save:
            latest_save = save_time
            selected_profile = p
    if not selected_profile:
        selected_profile = next((p for p in profiles if p.get("selected")), None)

    analyzed = None
    last_save_ms = 0
    if selected_profile:
        last_save_ms = selected_profile.get("members", {}).get(clean_uuid, {}).get("last_save", 0)
        try:
            analyzed = analyze_profile(selected_profile, uuid)
        except Exception:
            pass

    return {
        "uuid": uuid,
        "username": username,
        "player": player_data.get("player", {}),
        "profiles": [
            {
                "profile_id": p.get("profile_id"),
                "cute_name": p.get("cute_name"),
                "selected": p.get("selected", False),
            }
            for p in profiles
        ],
        "active_profile": {
            "cute_name":    selected_profile.get("cute_name")    if selected_profile else None,
            "profile_id":   selected_profile.get("profile_id")   if selected_profile else None,
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
        profile_data = await get_skyblock_profile(api_key, profile_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    target = profile_data.get("profile") or profile_data
    if not target:
        raise HTTPException(status_code=404, detail="Profile not found")

    try:
        stats = analyze_profile(target, uuid)
        error = None
    except Exception as exc:
        stats = None
        error = str(exc)

    clean_uuid = uuid.replace("-", "")
    last_save_ms = target.get("members", {}).get(clean_uuid, {}).get("last_save", 0)

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
    """Estimate a player's net worth across all storage locations."""
    api_key = _resolve_key(x_api_key)

    try:
        uuid = await get_player_uuid(username)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Player '{username}' not found")
    if not uuid:
        raise HTTPException(status_code=404, detail=f"Player '{username}' not found")

    if profile_id:
        try:
            profile_data = await get_skyblock_profile(api_key, profile_id)
        except Exception as e:
            raise HTTPException(status_code=502, detail=str(e))
        profile = profile_data.get("profile") or profile_data
    else:
        try:
            profiles_data = await get_skyblock_profiles(api_key, uuid)
        except Exception as e:
            raise HTTPException(status_code=502, detail=str(e))
        profiles = profiles_data.get("profiles", []) or []
        profile = None
        latest = 0
        for p in profiles:
            m = p.get("members", {}).get(uuid.replace("-", ""), {})
            t = m.get("last_save", 0)
            if t > latest:
                latest = t
                profile = p
        if not profile:
            profile = next((p for p in profiles if p.get("selected")), None)

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    member = profile.get("members", {}).get(uuid.replace("-", ""), {})

    # ── Helpers ────────────────────────────────────────────────────────────
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

    inv_v2 = member.get("inventory") or {}

    def _inv_data(v2_key: str, v1_key: str) -> str:
        return (inv_v2.get(v2_key) or member.get(v1_key) or {}).get("data", "")

    # ── Coins ─────────────────────────────────────────────────────────────
    currencies_v2 = member.get("currencies") or {}
    purse   = float(currencies_v2.get("coin_purse") or member.get("coin_purse") or member.get("purse") or 0)
    banking = float((profile.get("banking") or {}).get("balance", 0) or 0)

    # ── Pets ──────────────────────────────────────────────────────────────
    pets_raw  = (member.get("pets_data") or {}).get("pets", []) or []
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

    # ── Main inventory ─────────────────────────────────────────────────────
    inv_items  = _decode_inventory(_inv_data("inv_contents",         "inv_contents"))
    ec_items   = _decode_inventory(_inv_data("ender_chest_contents", "ender_chest_contents"))
    ward_items = _decode_inventory(_inv_data("wardrobe_contents",    "wardrobe_contents"))

    inv_val,  inv_valued,  inv_all  = price_items(inv_items)
    ec_val,   ec_valued,   ec_all   = price_items(ec_items)
    ward_val, ward_valued, ward_all = price_items(ward_items)

    # ── Backpack ───────────────────────────────────────────────────────────
    bp_contents = inv_v2.get("backpack_contents") or member.get("backpack_contents") or {}
    bp_raw: list[dict] = []
    for slot_val in (bp_contents.values() if isinstance(bp_contents, dict) else []):
        bp_raw.extend(_decode_inventory((slot_val or {}).get("data", "")))
    bp_val, bp_valued, bp_all = price_items(bp_raw)

    # ── Personal vault (safe) ──────────────────────────────────────────────
    vault_raw = _decode_inventory(_inv_data("personal_vault_contents", "personal_vault_contents"))
    vault_val, vault_valued, vault_all = price_items(vault_raw)

    # ── Talisman / Accessory bag ───────────────────────────────────────────
    talisman_raw = _decode_inventory(_inv_data("talismans", "talisman_bag"))
    talisman_val, talisman_valued, talisman_all = price_items(talisman_raw)

    # ── Minions ────────────────────────────────────────────────────────────
    player_data_v2 = member.get("player_data") or {}
    crafted = player_data_v2.get("crafted_generators") or member.get("crafted_generators") or []
    minion_count = len(crafted)

    # ── Summary ────────────────────────────────────────────────────────────
    total = purse + banking + pets_value + inv_val + ec_val + ward_val + bp_val + vault_val + talisman_val

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
            "backpack":    round(bp_val),
            "vault":       round(vault_val),
            "talismans":   round(talisman_val),
        },
        "pets": pets_list,
        # Valued-only (backwards-compat with NetWorth.jsx)
        "inv_items":  _top(inv_valued,  30),
        "ec_items":   _top(ec_valued,   30),
        "ward_items": _top(ward_valued, 20),
        # All items including unknowns (for PlayerStats inventory display)
        "inv_all":       _top(inv_all,       100),
        "ec_all":        _top(ec_all,        100),
        "ward_all":      _top(ward_all,      100),
        "backpack_all":  _top(bp_all,        100),
        "vault_all":     _top(vault_all,      50),
        "talisman_all":  _top(talisman_all,  100),
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
        if profile_id:
            raw = await get_profile_auctions(api_key, profile_id)
        else:
            raw = await get_player_auctions(api_key, uuid)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))

    now_ms = __import__("time").time() * 1000
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
