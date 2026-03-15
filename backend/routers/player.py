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
from ..utils.item_prices import item_prices as _live_prices
from ..utils.prices_v2 import prices_v2 as _p2
from ..utils.ah_index import ah_index as _ah_index
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


def _upstream_exc(e: Exception) -> HTTPException:
    """Convert a Hypixel upstream error into an appropriate HTTPException.

    - Hypixel 403  → 503 Service Unavailable  (API key invalid/missing on server)
    - Hypixel 429  → 503 Service Unavailable  (rate-limited upstream)
    - Hypixel 404  → 404 Not Found
    - anything else → 502 Bad Gateway
    """
    msg = str(e)
    if " 403" in msg or "Invalid API key" in msg or "forbidden" in msg.lower():
        return HTTPException(
            status_code=503,
            detail=(
                "The server's Hypixel API key is invalid or expired. "
                "Please contact the site administrator to update HYPIXEL_API_KEY."
            ),
        )
    if " 429" in msg or "throttle" in msg.lower():
        return HTTPException(status_code=503, detail="Hypixel API rate limit reached — please try again shortly.")
    if " 404" in msg:
        return HTTPException(status_code=404, detail=msg)
    return HTTPException(status_code=502, detail=msg)


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


def _item_from_nbt(item: dict) -> Optional[dict]:
    """Extract full item data from a parsed NBT compound, or None if empty slot."""
    if not isinstance(item, dict):
        return None
    tag = item.get("tag")
    if not isinstance(tag, dict):
        return None
    extra   = tag.get("ExtraAttributes") or {}
    item_id = str(extra.get("id", "") or "").strip()
    if not item_id:
        return None

    count   = int(item.get("Count", 1) or 1)
    display = tag.get("display") or {}

    raw_name   = str(display.get("Name", "") or "")
    clean_name = _COLOR_STRIP.sub("", raw_name).strip() or None

    # Lore: preserve §-color codes for frontend rendering, cap at 30 lines
    lore_raw = display.get("Lore")
    lore = [str(l) for l in lore_raw if l is not None][:30] if isinstance(lore_raw, list) else []

    # Enchantments: {name: level}
    enc_raw = extra.get("enchantments") or {}
    enchantments = ({str(k): int(v) for k, v in enc_raw.items()
                     if isinstance(v, (int, float))}
                    if isinstance(enc_raw, dict) else {})

    # Upgrade counters
    hot_potato_count   = int(extra.get("hot_potato_count")   or 0)
    rarity_upgrades    = int(extra.get("rarity_upgrades")    or 0)
    dungeon_item_level = int(extra.get("dungeon_item_level") or extra.get("upgrade_level") or 0)
    reforge            = str(extra.get("modifier") or "").replace("_", " ").title()
    skin               = str(extra.get("skin") or "")

    # Gems (simplified display list)
    gems_raw = extra.get("gems") or {}
    gems: list[str] = []
    if isinstance(gems_raw, dict):
        for k, v in gems_raw.items():
            if not isinstance(k, str) or k == "unlocked_slots" or k.endswith("_gem"):
                continue
            if isinstance(v, str) and v:
                gems.append(v.replace("_", " ").title())
            elif isinstance(v, dict):
                gqual = str(v.get("quality") or v.get("type") or "")
                gtype = str(v.get("type") or "")
                desc  = f"{gqual} {gtype}".strip()
                if desc:
                    gems.append(desc.replace("_", " ").title())

    # Kuudra attributes {display_name: tier}
    attr_raw = extra.get("attributes") or {}
    attributes: dict[str, int] = {}
    if isinstance(attr_raw, dict):
        for k, v in attr_raw.items():
            if isinstance(v, (int, float)):
                attributes[str(k).replace("_", " ").title()] = int(v)

    return {
        "id":                  item_id,
        "count":               count,
        "name":                clean_name,
        "lore":                lore,
        "enchantments":        enchantments,
        "hot_potato_count":    hot_potato_count,
        "rarity_upgrades":     rarity_upgrades,
        "dungeon_item_level":  dungeon_item_level,
        "reforge":             reforge,
        "skin":                skin,
        "gems":                gems,
        "attributes":          attributes,
    }


def _decode_inventory(data_b64: str) -> list[dict]:
    """Decode a base64-gzipped Hypixel NBT inventory blob → list[{id, count, name}] (empty slots skipped)."""
    if not data_b64:
        return []
    try:
        raw = base64.b64decode(data_b64)
        try:
            raw = gzip.decompress(raw)
        except Exception:
            pass
        return [r for r in (_item_from_nbt(i) for i in _parse_nbt_inventory(raw)) if r]
    except Exception:
        return []


def _decode_inventory_slots(data_b64: str) -> list[Optional[dict]]:
    """Like _decode_inventory but preserves slot positions (None for empty slots)."""
    if not data_b64:
        return []
    try:
        raw = base64.b64decode(data_b64)
        try:
            raw = gzip.decompress(raw)
        except Exception:
            pass
        return [_item_from_nbt(i) for i in _parse_nbt_inventory(raw)]
    except Exception:
        return []


# ── Known approximate market values ──────────────────────────────────────────
# These are FALLBACK prices used only when live AH/Bazaar data is unavailable.
# Live prices from item_prices.py always take priority.
_KNOWN_VALUES: dict[str, float] = {
    # ── Swords / Melee ────────────────────────────────────────────────────
    "ASPECT_OF_THE_DRAGONS":      3_500_000,
    "SHADOW_FURY":                12_000_000,
    "HYPERION":                  750_000_000,
    "SCYLLA":                    400_000_000,
    "VALKYRIE":                  300_000_000,
    "ASTRAEA":                   450_000_000,
    "TERMINATOR":                500_000_000,
    "NECRON_BLADE":              200_000_000,
    "DARK_CLAYMORE":           1_000_000_000,
    "LIVID_DAGGER":                8_000_000,
    "PIGMAN_SWORD":                2_500_000,
    "ASPECT_OF_THE_END":             600_000,
    "GIANTS_SWORD":              170_000_000,
    "FLOWER_OF_TRUTH":             5_000_000,
    "ATOMSPLIT_KATANA":           25_000_000,
    "VORPAL_KATANA":               8_000_000,
    "LAST_BREATH":                50_000_000,
    "REAPER_SCYTHE":             100_000_000,
    "MIDAS_SWORD":                50_000_000,
    "MIDAS_STAFF":                90_000_000,
    "DREADLORD_SWORD":               500_000,
    "ZOMBIE_SWORD":                  800_000,
    "SHREDDER":                    1_500_000,
    "SOUL_WHIP":                   3_000_000,
    "FIRE_VEIL_WAND":              2_000_000,
    "WYVERN_BLADE":              200_000_000,
    "ASTEA_FABLES":               30_000_000,
    "DIAMOND_SWORD":                  10_000,
    # ── Bows ──────────────────────────────────────────────────────────────
    "JUJU_SHORTBOW":              30_000_000,
    "HURRICANE_BOW":               2_000_000,
    "WITHERED_DRAGON_BOW":        20_000_000,
    # ── Wands / staves ────────────────────────────────────────────────────
    "WAND_OF_RESTORATION":           800_000,
    "WAND_OF_HEALING":               300_000,
    # ── Wither / Necron armour ────────────────────────────────────────────
    "NECRON_HANDLE":              10_000_000,
    "WITHER_HELMET":               5_000_000,
    "WITHER_CHESTPLATE":           8_000_000,
    "WITHER_LEGGINGS":             6_000_000,
    "WITHER_BOOTS":                5_000_000,
    "NECRON_HELMET":              25_000_000,
    "NECRON_CHESTPLATE":          40_000_000,
    "NECRON_LEGGINGS":            30_000_000,
    "NECRON_BOOTS":               20_000_000,
    # ── Storm armour ──────────────────────────────────────────────────────
    "STORM_HELMET":               15_000_000,
    "STORM_CHESTPLATE":           25_000_000,
    "STORM_LEGGINGS":             18_000_000,
    "STORM_BOOTS":                12_000_000,
    # ── Goldor armour ─────────────────────────────────────────────────────
    "GOLDOR_HELMET":               8_000_000,
    "GOLDOR_CHESTPLATE":          12_000_000,
    "GOLDOR_LEGGINGS":            10_000_000,
    "GOLDOR_BOOTS":                7_000_000,
    # ── Warden helmet ─────────────────────────────────────────────────────
    "WARDEN_HELMET":             350_000_000,
    # ── Dragon armours ────────────────────────────────────────────────────
    "SUPERIOR_DRAGON_HELMET":      3_500_000,
    "SUPERIOR_DRAGON_CHESTPLATE":  6_000_000,
    "SUPERIOR_DRAGON_LEGGINGS":    4_500_000,
    "SUPERIOR_DRAGON_BOOTS":       3_500_000,
    "STRONG_DRAGON_HELMET":        1_000_000,
    "STRONG_DRAGON_CHESTPLATE":    2_000_000,
    "STRONG_DRAGON_LEGGINGS":      1_500_000,
    "STRONG_DRAGON_BOOTS":         1_000_000,
    "YOUNG_DRAGON_HELMET":         2_500_000,
    "YOUNG_DRAGON_CHESTPLATE":     4_500_000,
    "YOUNG_DRAGON_LEGGINGS":       3_000_000,
    "YOUNG_DRAGON_BOOTS":          2_500_000,
    "WISE_DRAGON_HELMET":          1_500_000,
    "WISE_DRAGON_CHESTPLATE":      3_000_000,
    "WISE_DRAGON_LEGGINGS":        2_000_000,
    "WISE_DRAGON_BOOTS":           1_500_000,
    "UNSTABLE_DRAGON_HELMET":        600_000,
    "UNSTABLE_DRAGON_CHESTPLATE":  1_200_000,
    "UNSTABLE_DRAGON_LEGGINGS":      900_000,
    "UNSTABLE_DRAGON_BOOTS":         600_000,
    "OLD_DRAGON_HELMET":             800_000,
    "OLD_DRAGON_CHESTPLATE":       1_500_000,
    "OLD_DRAGON_LEGGINGS":         1_200_000,
    "OLD_DRAGON_BOOTS":              800_000,
    "PROTECTOR_DRAGON_HELMET":       400_000,
    "PROTECTOR_DRAGON_CHESTPLATE":   700_000,
    "PROTECTOR_DRAGON_LEGGINGS":     500_000,
    "PROTECTOR_DRAGON_BOOTS":        400_000,
    # ── Slayer armours ────────────────────────────────────────────────────
    "ENDER_HELMET":                3_000_000,
    "ENDER_CHESTPLATE":            5_000_000,
    "ENDER_LEGGINGS":              4_000_000,
    "ENDER_BOOTS":                 3_000_000,
    "BLAZE_HELMET":                2_000_000,
    "BLAZE_CHESTPLATE":            3_000_000,
    "BLAZE_LEGGINGS":              2_500_000,
    "BLAZE_BOOTS":                 2_000_000,
    "REVENANT_FALCHION":           5_000_000,
    "REAPER_FALCHION":             8_000_000,
    "SCORPION_FOIL":              12_000_000,
    "VOIDEDGE_KATANA":            40_000_000,
    "DARK_ORION_BOW":             60_000_000,
    # ── Kuudra / crimson armours (base without attributes) ────────────────
    "FERVOR_HELMET":               2_000_000,
    "FERVOR_CHESTPLATE":           3_000_000,
    "FERVOR_LEGGINGS":             2_500_000,
    "FERVOR_BOOTS":                2_000_000,
    "AURORA_HELMET":               3_000_000,
    "AURORA_CHESTPLATE":           5_000_000,
    "AURORA_LEGGINGS":             4_000_000,
    "AURORA_BOOTS":                3_000_000,
    "TERROR_HELMET":               5_000_000,
    "TERROR_CHESTPLATE":           8_000_000,
    "TERROR_LEGGINGS":             6_000_000,
    "TERROR_BOOTS":                5_000_000,
    "HOLLOW_HELMET":               8_000_000,
    "HOLLOW_CHESTPLATE":          12_000_000,
    "HOLLOW_LEGGINGS":            10_000_000,
    "HOLLOW_BOOTS":                8_000_000,
    "CRIMSON_HELMET":             25_000_000,
    "CRIMSON_CHESTPLATE":         40_000_000,
    "CRIMSON_LEGGINGS":           30_000_000,
    "CRIMSON_BOOTS":              25_000_000,
    # ── Upgrade materials (fallback only) ─────────────────────────────────
    "HOT_POTATO_BOOK":               600_000,
    "FUMING_POTATO_BOOK":         12_000_000,
    "FIRST_MASTER_STAR":           5_000_000,
    "SECOND_MASTER_STAR":          8_000_000,
    "THIRD_MASTER_STAR":          15_000_000,
    "FOURTH_MASTER_STAR":         25_000_000,
    "FIFTH_MASTER_STAR":          50_000_000,
    # ── Accessories ───────────────────────────────────────────────────────
    "RECOMBOBULATOR_3000":         6_000_000,
    "HEGEMONY_ARTIFACT":         200_000_000,
    "WITHER_ARTIFACT":            50_000_000,
    "WITHER_RELIC":               80_000_000,
    "WITHER_SHIELD":              15_000_000,
    "MANA_FLUX":                  10_000_000,
    "OVERFLUX_CAPACITOR":         70_000_000,
    "PLASMAFLUX_CORE":           300_000_000,
    "PLASMA_BUCKET":             100_000_000,
    "ENDER_RELIC":                30_000_000,
    "ABICASE":                    50_000_000,
    "STONKS_TALISMAN":             3_000_000,
    "MASTER_SKULL_TIER_7":       200_000_000,
    "POWER_ARTIFACT":              5_000_000,
    "SPEED_ARTIFACT":              2_000_000,
    "TRAVEL_SCROLL_TO_GARDEN":    20_000_000,
    # ── Special / misc ────────────────────────────────────────────────────
    "GOLDEN_TALISMAN":            50_000_000,
    "DUNGEON_CHEST_KEY":             200_000,
    "NEW_YEAR_CAKE":               5_000_000,
    "DEEP_SEA_ORB":               80_000_000,
}

# ── Pet XP → level calculation ────────────────────────────────────────────────
# Verified total XP required to reach level 100 per rarity (Hypixel SkyBlock wiki).
_PET_MAX_XP: dict[str, float] = {
    "COMMON":    3_864_068,
    "UNCOMMON":  8_333_068,
    "RARE":     14_803_068,
    "EPIC":     25_353_068,
    "LEGENDARY": 40_603_068,
    "MYTHIC":    40_603_068,
}

# XP fraction thresholds for level milestones (cumulative XP / max XP).
# Derived from the SkyBlock level-up cost curve: early levels are cheap,
# late levels are expensive.  Piecewise-linear interpolation between these
# anchor points gives < 5-level error across the full range.
_PET_XP_ANCHORS: list[tuple[float, int]] = [
    # (cumulative_xp_fraction, level)
    (0.000, 1),
    (0.002, 10),
    (0.008, 20),
    (0.020, 30),
    (0.045, 40),
    (0.090, 50),
    (0.175, 60),
    (0.315, 70),
    (0.510, 80),
    (0.720, 90),
    (0.870, 95),
    (1.000, 100),
]


def _pet_level_from_xp(exp: float, tier: str) -> int:
    """Convert cumulative pet XP to level (1–100) using piecewise interpolation."""
    max_xp = _PET_MAX_XP.get(tier.upper(), 40_603_068)
    if exp <= 0:
        return 1
    if exp >= max_xp:
        return 100
    ratio = exp / max_xp
    # Find surrounding anchor points and linearly interpolate
    for i in range(1, len(_PET_XP_ANCHORS)):
        r1, l1 = _PET_XP_ANCHORS[i - 1]
        r2, l2 = _PET_XP_ANCHORS[i]
        if ratio <= r2:
            t = (ratio - r1) / (r2 - r1) if r2 > r1 else 0
            return max(1, min(100, round(l1 + t * (l2 - l1))))
    return 100


def _pet_level_multiplier(level: int) -> float:
    """
    Price multiplier relative to a fully-levelled (lv100) pet.

    AH lowest-BIN prices for a pet type/rarity typically reflect low-level
    listings (cheapest).  A lv100 legendary commonly sells for 3–5× more
    than a lv1 of the same rarity.  Curve calibrated to match observed
    SkyBlock market ratios:
        lv  1 → 0.20×   lv 50 → 0.55×   lv 80 → 0.80×   lv100 → 1.00×
    """
    if level >= 100:
        return 1.0
    if level <= 1:
        return 0.20
    return 0.20 + 0.80 * (level / 100) ** 0.75


# ── Pet base values (max-level prices, used when live AH data is absent) ─────
PET_BASE_VALUES: dict[str, dict[str, float]] = {
    # ── Combat / slayer pets ──────────────────────────────────────────────
    "TIGER":            {"COMMON": 80_000,  "UNCOMMON": 400_000,  "RARE": 1_500_000,  "EPIC": 6_000_000,   "LEGENDARY": 45_000_000},
    "LION":             {"COMMON": 40_000,  "UNCOMMON": 150_000,  "RARE": 700_000,    "EPIC": 3_000_000,   "LEGENDARY": 18_000_000},
    "ENDERMAN":         {"UNCOMMON": 300_000,"RARE": 1_000_000,   "EPIC": 4_000_000,  "LEGENDARY": 15_000_000},
    "BLAZE":            {"UNCOMMON": 200_000,"RARE": 800_000,     "EPIC": 3_000_000,  "LEGENDARY": 10_000_000},
    "WOLF":             {"UNCOMMON": 150_000,"RARE": 600_000,     "EPIC": 2_000_000,  "LEGENDARY": 8_000_000},
    "SPIDER":           {"COMMON": 50_000,  "UNCOMMON": 150_000,  "RARE": 500_000,    "EPIC": 2_000_000,   "LEGENDARY": 7_000_000},
    "ZOMBIE":           {"COMMON": 30_000,  "UNCOMMON": 100_000,  "RARE": 400_000,    "EPIC": 1_500_000,   "LEGENDARY": 5_000_000},
    "SKELETON":         {"COMMON": 30_000,  "UNCOMMON": 100_000,  "RARE": 350_000,    "EPIC": 1_200_000,   "LEGENDARY": 4_000_000},
    "CREEPER":          {"COMMON": 20_000,  "UNCOMMON": 80_000,   "RARE": 300_000,    "EPIC": 1_000_000,   "LEGENDARY": 3_500_000},
    "GOLEM":            {"COMMON": 30_000,  "UNCOMMON": 100_000,  "RARE": 350_000,    "EPIC": 1_200_000,   "LEGENDARY": 4_000_000},
    "PIGMAN":           {"UNCOMMON": 80_000, "RARE": 300_000,     "EPIC": 1_000_000,  "LEGENDARY": 3_500_000},
    "GHOUL":            {"UNCOMMON": 60_000, "RARE": 250_000,     "EPIC": 800_000,    "LEGENDARY": 2_500_000},
    "WITHER SKELETON":  {"UNCOMMON": 200_000,"RARE": 700_000,     "EPIC": 2_500_000,  "LEGENDARY": 9_000_000},
    "MAGMA CUBE":       {"COMMON": 40_000,  "UNCOMMON": 150_000,  "RARE": 500_000,    "EPIC": 2_000_000,   "LEGENDARY": 7_000_000},
    "SILVERFISH":       {"COMMON": 30_000,  "UNCOMMON": 100_000,  "RARE": 350_000,    "EPIC": 1_200_000,   "LEGENDARY": 4_500_000},
    "ENDERMITE":        {"UNCOMMON": 100_000,"RARE": 350_000,     "EPIC": 1_200_000,  "LEGENDARY": 4_000_000},
    "GUARDIAN":         {"UNCOMMON": 150_000,"RARE": 500_000,     "EPIC": 2_000_000,  "LEGENDARY": 7_000_000},
    # ── Fishing pets ──────────────────────────────────────────────────────
    "SQUID":            {"COMMON": 20_000,  "UNCOMMON": 80_000,   "RARE": 300_000,    "EPIC": 1_200_000,   "LEGENDARY": 4_000_000},
    "FLYING FISH":      {"COMMON": 100_000, "UNCOMMON": 400_000,  "RARE": 1_500_000,  "EPIC": 6_000_000,   "LEGENDARY": 20_000_000},
    "MEGALODON":        {"RARE": 1_000_000, "EPIC": 4_000_000,   "LEGENDARY": 15_000_000},
    "DOLPHIN":          {"UNCOMMON": 300_000,"RARE": 1_200_000,   "EPIC": 4_500_000,  "LEGENDARY": 15_000_000},
    "JELLYFISH":        {"EPIC": 3_000_000, "LEGENDARY": 10_000_000},
    "BLUE WHALE":       {"RARE": 2_000_000, "EPIC": 8_000_000,   "LEGENDARY": 25_000_000},
    "OCELOT":           {"COMMON": 30_000,  "UNCOMMON": 100_000,  "RARE": 400_000,    "EPIC": 1_500_000,   "LEGENDARY": 5_000_000},
    # ── Mining pets ───────────────────────────────────────────────────────
    "ROCK":             {"COMMON": 100_000, "UNCOMMON": 400_000,  "RARE": 1_500_000,  "EPIC": 6_000_000,   "LEGENDARY": 20_000_000},
    "MOLE":             {"COMMON": 20_000,  "UNCOMMON": 70_000,   "RARE": 250_000,    "EPIC": 800_000,     "LEGENDARY": 2_500_000},
    "SILVERFISH":       {"COMMON": 30_000,  "UNCOMMON": 100_000,  "RARE": 350_000,    "EPIC": 1_200_000,   "LEGENDARY": 4_500_000},
    "ARMADILLO":        {"COMMON": 50_000,  "UNCOMMON": 180_000,  "RARE": 700_000,    "EPIC": 2_500_000,   "LEGENDARY": 8_000_000},
    "BAL":              {"EPIC": 5_000_000, "LEGENDARY": 18_000_000},
    # ── Farming / foraging pets ───────────────────────────────────────────
    "BEE":              {"UNCOMMON": 150_000,"RARE": 600_000,     "EPIC": 2_000_000,  "LEGENDARY": 8_000_000},
    "ELEPHANT":         {"COMMON": 40_000,  "UNCOMMON": 150_000,  "RARE": 550_000,    "EPIC": 2_000_000,   "LEGENDARY": 7_000_000},
    "RABBIT":           {"COMMON": 20_000,  "UNCOMMON": 70_000,   "RARE": 250_000,    "EPIC": 900_000,     "LEGENDARY": 3_000_000},
    "PIG":              {"COMMON": 15_000,  "UNCOMMON": 60_000,   "RARE": 200_000,    "EPIC": 700_000,     "LEGENDARY": 2_500_000},
    "CHICKEN":          {"COMMON": 10_000,  "UNCOMMON": 40_000,   "RARE": 150_000,    "EPIC": 500_000,     "LEGENDARY": 1_500_000},
    "COW":              {"COMMON": 10_000,  "UNCOMMON": 40_000,   "RARE": 150_000,    "EPIC": 500_000,     "LEGENDARY": 1_500_000},
    "SHEEP":            {"COMMON": 10_000,  "UNCOMMON": 40_000,   "RARE": 150_000,    "EPIC": 500_000,     "LEGENDARY": 1_500_000},
    "MUSHROOM COW":     {"COMMON": 10_000,  "UNCOMMON": 40_000,   "RARE": 150_000,    "EPIC": 500_000,     "LEGENDARY": 2_000_000},
    "SNAIL":            {"COMMON": 30_000,  "UNCOMMON": 100_000,  "RARE": 350_000,    "EPIC": 1_200_000,   "LEGENDARY": 4_000_000},
    # ── Dungeon / prestige pets ───────────────────────────────────────────
    "ENDER DRAGON":     {"EPIC": 80_000_000, "LEGENDARY": 250_000_000},
    "GOLDEN DRAGON":    {"LEGENDARY": 800_000_000},
    "GRIFFIN":          {"RARE": 2_000_000, "EPIC": 10_000_000,   "LEGENDARY": 80_000_000},
    "JERRY":            {"LEGENDARY": 200_000_000},
    "BABY YETI":        {"RARE": 1_500_000, "EPIC": 5_000_000,    "LEGENDARY": 20_000_000},
    "GIRAFFE":          {"RARE": 2_000_000, "EPIC": 8_000_000,    "LEGENDARY": 30_000_000},
    "PHOENIX":          {"RARE": 3_000_000, "EPIC": 12_000_000,   "LEGENDARY": 40_000_000},
    "WYVERN":           {"RARE": 3_000_000, "EPIC": 12_000_000,   "LEGENDARY": 40_000_000},
    "BLACK CAT":        {"EPIC": 10_000_000,"LEGENDARY": 20_000_000},
    "TURTLE":           {"RARE": 1_000_000, "EPIC": 4_000_000,    "LEGENDARY": 12_000_000},
    "FLOWER":           {"RARE": 800_000,   "EPIC": 3_000_000,    "LEGENDARY": 10_000_000},
    # ── General-purpose ───────────────────────────────────────────────────
    "HORSE":            {"RARE": 500_000,   "EPIC": 2_000_000,    "LEGENDARY": 8_000_000},
    "CAT":              {"COMMON": 20_000,  "UNCOMMON": 70_000,   "RARE": 250_000,    "EPIC": 900_000,     "LEGENDARY": 3_000_000},
    "PARROT":           {"RARE": 1_500_000, "EPIC": 6_000_000,    "LEGENDARY": 20_000_000},
    "MONKEY":           {"COMMON": 20_000,  "UNCOMMON": 70_000,   "RARE": 250_000,    "EPIC": 800_000,     "LEGENDARY": 3_000_000},
    "SNOWMAN":          {"EPIC": 2_000_000, "LEGENDARY": 8_000_000},
    "GLACIAL":          {"EPIC": 3_000_000, "LEGENDARY": 12_000_000},
}


def _estimate_pet_value(pet: dict) -> float:
    """
    Estimate pet value using level-interpolated pricesV2.json prices.

    Priority:
      1. pricesV2 linear interpolation between lv1 and lv100 price points
         (same method as SkyCrypt / skyhelper-networth)
      2. Our own AH BIN cache (level-scaled by multiplier)
      3. Hardcoded fallback table (level-scaled)
    """
    ptype = str(pet.get("type") or "").upper()
    tier  = str(pet.get("tier") or "COMMON").upper()
    exp   = float(pet.get("exp") or 0)
    level = _pet_level_from_xp(exp, tier)

    # ── 1. pricesV2 level-interpolated price ──────────────────────────────
    if _p2.ready:
        p2val = _p2.pet_price(ptype, tier, level)
        if p2val > 0:
            return p2val

    # ── 2. Our AH BIN cache (level multiplier applied) ────────────────────
    mult     = _pet_level_multiplier(level)
    live_key = f"PET_{ptype}_{tier}"
    live_base = _live_prices.get(live_key, 0)
    if live_base > 0:
        return live_base * mult

    # ── 3. Hardcoded fallback (max-level prices) ──────────────────────────
    friendly = ptype.replace("_", " ")
    base = PET_BASE_VALUES.get(friendly, {}).get(tier, 50_000)
    return base * mult


# ── Item upgrade valuation ─────────────────────────────────────────────────────
_STAR_KEYS = [
    "FIRST_MASTER_STAR",  "SECOND_MASTER_STAR", "THIRD_MASTER_STAR",
    "FOURTH_MASTER_STAR", "FIFTH_MASTER_STAR",
]



# Multipliers matching skyhelper-networth APPLICATION_WORTH constants
_WORTH_HPB        = 1.00
_WORTH_FUMING     = 0.60   # fuming books apply at 60 % of book price
_WORTH_RECOMB     = 0.80
_WORTH_STAR       = 1.00
_WORTH_ENCHANT    = 0.85   # standard enchant application worth
_WORTH_ENCHANT_OVERRIDES: dict[str, float] = {
    # Ultimate enchants with low demand discount
    "COUNTER_STRIKE":        0.20,
    "BIG_BRAIN":             0.35,
    "ULTIMATE_INFERNO":      0.35,
    "OVERLOAD":              0.35,
    "ULTIMATE_SOUL_EATER":   0.35,
    "ULTIMATE_FATAL_TEMPO":  0.65,
}
# Stacking enchants — always priced at level 1 (their value doesn't scale with stacks)
_STACKING_ENCHANTS = frozenset({
    "EXPERTISE", "COMPACT", "CULTIVATING", "CHAMPION",
    "HECATOMB", "TOXOPHILITE", "ABSORB",
})


def _enc_price(name: str, level: int) -> float:
    """Return the market price of one enchantment, pricesV2 preferred."""
    enc_key = f"ENCHANTMENT_{name.upper()}_{level}"
    p = _p2.get(enc_key) if _p2.ready else 0.0
    if p <= 0:
        p = _live_prices.get(enc_key, 0.0)
    return p


def _upgrade_value(it: dict) -> float:
    """
    Estimate coin value added by upgrades on top of the item's base price.

    Follows the skyhelper-networth application-worth approach:
      - pricesV2 item prices represent an un-upgraded baseline
      - each upgrade is valued at its market price × APPLICATION_WORTH multiplier
      - enchantments on regular items ARE included at 0.85 × book price
        (same as SkyCrypt — enchantments genuinely add value above the baseline)
    """
    v = 0.0
    item_id = str(it.get("id") or "")

    # ── Hot Potato Books ──────────────────────────────────────────────────
    hpb = int(it.get("hot_potato_count") or 0)
    if hpb and item_id != "ENCHANTED_BOOK":
        hpb_p    = (_p2.get("HOT_POTATO_BOOK")    or _live_prices.get("HOT_POTATO_BOOK",    _KNOWN_VALUES.get("HOT_POTATO_BOOK",    600_000)))
        fuming_p = (_p2.get("FUMING_POTATO_BOOK") or _live_prices.get("FUMING_POTATO_BOOK", _KNOWN_VALUES.get("FUMING_POTATO_BOOK", 12_000_000)))
        v += min(hpb, 10) * hpb_p * _WORTH_HPB
        v += max(0, hpb - 10) * fuming_p * _WORTH_FUMING

    # ── Recombobulator ────────────────────────────────────────────────────
    if int(it.get("rarity_upgrades") or 0) and item_id != "ENCHANTED_BOOK":
        rc_p = (_p2.get("RECOMBOBULATOR_3000") or
                _live_prices.get("RECOMBOBULATOR_3000", _KNOWN_VALUES.get("RECOMBOBULATOR_3000", 6_000_000)))
        v += rc_p * _WORTH_RECOMB

    # ── Dungeon master stars ──────────────────────────────────────────────
    for i in range(min(int(it.get("dungeon_item_level") or 0), 5)):
        star_p = (_p2.get(_STAR_KEYS[i]) or
                  _live_prices.get(_STAR_KEYS[i], _KNOWN_VALUES.get(_STAR_KEYS[i], 0)))
        v += star_p * _WORTH_STAR

    # ── Enchantments ──────────────────────────────────────────────────────
    # Applied to ALL items (not just books). pricesV2 base prices are for
    # un-enchanted items, so enchants are genuinely additive at 0.85×.
    for enc_name, enc_level in (it.get("enchantments") or {}).items():
        enc_upper = enc_name.upper()
        # Stacking enchants price as lv-1 regardless of actual level
        lookup_level = 1 if enc_upper in _STACKING_ENCHANTS else enc_level
        price = _enc_price(enc_upper, lookup_level)
        if price <= 0:
            continue
        mult = _WORTH_ENCHANT_OVERRIDES.get(enc_upper, _WORTH_ENCHANT)
        v += price * mult

    return v


def _ah_name_lookup(display_name: str) -> float:
    """
    Last-resort: search the live AH index by display name and return the
    lowest BIN price found, or 0 if nothing matches.
    Only called when the item_id lookup returns 0.
    """
    if not _ah_index.ready or not display_name:
        return 0.0
    q = display_name.lower().strip()
    best = 0.0
    for a in _ah_index._auctions:
        if not a.get('bin'):
            continue
        if q not in a.get('item_name', '').lower():
            continue
        price = float(a.get('starting_bid', 0) or 0)
        if price <= 0:
            continue
        if best == 0.0 or price < best:
            best = price
    return best


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
        try:
            save = int(((p.get("members") or {}).get(clean_uuid) or {}).get("last_save") or 0)
        except Exception:
            save = 0
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
        raise _upstream_exc(e)

    if isinstance(profiles_result, Exception):
        raise _upstream_exc(profiles_result)
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
            full_member  = ((full_profile.get("members") or {}).get(clean_uuid) or {})
            last_save_ms = int(full_member.get("last_save") or 0)
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
        raise _upstream_exc(e)

    target = full_resp.get("profile") or full_resp
    if not target:
        raise HTTPException(status_code=404, detail="Profile not found")

    try:
        stats = analyze_profile(target, uuid)
        error = None
    except Exception as exc:
        stats, error = None, str(exc)

    clean_uuid   = uuid.replace("-", "")
    try:
        last_save_ms = int(((target.get("members") or {}).get(clean_uuid) or {}).get("last_save") or 0)
    except Exception:
        last_save_ms = 0

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
            raise _upstream_exc(e)
        profiles      = profiles_data.get("profiles", []) or []
        active_stub   = _find_active_profile(profiles, uuid.replace("-", ""))
        if not active_stub:
            raise HTTPException(status_code=404, detail="No profile found")
        profile_id = active_stub["profile_id"]

    # ── Always fetch FULL single-profile data (includes inventory NBT) ────
    try:
        full_resp = await get_skyblock_profile(api_key, profile_id)
    except Exception as e:
        raise _upstream_exc(e)

    profile = full_resp.get("profile") or full_resp
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    clean_uuid = uuid.replace("-", "")
    member: dict = ((profile.get("members") or {}).get(clean_uuid) or {})

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
        """Returns (total_value, valued_only, all_with_value_field).
        Each annotated item gains: value, base_value, upgrades_value.

        Price priority per item:
          1. pricesV2.json (same source as SkyCrypt — most accurate)
          2. Live bazaar / AH BIN cache
          3. _KNOWN_VALUES fallback
          4. AH display-name last-resort search
        """
        valued, all_ann = [], []
        total = 0.0
        for it in items:
            item_id  = it["id"]
            count    = it["count"]
            fallback = _KNOWN_VALUES.get(item_id, 0)

            # pricesV2 has the most accurate median prices
            p2_price = _p2.get(item_id) if _p2.ready else 0.0
            if p2_price > 0:
                base_val = p2_price * count
            else:
                live_p   = _live_prices.get(item_id, fallback)
                base_val = live_p * count
                # Last-resort: AH name search
                if base_val == 0 and it.get("name"):
                    base_val = _ah_name_lookup(it["name"]) * count

            upg_val = _upgrade_value(it)
            val     = base_val + upg_val
            ann     = {**it, "value": round(val), "base_value": round(base_val), "upgrades_value": round(upg_val)}
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

    # Banking: check profile-level co-op bank, then member-level personal bank
    _banking_obj  = profile.get("banking") or {}
    _member_prof  = member.get("profile") or {}
    banking = float(
        _banking_obj.get("balance")
        or _member_prof.get("bank_account")
        or member.get("bank_account")
        or 0
    )

    # ── Pets ──────────────────────────────────────────────────────────────
    # v2: member.pets_data.pets  |  v1: member.pets
    pets_raw   = (member.get("pets_data") or {}).get("pets", []) or member.get("pets", []) or []
    pets_value = sum(_estimate_pet_value(p) for p in pets_raw)
    pets_list  = [
        {
            "type":      p.get("type"),
            "tier":      p.get("tier"),
            # Always compute level from XP — the 'level' field in the API response
            # is unreliable and often missing; XP is the authoritative source.
            "level":     _pet_level_from_xp(float(p.get("exp") or 0),
                                             str(p.get("tier") or "COMMON").upper()),
            "exp":       round(float(p.get("exp") or 0)),
            "active":    p.get("active", False),
            "held_item": p.get("heldItem"),
            "skin":      p.get("skin"),
            "candy":     p.get("candyUsed", 0),
            "value":     _estimate_pet_value(p),
        }
        for p in sorted(pets_raw, key=_estimate_pet_value, reverse=True)[:20]
    ]

    # ── Decode all inventory slots ────────────────────────────────────────

    # Main 36-slot inventory
    inv_items  = _decode_inventory(_inv_data("inv_contents", "inv_contents"))

    # Ender chest: decode with slot positions so we can split into pages (54 slots/page)
    _ec_slots  = _decode_inventory_slots(_inv_data("ender_chest_contents", "ender_chest_contents"))
    ec_items   = [s for s in _ec_slots if s]

    # Wardrobe (4 pages of armour sets, 9 sets/page = 36 sets total)
    # Slot layout per page: 4 rows × 9 cols, row-major. Set N in page = cols 0-8.
    # Each set = slots [col, col+9, col+18, col+27] within that page's 36 slots.
    _ward_slots = _decode_inventory_slots(_inv_data("wardrobe_contents", "wardrobe_contents"))
    ward_items  = [s for s in _ward_slots if s]

    # v2 bag_contents — dict keyed by bag type, each value {"data": base64}
    _bag_contents: dict = inv_v2.get("bag_contents") or {}

    def _bag_data(bag_key: str) -> str:
        return (_bag_contents.get(bag_key) or {}).get("data", "") \
               or _inv_data(bag_key, bag_key)

    talisman_raw = _decode_inventory(_bag_data("talisman_bag"))
    fishing_raw  = _decode_inventory(_bag_data("fishing_bag"))
    potion_raw   = _decode_inventory(_bag_data("potion_bag"))
    quiver_raw   = _decode_inventory(_bag_data("quiver"))

    # Backpack: decode each physical backpack slot separately, preserving per-backpack structure
    bp_raw: list[dict] = []
    backpack_slots: list[dict] = []
    bp_contents = inv_v2.get("backpack_contents") or member.get("backpack_contents") or {}
    if isinstance(bp_contents, dict):
        for slot_key in sorted(bp_contents.keys(), key=lambda k: int(k) if str(k).isdigit() else 999):
            slot_node = bp_contents.get(slot_key)
            if not isinstance(slot_node, dict):
                continue
            slot_items = _decode_inventory(slot_node.get("data", ""))
            if not slot_items:
                continue
            s_val, _, s_all = price_items(slot_items)
            bp_raw.extend(slot_items)
            backpack_slots.append({
                "slot":  int(slot_key) if str(slot_key).isdigit() else slot_key,
                "items": sorted(s_all, key=lambda x: x["value"], reverse=True),
                "total": round(s_val),
            })

    vault_raw = _decode_inventory(_inv_data("personal_vault_contents", "personal_vault_contents"))
    equip_raw = _decode_inventory(_inv_data_v2_only("equipment_contents"))

    # ── Price all inventory sources ───────────────────────────────────────
    def _top(lst: list[dict], n: int) -> list[dict]:
        return sorted(lst, key=lambda x: x["value"], reverse=True)[:n]

    inv_val,      inv_valued,      inv_all      = price_items(inv_items)
    ec_val,       ec_valued,       ec_all_flat  = price_items(ec_items)
    ward_val,     ward_valued,     ward_all     = price_items(ward_items)
    talisman_val, talisman_valued, talisman_all = price_items(talisman_raw)
    bp_val,       bp_valued,       bp_all       = price_items(bp_raw)
    vault_val,    vault_valued,    vault_all    = price_items(vault_raw)
    fishing_val,  _,               fishing_all  = price_items(fishing_raw)
    potion_val,   _,               potion_all   = price_items(potion_raw)
    quiver_val,   _,               quiver_all   = price_items(quiver_raw)
    equip_val,    _,               equip_all    = price_items(equip_raw)

    # ── Ender chest pages (54 slots/page) ─────────────────────────────────
    _SLOTS_PER_PAGE = 54
    ec_pages: list[dict] = []
    for _page_idx in range(0, max(1, len(_ec_slots)), _SLOTS_PER_PAGE):
        _chunk = _ec_slots[_page_idx:_page_idx + _SLOTS_PER_PAGE]
        _page_items = [s for s in _chunk if s]
        if not _page_items:
            continue
        _pv, _, _pa = price_items(_page_items)
        ec_pages.append({
            "page":  _page_idx // _SLOTS_PER_PAGE + 1,
            "items": sorted(_pa, key=lambda x: x["value"], reverse=True),
            "total": round(_pv),
        })

    # ── Wardrobe sets ─────────────────────────────────────────────────────
    # Page layout: 36 slots per page, 9 sets × 4 rows (H/C/L/B)
    # Set col N within a page: slots N, N+9, N+18, N+27
    wardrobe_sets: list[dict] = []
    _WARD_ROWS = 4
    _WARD_COLS = 9
    _WARD_PAGE = _WARD_ROWS * _WARD_COLS  # 36
    for _pg in range(len(_ward_slots) // _WARD_PAGE + 1):
        _page_base = _pg * _WARD_PAGE
        for _col in range(_WARD_COLS):
            _set_slots = [_ward_slots[_page_base + _col + _row * _WARD_COLS]
                          if _page_base + _col + _row * _WARD_COLS < len(_ward_slots) else None
                          for _row in range(_WARD_ROWS)]
            _set_items = [s for s in _set_slots if s]
            if not _set_items:
                continue
            _sv, _, _sa = price_items(_set_items)
            wardrobe_sets.append({
                "set":   _pg * _WARD_COLS + _col + 1,
                "items": _sa,
                "total": round(_sv),
            })

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
        # Flat sorted lists (used by some views / backwards compat)
        "inv_all":       _top(inv_all,       100),
        "ec_all":        _top(ec_all_flat,   200),
        "ward_all":      _top(ward_all,      100),
        "talisman_all":  _top(talisman_all,  100),
        "backpack_all":  _top(bp_all,        200),
        "vault_all":     _top(vault_all,      50),
        "fishing_all":   _top(fishing_all,    50),
        "equipment_all": _top(equip_all,      20),
        # Structured per-container views
        "ec_pages":       ec_pages,
        "backpack_slots": backpack_slots,
        "wardrobe_sets":  wardrobe_sets,
        "minion_count":   minion_count,
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
        raise _upstream_exc(e)

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
