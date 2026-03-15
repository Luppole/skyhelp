"""
Heavy calculation logic for bazaar flipping and profile analysis.
"""
from typing import Any

# Hypixel taxes
SELL_ORDER_TAX  = 0.0     # Buy orders are tax-free
INSTANT_SELL_TAX = 0.0125  # 1.25% tax when instant-selling into a buy order
SELL_TAX        = 0.0125   # 1.25% tax on sell orders (when someone buys your sell order)

SKILL_NAMES = [
    "farming", "mining", "combat", "foraging", "fishing",
    "enchanting", "alchemy", "carpentry", "runecrafting", "social",
]

SKILL_XP_TABLE = [
    0, 50, 175, 375, 675, 1175, 1925, 2925, 4425, 6425, 9925,
    14925, 22425, 32425, 47425, 67425, 97425, 147425, 222425, 322425, 522425,
    822425, 1222425, 1722425, 2322425, 3022425, 3822425, 4722425, 5722425,
    6822425, 8022425, 9322425, 10722425, 12222425, 13822425, 15522425,
    17322425, 19222425, 21222425, 23322425, 25522425, 27822425, 30222425,
    32722425, 35322425, 38072425, 40972425, 44072425, 47472425, 51172425,
    55172425, 59472425, 64072425, 68972425, 74172425, 79672425, 85472425,
    91572425, 97972425, 104672425,
]

DUNGEON_XP_TABLE = [
    0, 50, 125, 235, 395, 625, 955, 1425, 2095, 3045, 4385, 6275, 8940,
    12700, 17960, 25340, 35640, 50040, 70040, 97640, 135640, 188140, 259640,
    356640, 488640, 668640, 911640, 1239640, 1684640, 2284640, 3084640,
    4149640, 5559640, 7459640, 9959640, 13259640, 17559640, 23159640,
    30359640, 39559640, 51559640,
]


# ---------------------------------------------------------------------------
# Bazaar calculations
# ---------------------------------------------------------------------------

def analyze_bazaar(raw: dict, min_volume: int = 1000, min_margin: float = 2.0) -> list[dict]:
    """
    Returns a sorted list of bazaar flip opportunities.

    Flip strategy: place a buy order at buy_price, then sell via sell order at
    sell_price. The buyer pays sell_price but receives (sell_price * (1 - 0.0125)).

    profit_per_item = sell_price * (1 - SELL_TAX) - buy_price
    """
    products = raw.get("products", {})
    results = []

    for item_id, data in products.items():
        quick = data.get("quick_status", {})

        buy_price: float  = quick.get("buyPrice", 0)
        sell_price: float = quick.get("sellPrice", 0)
        buy_volume: int   = quick.get("buyVolume", 0)
        sell_volume: int  = quick.get("sellVolume", 0)
        buy_moving: int   = quick.get("buyMovingWeek", 0)
        sell_moving: int  = quick.get("sellMovingWeek", 0)

        if buy_price <= 0 or sell_price <= 0:
            continue

        effective_sell = buy_price * (1 - SELL_TAX)
        profit_per     = effective_sell - sell_price
        margin_pct     = (profit_per / sell_price) * 100 if sell_price > 0 else 0

        weekly_flip_volume = min(buy_moving, sell_moving)
        if weekly_flip_volume < min_volume:
            continue
        if margin_pct < min_margin:
            continue

        profit_per_million = (profit_per / sell_price) * 1_000_000 if sell_price > 0 else 0

        results.append({
            "item_id":                  item_id,
            "name":                     _format_name(item_id),
            "buy_price":                round(buy_price, 2),
            "sell_price":               round(sell_price, 2),
            "profit_per_item":          round(profit_per, 2),
            "margin_pct":               round(margin_pct, 2),
            "weekly_volume":            weekly_flip_volume,
            "buy_volume":               buy_volume,
            "sell_volume":              sell_volume,
            "profit_per_million_invested": round(profit_per_million, 2),
        })

    results.sort(key=lambda x: x["profit_per_item"] * x["weekly_volume"], reverse=True)
    return results


def _format_name(item_id: str) -> str:
    return item_id.replace("_", " ").title()


# ---------------------------------------------------------------------------
# Profile analysis
# ---------------------------------------------------------------------------

def xp_to_level(xp: float, table: list[int]) -> tuple[int, float]:
    """Convert raw XP to (level, progress_to_next_pct)."""
    level = 0
    for i, threshold in enumerate(table):
        if xp >= threshold:
            level = i
        else:
            break
    if level < len(table) - 1:
        current_xp = xp - table[level]
        next_xp    = table[level + 1] - table[level]
        progress   = (current_xp / next_xp) * 100
    else:
        progress = 100.0
    return level, round(progress, 1)


def analyze_profile(profile_data: dict, uuid: str) -> dict:
    """
    Extract and compute key stats from a SkyBlock profile member.
    Handles both Hypixel API v1 (flat member keys) and v2 (nested sub-objects).

    v2 layout vs v1:
      skills     → member.player_data.experience.SKILL_FARMING   (v1: experience_skill_farming)
      slayers    → member.slayer.slayer_bosses                    (v1: member.slayer_bosses)
      purse      → member.currencies.coin_purse                   (v1: member.coin_purse)
      fairy      → member.player_data.fairy_souls_collected       (v1: member.fairy_souls_collected)
      deaths     → member.player_data.death_count (int)           (v1: member.death_count)
    """
    members   = profile_data.get("members") or {}
    clean_uuid: str = uuid.replace("-", "")
    member: dict[str, Any] = (members.get(clean_uuid) or {})

    if not member:
        return {"error": "Player data not found in profile"}

    # ── v2 sub-objects ────────────────────────────────────────────────────
    player_data_v2: dict = member.get("player_data") or {}
    currencies_v2:  dict = member.get("currencies")  or {}
    slayer_v2:      dict = member.get("slayer")       or {}

    # ── Skills ────────────────────────────────────────────────────────────
    skill_exp_v2: dict = player_data_v2.get("experience") or {}
    skills:      dict  = {}
    skill_sum   = 0
    skill_count = 0
    for skill in SKILL_NAMES:
        v2_key = f"SKILL_{skill.upper()}"
        v1_key = f"experience_skill_{skill}"
        xp     = float(skill_exp_v2.get(v2_key) or member.get(v1_key) or 0)
        level, progress = xp_to_level(xp, SKILL_XP_TABLE)
        skills[skill] = {"level": level, "xp": xp, "progress": progress}
        if skill not in ("runecrafting", "social", "carpentry"):
            skill_sum   += level
            skill_count += 1

    skill_avg = round(skill_sum / skill_count, 2) if skill_count else 0

    # ── Slayers ───────────────────────────────────────────────────────────
    slayer_bosses: dict = (
        slayer_v2.get("slayer_bosses")
        or member.get("slayer_bosses")
        or {}
    )
    slayers = {}
    for slayer_name in ["zombie", "spider", "wolf", "enderman", "blaze", "vampire"]:
        s_data = slayer_bosses.get(slayer_name) or {}
        xp     = s_data.get("xp", 0) or 0
        slayers[slayer_name] = {
            "xp":    xp,
            "level": _slayer_xp_to_level(slayer_name, xp),
        }

    # ── Dungeons ──────────────────────────────────────────────────────────
    dungeons_data = member.get("dungeons") or {}
    dungeon_types = dungeons_data.get("dungeon_types") or {}
    catacombs     = dungeon_types.get("catacombs") or {}
    cat_xp        = float(catacombs.get("experience") or 0)
    cat_level, cat_progress = xp_to_level(cat_xp, DUNGEON_XP_TABLE)

    classes        = {}
    player_classes = dungeons_data.get("player_classes") or {}
    for cls in ["healer", "mage", "berserk", "archer", "tank"]:
        cls_xp      = float((player_classes.get(cls) or {}).get("experience") or 0)
        lvl, prog   = xp_to_level(cls_xp, DUNGEON_XP_TABLE)
        classes[cls] = {"level": lvl, "xp": cls_xp, "progress": prog}

    # ── Fairy souls ───────────────────────────────────────────────────────
    # v2 (current): member.fairy_soul.total_collected
    # v2 (older):   member.fairy_soul.fairy_souls_collected
    # v2 (alt):     member.player_data.fairy_souls_collected
    # v1:           member.fairy_souls_collected
    fairy_soul_obj = member.get("fairy_soul") or {}
    _fairy_candidates = [
        fairy_soul_obj.get("total_collected"),
        fairy_soul_obj.get("fairy_souls_collected"),
        player_data_v2.get("fairy_souls_collected"),
        member.get("fairy_souls_collected"),
    ]
    fairy_souls = int(next((v for v in _fairy_candidates if v is not None and v != 0), 0)
                      or next((v for v in _fairy_candidates if v is not None), 0)
                      or 0)

    # ── Purse ─────────────────────────────────────────────────────────────
    purse = float(
        currencies_v2.get("coin_purse")
        or member.get("coin_purse")
        or 0
    )

    # ── Deaths ────────────────────────────────────────────────────────────
    # v2: player_data.death_count (int)  |  v1: member.death_count (int)
    # Some older v2 builds: player_data.deaths (dict of {death_type: count})
    deaths: int
    _dc = player_data_v2.get("death_count")
    if isinstance(_dc, (int, float)):
        deaths = int(_dc)
    else:
        _dd = player_data_v2.get("deaths")
        if isinstance(_dd, dict):
            deaths = sum(v for v in _dd.values() if isinstance(v, (int, float)))
        elif isinstance(_dd, (int, float)):
            deaths = int(_dd)
        else:
            deaths = int(member.get("death_count") or 0)

    # ── Collections ───────────────────────────────────────────────────────
    raw_collections: dict = member.get("collection") or {}
    # Guard against None/non-numeric values that would crash sort
    safe_cols = [(cid, int(cnt)) for cid, cnt in raw_collections.items() if isinstance(cnt, (int, float)) and cnt is not None]
    sorted_cols = sorted(safe_cols, key=lambda x: x[1], reverse=True)
    collections = [
        {"id": cid, "name": _format_name(cid), "count": cnt}
        for cid, cnt in sorted_cols[:12]
    ]

    return {
        "skill_average": skill_avg,
        "skills":     skills,
        "slayers":    slayers,
        "catacombs": {
            "level":    cat_level,
            "xp":       cat_xp,
            "progress": cat_progress,
            "classes":  classes,
        },
        "fairy_souls": fairy_souls,
        "purse":       purse,
        "deaths":      deaths,
        "collections": collections,
    }


_SLAYER_LEVELS = {
    "zombie":   [0, 5, 15, 200, 1000, 5000, 20000, 100000, 400000, 1000000],
    "spider":   [0, 5, 25, 200, 1000, 5000, 20000, 100000, 400000, 1000000],
    "wolf":     [0, 10, 30, 250, 1500, 5000, 20000, 100000, 400000, 1000000],
    "enderman": [0, 10, 30, 250, 1500, 5000, 20000, 100000, 400000, 1000000],
    "blaze":    [0, 10, 30, 250, 1500, 5000, 20000, 100000, 400000, 1000000],
    "vampire":  [0, 20, 75, 240, 840, 2400],
}


def _slayer_xp_to_level(slayer: str, xp: float) -> int:
    table = _SLAYER_LEVELS.get(slayer, [0])
    level = 0
    for i, threshold in enumerate(table):
        if xp >= threshold:
            level = i
    return level


# ---------------------------------------------------------------------------
# Profit calculators
# ---------------------------------------------------------------------------

def calc_bazaar_flip(
    buy_price: float,
    sell_price: float,
    quantity: int,
    use_buy_order: bool = True,
) -> dict:
    """Calculate profit for a bazaar flip."""
    effective_buy  = buy_price if use_buy_order else buy_price
    effective_sell = sell_price * (1 - SELL_TAX)
    profit_per     = effective_sell - effective_buy
    total_profit   = profit_per * quantity
    total_invested = effective_buy * quantity
    roi_pct        = (total_profit / total_invested * 100) if total_invested else 0

    return {
        "buy_price":       buy_price,
        "sell_price":      sell_price,
        "effective_sell":  round(effective_sell, 2),
        "profit_per_item": round(profit_per, 2),
        "quantity":        quantity,
        "total_invested":  round(total_invested, 2),
        "total_profit":    round(total_profit, 2),
        "roi_pct":         round(roi_pct, 2),
    }


def calc_craft_profit(
    craft_cost: float,
    sell_price: float,
    quantity: int = 1,
) -> dict:
    """Calculate profit from crafting and selling."""
    effective_sell = sell_price * (1 - SELL_TAX)
    profit_per     = effective_sell - craft_cost
    total_profit   = profit_per * quantity

    return {
        "craft_cost":      craft_cost,
        "sell_price":      sell_price,
        "effective_sell":  round(effective_sell, 2),
        "profit_per_item": round(profit_per, 2),
        "quantity":        quantity,
        "total_profit":    round(total_profit, 2),
        "roi_pct":         round((profit_per / craft_cost * 100) if craft_cost else 0, 2),
    }
