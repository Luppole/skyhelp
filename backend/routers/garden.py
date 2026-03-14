"""
Farming Fortune & BPS upgrade optimizer.

GET /garden/farming-upgrades/{username}
  ?profile_id=...          (optional — uses most-recently-active profile if omitted)
  ?overrides=<json>        (optional — your current enchant levels)
    e.g. '{"turbo_wheat":3,"dedication":2,"harvesting":4,"sugar_rush":1}'

Returns every possible enchant upgrade ranked by farming-fortune per million coins,
along with BPS upgrades ranked by (approximate) BPS gain per million coins.
"""

import json
import logging
from fastapi import APIRouter, HTTPException, Header, Request, Query
from typing import Optional

from ..utils.hypixel import (
    get_player_uuid, get_skyblock_profiles, get_bazaar, get_server_api_key,
)
from ..limiter import limiter

log = logging.getLogger(__name__)
router = APIRouter(prefix="/garden", tags=["garden"])

# ── Farming skill XP table ────────────────────────────────────────────────────
# Index = level, value = cumulative XP required to reach that level (levels 0–60)
_FARMING_XP: list[int] = [
    0, 50, 125, 235, 395, 625, 955, 1_425, 2_095, 3_045, 4_385,
    6_265, 8_885, 12_525, 17_525, 24_325, 33_475, 45_675, 61_825, 83_075, 110_725,
    146_225, 191_525, 248_725, 320_425, 409_525, 519_725, 655_125, 820_525,
    1_021_425, 1_264_525, 1_557_625, 1_909_825, 2_332_325, 2_837_325, 3_438_325,
    4_152_325, 4_998_325, 5_998_325, 7_171_325, 8_541_325, 10_141_325, 12_011_325,
    14_206_325, 16_771_325, 19_771_325, 23_271_325, 27_471_325, 32_471_325,
    38_471_325, 45_671_325,                                               # lv 50
    245_671_325, 445_671_325, 645_671_325, 845_671_325, 1_045_671_325,   # lv 51-55
    1_245_671_325, 1_445_671_325, 1_645_671_325, 1_845_671_325, 2_045_671_325,  # 56-60
]

def _farming_level(xp: float) -> tuple[int, float]:
    """(level, xp_into_level) for cumulative XP."""
    for lvl in range(len(_FARMING_XP) - 1, -1, -1):
        if xp >= _FARMING_XP[lvl]:
            return lvl, xp - _FARMING_XP[lvl]
    return 0, 0.0

def _xp_to_next_level(xp: float) -> Optional[float]:
    level, into = _farming_level(xp)
    if level >= len(_FARMING_XP) - 1:
        return None
    return _FARMING_XP[level + 1] - _FARMING_XP[level] - into

# ── Crop milestone thresholds (cumulative collection per tier) ────────────────
# 46 tiers — uses wheat values as reference; other crops are similar at this scale
_MILESTONE_TIERS: list[int] = [
    100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000,
    200_000, 400_000, 750_000, 1_500_000, 3_000_000, 5_000_000, 10_000_000,
    20_000_000, 40_000_000, 75_000_000, 150_000_000, 300_000_000, 500_000_000,
    1_000_000_000, 2_000_000_000, 5_000_000_000, 10_000_000_000, 15_000_000_000,
    20_000_000_000, 30_000_000_000, 50_000_000_000, 75_000_000_000,
    100_000_000_000, 200_000_000_000, 300_000_000_000, 500_000_000_000,
    750_000_000_000, 1_000_000_000_000, 1_500_000_000_000, 2_000_000_000_000,
    3_000_000_000_000, 5_000_000_000_000, 7_500_000_000_000, 10_000_000_000_000,
    15_000_000_000_000, 20_000_000_000_000,
]

def _milestone_tier(collected: float) -> int:
    """1-based milestone tier for a collection amount (0 if below tier 1)."""
    for i, threshold in enumerate(_MILESTONE_TIERS):
        if collected < threshold:
            return i
    return len(_MILESTONE_TIERS)

def _next_milestone_threshold(collected: float) -> Optional[int]:
    """How many more crops needed to hit the next milestone tier."""
    tier = _milestone_tier(collected)
    if tier >= len(_MILESTONE_TIERS):
        return None
    return int(_MILESTONE_TIERS[tier] - collected)

# ── Garden level XP thresholds (10 levels — each ~5 000 XP apart approx) ─────
_GARDEN_XP: list[int] = [
    0, 1_000, 2_500, 5_000, 9_000, 14_000, 20_000, 27_000, 35_000, 45_000,
    58_000, 74_000, 93_000, 116_000, 144_000, 177_000, 216_000, 261_000,
    313_000, 373_000, 442_000,  # level 20
]

def _garden_level(xp: float) -> int:
    for lvl in range(len(_GARDEN_XP) - 1, -1, -1):
        if xp >= _GARDEN_XP[lvl]:
            return lvl
    return 0

# ── Crop definitions ──────────────────────────────────────────────────────────
# (api_resource_key, turbo_bz_suffix, display_name)
CROPS: list[tuple[str, str, str]] = [
    ("WHEAT",              "TURBO_WHEAT",     "Wheat"),
    ("CARROT_ITEM",        "TURBO_CARROT",    "Carrot"),
    ("POTATO_ITEM",        "TURBO_POTATO",    "Potato"),
    ("PUMPKIN",            "TURBO_PUMPKIN",   "Pumpkin"),
    ("MELON",              "TURBO_MELON",     "Melon"),
    ("MUSHROOM_COLLECTION","TURBO_MUSHROOMS", "Mushroom"),
    ("INK_SACK:3",         "TURBO_COCOA",     "Cocoa Beans"),
    ("SUGAR_CANE",         "TURBO_CANE",      "Sugar Cane"),
    ("NETHER_STALK",       "TURBO_WARTS",     "Nether Wart"),
    ("CACTUS",             "TURBO_CACTI",     "Cactus"),
]

# Alternative resource key spellings the API sometimes uses
_CROP_ALIASES: dict[str, list[str]] = {
    "MELON":              ["MELON_SLICE", "MELON"],
    "MUSHROOM_COLLECTION":["MUSHROOM_COLLECTION", "RED_MUSHROOM", "BROWN_MUSHROOM"],
    "INK_SACK:3":         ["INK_SACK:3", "COCOA_BEANS"],
}

def _crop_collected(resources: dict, api_key: str) -> float:
    keys = _CROP_ALIASES.get(api_key, [api_key])
    return float(max(resources.get(k, 0) for k in keys))

# ── Dedication FF formula ─────────────────────────────────────────────────────
_DEDICATION_MULT = {1: 0.5, 2: 0.75, 3: 1.0, 4: 2.0}

def _dedication_ff(level: int, milestone_tier: int) -> float:
    return _DEDICATION_MULT.get(level, 0.0) * milestone_tier

# ── Collect all BZ item IDs we'll need to price ───────────────────────────────

def _all_bz_ids() -> list[str]:
    ids: list[str] = []
    for _, bz_suffix, _ in CROPS:
        for lvl in range(1, 6):
            ids.append(f"ENCHANTMENT_{bz_suffix}_{lvl}")
    for lvl in range(1, 5):
        ids.append(f"ENCHANTMENT_DEDICATION_{lvl}")
    for lvl in range(1, 7):
        ids.append(f"ENCHANTMENT_HARVESTING_{lvl}")
    for lvl in range(1, 6):
        ids.append(f"ENCHANTMENT_GREEN_THUMB_{lvl}")
    for lvl in range(1, 4):
        ids.append(f"ENCHANTMENT_SUGAR_RUSH_{lvl}")
    return ids

async def _bz_prices(item_ids: list[str]) -> dict[str, float]:
    try:
        raw = await get_bazaar()
        products = raw.get("products", {})
        out: dict[str, float] = {}
        for iid in item_ids:
            qs = products.get(iid, {}).get("quick_status", {})
            p = float(qs.get("buyPrice", 0))
            if p > 0:
                out[iid] = p
        return out
    except Exception as exc:
        log.warning("BZ price fetch error: %s", exc)
        return {}

# ── Upgrade builder ───────────────────────────────────────────────────────────

def _make_upgrade(
    uid: str, name: str, category: str, crop: Optional[str],
    from_level: int, to_level: int,
    ff_gain: float, bps_gain: float,
    cost: float, bz_item_id: str, note: Optional[str] = None,
) -> Optional[dict]:
    """Return None if the upgrade costs nothing (not in BZ) or has no gain."""
    if cost <= 0 or (ff_gain <= 0 and bps_gain <= 0):
        return None
    return {
        "id":           uid,
        "name":         name,
        "category":     category,
        "crop":         crop,
        "from_level":   from_level,
        "to_level":     to_level,
        "ff_gain":      round(ff_gain, 2),
        "bps_gain":     round(bps_gain, 3),
        "cost_coins":   round(cost),
        "ff_per_million":  round(ff_gain / cost * 1_000_000, 3) if ff_gain > 0 else 0,
        "bz_item_id":   bz_item_id,
        "note":         note,
    }


def _build_upgrades(
    overrides: dict[str, int],
    crop_milestones: dict[str, int],  # api_key -> milestone tier
    prices: dict[str, float],
) -> list[dict]:
    upgrades: list[dict] = []

    # 1. Turbo enchants (crop-specific, I-V, +5 FF each)
    for api_key, bz_suffix, crop_name in CROPS:
        enc_key = f"turbo_{bz_suffix.lower().replace('turbo_', '')}"
        current = overrides.get(enc_key, 0)
        for to_lvl in range(current + 1, 6):
            bz_id = f"ENCHANTMENT_{bz_suffix}_{to_lvl}"
            cost = prices.get(bz_id, 0)
            u = _make_upgrade(
                uid=f"{enc_key}_{to_lvl}",
                name=f"Turbo-{crop_name} {_roman(to_lvl)}",
                category="fortune",
                crop=crop_name,
                from_level=to_lvl - 1,
                to_level=to_lvl,
                ff_gain=5.0,
                bps_gain=0.0,
                cost=cost,
                bz_item_id=bz_id,
                note=f"+5 FF (crop-specific)",
            )
            if u:
                upgrades.append(u)

    # 2. Dedication (I-IV) — FF scales with milestone tier of the crop being farmed
    #    We show one entry per level upgrade using the average milestone tier
    avg_milestone = (sum(crop_milestones.values()) / len(crop_milestones)) if crop_milestones else 1
    best_milestone = max(crop_milestones.values()) if crop_milestones else 1
    ded_current = overrides.get("dedication", 0)
    for to_lvl in range(ded_current + 1, 5):
        bz_id = f"ENCHANTMENT_DEDICATION_{to_lvl}"
        cost = prices.get(bz_id, 0)
        ff_gain = _dedication_ff(to_lvl, best_milestone) - _dedication_ff(to_lvl - 1, best_milestone)
        # Also show min/max range
        ff_avg = _dedication_ff(to_lvl, avg_milestone) - _dedication_ff(to_lvl - 1, avg_milestone)
        note = (
            f"+{ff_gain:.1f} FF (best crop @ tier {best_milestone}) / "
            f"+{ff_avg:.1f} FF (avg @ tier {avg_milestone:.0f})"
        )
        u = _make_upgrade(
            uid=f"dedication_{to_lvl}",
            name=f"Dedication {_roman(to_lvl)}",
            category="fortune",
            crop=None,
            from_level=to_lvl - 1,
            to_level=to_lvl,
            ff_gain=ff_gain,
            bps_gain=0.0,
            cost=cost,
            bz_item_id=bz_id,
            note=note,
        )
        if u:
            upgrades.append(u)

    # 3. Harvesting (I-VI, +4 FF per level)
    harv_current = overrides.get("harvesting", 0)
    for to_lvl in range(harv_current + 1, 7):
        bz_id = f"ENCHANTMENT_HARVESTING_{to_lvl}"
        cost = prices.get(bz_id, 0)
        u = _make_upgrade(
            uid=f"harvesting_{to_lvl}",
            name=f"Harvesting {_roman(to_lvl)}",
            category="fortune",
            crop=None,
            from_level=to_lvl - 1,
            to_level=to_lvl,
            ff_gain=4.0,
            bps_gain=0.0,
            cost=cost,
            bz_item_id=bz_id,
            note="+4 FF (all crops)",
        )
        if u:
            upgrades.append(u)

    # 4. Green Thumb (I-V, +5 FF per level)
    gt_current = overrides.get("green_thumb", 0)
    for to_lvl in range(gt_current + 1, 6):
        bz_id = f"ENCHANTMENT_GREEN_THUMB_{to_lvl}"
        cost = prices.get(bz_id, 0)
        u = _make_upgrade(
            uid=f"green_thumb_{to_lvl}",
            name=f"Green Thumb {_roman(to_lvl)}",
            category="fortune",
            crop=None,
            from_level=to_lvl - 1,
            to_level=to_lvl,
            ff_gain=5.0,
            bps_gain=0.0,
            cost=cost,
            bz_item_id=bz_id,
            note="+5 FF (all crops)",
        )
        if u:
            upgrades.append(u)

    # 5. Sugar Rush (BPS enchant for Rancher's Boots, I-III)
    sr_current = overrides.get("sugar_rush", 0)
    for to_lvl in range(sr_current + 1, 4):
        bz_id = f"ENCHANTMENT_SUGAR_RUSH_{to_lvl}"
        cost = prices.get(bz_id, 0)
        u = _make_upgrade(
            uid=f"sugar_rush_{to_lvl}",
            name=f"Sugar Rush {_roman(to_lvl)}",
            category="bps",
            crop=None,
            from_level=to_lvl - 1,
            to_level=to_lvl,
            ff_gain=0.0,
            bps_gain=0.1,
            cost=cost,
            bz_item_id=bz_id,
            note="Requires Rancher's Boots. +~0.1 BPS per level.",
        )
        if u:
            upgrades.append(u)

    # Sort fortune upgrades by ff_per_million desc, then bps upgrades by bps gain
    fortune = sorted([u for u in upgrades if u["category"] == "fortune"],
                     key=lambda u: u["ff_per_million"], reverse=True)
    bps = sorted([u for u in upgrades if u["category"] == "bps"],
                 key=lambda u: u["bps_gain"], reverse=True)
    return fortune + bps


def _roman(n: int) -> str:
    return ["", "I", "II", "III", "IV", "V", "VI"][n] if 0 <= n <= 6 else str(n)


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.get("/farming-upgrades/{username}")
@limiter.limit("20/minute")
async def farming_upgrades(
    request: Request,
    username: str,
    profile_id: Optional[str] = Query(None),
    overrides: Optional[str] = Query(None, description='JSON: {"turbo_wheat":3,"dedication":2,...}'),
    x_api_key: Optional[str] = Header(None, alias="x-api-key"),
):
    """
    Return all available farming fortune & BPS enchant upgrades for a player,
    ranked by FF-per-million-coins. Use `overrides` to specify current enchant levels.
    """
    api_key = get_server_api_key() or x_api_key
    if not api_key:
        raise HTTPException(401, "No Hypixel API key configured.")

    # Parse overrides
    try:
        parsed_overrides: dict[str, int] = json.loads(overrides) if overrides else {}
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(400, "Invalid overrides JSON.")

    # Resolve UUID
    uuid = await get_player_uuid(username)
    if not uuid:
        raise HTTPException(404, f"Player '{username}' not found.")

    # Fetch profiles
    try:
        profiles_data = await get_skyblock_profiles(api_key, uuid)
    except ValueError as e:
        raise HTTPException(502, str(e))

    profiles = profiles_data.get("profiles", []) or []
    if not profiles:
        raise HTTPException(404, "No SkyBlock profiles found.")

    # Select profile
    if profile_id:
        profile = next((p for p in profiles if p.get("profile_id") == profile_id), None)
        if not profile:
            raise HTTPException(404, "Profile not found.")
    else:
        profile = max(
            profiles,
            key=lambda p: p.get("members", {}).get(uuid.replace("-", ""), {}).get("last_save", 0),
        )

    member = profile.get("members", {}).get(uuid.replace("-", ""), {})

    # ── Farming skill level ───────────────────────────────────────────────────
    farming_xp = float(
        member.get("player_data", {}).get("experience", {}).get("SKILL_FARMING", 0)
    )
    farming_level, xp_into = _farming_level(farming_xp)
    xp_to_next = _xp_to_next_level(farming_xp)
    skill_ff = (min(farming_level, 50) * 4) + (max(0, farming_level - 50) * 1)

    # ── Garden data ───────────────────────────────────────────────────────────
    garden = member.get("garden_player_data", {}) or {}
    resources = garden.get("resources_collected", {}) or {}
    garden_xp = float(garden.get("garden_experience", 0))
    garden_lvl = _garden_level(garden_xp)

    crop_milestone_data: dict[str, dict] = {}
    avg_milestone = 0
    for api_key_crop, _, crop_name in CROPS:
        collected = _crop_collected(resources, api_key_crop)
        tier = _milestone_tier(collected)
        nxt = _next_milestone_threshold(collected)
        crop_milestone_data[crop_name] = {
            "collected": int(collected),
            "tier": tier,
            "next_threshold_needed": nxt,
        }
        avg_milestone += tier
    avg_milestone = avg_milestone / len(CROPS) if CROPS else 0

    crop_tiers_by_name = {name: d["tier"] for name, d in crop_milestone_data.items()}

    # ── Fetch BZ prices ───────────────────────────────────────────────────────
    bz_ids = _all_bz_ids()
    prices = await _bz_prices(bz_ids)

    # ── Build upgrades ────────────────────────────────────────────────────────
    upgrades = _build_upgrades(parsed_overrides, crop_tiers_by_name, prices)

    return {
        "player": {
            "name":          username,
            "farming_level": farming_level,
            "farming_xp":    int(farming_xp),
            "xp_to_next":    int(xp_to_next) if xp_to_next else None,
            "skill_ff":      skill_ff,
        },
        "garden": {
            "garden_level":    garden_lvl,
            "avg_milestone":   round(avg_milestone, 1),
            "crop_milestones": crop_milestone_data,
        },
        "profiles": [
            {"profile_id": p.get("profile_id"), "cute_name": p.get("cute_name")}
            for p in profiles
        ],
        "active_profile": {
            "profile_id": profile.get("profile_id"),
            "cute_name":  profile.get("cute_name"),
        },
        "overrides_used":  parsed_overrides,
        "upgrades":        upgrades,
        "upgrade_count":   len(upgrades),
        "total_cost":      sum(u["cost_coins"] for u in upgrades),
        "total_ff_gain":   round(sum(u["ff_gain"] for u in upgrades if u["category"] == "fortune"), 1),
    }
