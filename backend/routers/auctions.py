import asyncio
import re
import time
import statistics
from collections import defaultdict
from fastapi import APIRouter, Query, HTTPException, Request
from ..utils.hypixel import get_ended_auctions, get_bazaar
from ..utils.ah_index import ah_index
from ..limiter import limiter

router = APIRouter(prefix="/auctions", tags=["auctions"])

_STRIP_COLOR = re.compile(r"§.")

_SMALL_WORDS = frozenset({
    'a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'for',
    'and', 'or', 'but', 'nor', 'with', 'by', 'from',
})

# Explicit overrides for items whose AH name differs from BZ ID→words
_BZ_TO_AH_NAME: dict[str, str] = {
    "ASPECT_OF_THE_END":          "Aspect of the End",
    "ASPECT_OF_THE_VOID":         "Aspect of the Void",
    "FLOWER_OF_TRUTH":            "Flower of Truth",
    "GIANTS_SWORD":               "Giant's Sword",
    "LIVID_DAGGER":               "Livid Dagger",
    "SHADOW_FURY":                "Shadow Fury",
    "MIDAS_STAFF":                "Midas' Staff",
    "WITHER_BLADE":               "Wither Blade",
    "DARK_CLAYMORE":              "Dark Claymore",
    "NECRON_BLADE":               "Necron's Blade",
    "HYPERION":                   "Hyperion",
    "VALKYRIE":                   "Valkyrie",
    "ASTRAEA":                    "Astraea",
    "SCYLLA":                     "Scylla",
    "WARDEN_HELMET":              "Warden Helmet",
    "WARDEN_CHESTPLATE":          "Warden Chestplate",
    "WARDEN_LEGGINGS":            "Warden Leggings",
    "WARDEN_BOOTS":               "Warden Boots",
    "BONZO_STAFF":                "Bonzo's Staff",
    "SPIRIT_LEAP":                "Spirit Leap",
    "BONZO_MASK":                 "Bonzo's Mask",
    "TERMINATOR":                 "Terminator",
    "STORM_CHESTPLATE":           "Storm's Chestplate",
    "STORM_HELMET":               "Storm's Helmet",
    "STORM_LEGGINGS":             "Storm's Leggings",
    "STORM_BOOTS":                "Storm's Boots",
    "GOLDOR_HELMET":              "Goldor's Helmet",
    "GOLDOR_CHESTPLATE":          "Goldor's Chestplate",
    "GOLDOR_LEGGINGS":            "Goldor's Leggings",
    "GOLDOR_BOOTS":               "Goldor's Boots",
    "NECRON_HELMET":              "Necron's Helmet",
    "NECRON_CHESTPLATE":          "Necron's Chestplate",
    "NECRON_LEGGINGS":            "Necron's Leggings",
    "NECRON_BOOTS":               "Necron's Boots",
    "STARRED_WITHER_CHESTPLATE":  "Starred Wither Chestplate",
    "STARRED_WITHER_HELMET":      "Starred Wither Helmet",
    "STARRED_WITHER_LEGGINGS":    "Starred Wither Leggings",
    "STARRED_WITHER_BOOTS":       "Starred Wither Boots",
    "ENCHANTED_DIAMOND":          "Enchanted Diamond",
    "ENCHANTED_DIAMOND_BLOCK":    "Enchanted Diamond Block",
    "ENCHANTED_GOLD":             "Enchanted Gold",
    "ENCHANTED_GOLD_BLOCK":       "Enchanted Gold Block",
    "ENCHANTED_IRON":             "Enchanted Iron",
    "ENCHANTED_IRON_BLOCK":       "Enchanted Iron Block",
    "ENCHANTED_EMERALD":          "Enchanted Emerald",
    "ENCHANTED_EMERALD_BLOCK":    "Enchanted Emerald Block",
    "ENCHANTED_LAPIS_LAZULI":     "Enchanted Lapis Lazuli",
    "ENCHANTED_REDSTONE":         "Enchanted Redstone",
    "ENCHANTED_REDSTONE_BLOCK":   "Enchanted Redstone Block",
    "ENCHANTED_COAL":             "Enchanted Coal",
    "ENCHANTED_COAL_BLOCK":       "Enchanted Coal Block",
    "ENCHANTED_COBBLESTONE":      "Enchanted Cobblestone",
    "ENCHANTED_SAND":             "Enchanted Sand",
    "ENCHANTED_GRAVEL":           "Enchanted Gravel",
    "ENCHANTED_OBSIDIAN":         "Enchanted Obsidian",
    "ENCHANTED_NETHER_WART":      "Enchanted Nether Wart",
    "ENCHANTED_BLAZE_POWDER":     "Enchanted Blaze Powder",
    "ENCHANTED_BLAZE_ROD":        "Enchanted Blaze Rod",
    "ENCHANTED_GHAST_TEAR":       "Enchanted Ghast Tear",
    "ENCHANTED_MAGMA_CREAM":      "Enchanted Magma Cream",
    "ENCHANTED_MUSHROOM":         "Enchanted Mushroom",
    "ENCHANTED_WHEAT":            "Enchanted Wheat",
    "ENCHANTED_MELON":            "Enchanted Melon",
    "ENCHANTED_MELON_BLOCK":      "Enchanted Melon Block",
    "ENCHANTED_PUMPKIN":          "Enchanted Pumpkin",
    "ENCHANTED_CARROT":           "Enchanted Carrot",
    "ENCHANTED_POTATO":           "Enchanted Potato",
    "ENCHANTED_SUGAR_CANE":       "Enchanted Sugar Cane",
    "ENCHANTED_CACTUS":           "Enchanted Cactus",
    "ENCHANTED_CACTUS_GREEN":     "Enchanted Cactus Green",
    "ENCHANTED_PORK":             "Enchanted Pork",
    "ENCHANTED_RAW_CHICKEN":      "Enchanted Raw Chicken",
    "ENCHANTED_RABBIT":           "Enchanted Rabbit",
    "ENCHANTED_EGG":              "Enchanted Egg",
    "ENCHANTED_FEATHER":          "Enchanted Feather",
    "ENCHANTED_LEATHER":          "Enchanted Leather",
    "ENCHANTED_INK_SACK":         "Enchanted Ink Sack",
    "ENCHANTED_INK_SACK_2":       "Enchanted Magenta Dye",
    "ENCHANTED_INK_SACK_4":       "Enchanted Yellow Dye",
    "ENCHANTED_RAW_FISH":         "Enchanted Raw Fish",
    "ENCHANTED_COOKED_FISH":      "Enchanted Cooked Fish",
    "ENCHANTED_STRING":           "Enchanted String",
    "ENCHANTED_ENDER_PEARL":      "Enchanted Ender Pearl",
    "ENCHANTED_EYE_OF_ENDER":     "Enchanted Eye of Ender",
    "ENCHANTED_GUNPOWDER":        "Enchanted Gunpowder",
    "ENCHANTED_BONE":             "Enchanted Bone",
    "ENCHANTED_ROTTEN_FLESH":     "Enchanted Rotten Flesh",
    "ENCHANTED_SPIDER_EYE":       "Enchanted Spider Eye",
    "ENCHANTED_SLIME_BALL":       "Enchanted Slime Ball",
    "ENCHANTED_SLIME_BLOCK":      "Enchanted Slime Block",
    "ENCHANTED_PRISMARINE_SHARD": "Enchanted Prismarine Shard",
    "ENCHANTED_PRISMARINE_CRYSTALS": "Enchanted Prismarine Crystals",
    "ENCHANTED_LILY_PAD":         "Enchanted Lily Pad",
    "ENCHANTED_OAK_LOG":          "Enchanted Oak Log",
    "ENCHANTED_BIRCH_LOG":        "Enchanted Birch Log",
    "ENCHANTED_JUNGLE_LOG":       "Enchanted Jungle Log",
    "ENCHANTED_ACACIA_LOG":       "Enchanted Acacia Log",
    "ENCHANTED_DARK_OAK_LOG":     "Enchanted Dark Oak Log",
    "ENCHANTED_SPRUCE_LOG":       "Enchanted Spruce Log",
    "ENCHANTED_SAND_2":           "Enchanted Red Sand",
    "SULPHUR":                    "Sulphur",
    "ENCHANTED_SULPHUR":          "Enchanted Sulphur",
    "ENCHANTED_ICE":              "Enchanted Ice",
    "PACKED_ICE":                 "Packed Ice",
    "ENCHANTED_PACKED_ICE":       "Enchanted Packed Ice",
    "HARD_STONE":                 "Hard Stone",
    "ENCHANTED_HARD_STONE":       "Enchanted Hard Stone",
    "MITHRIL_ORE":                "Mithril Ore",
    "ENCHANTED_MITHRIL":          "Enchanted Mithril",
    "ENCHANTED_TITANIUM":         "Enchanted Titanium",
    "GEMSTONE_MIXTURE":           "Gemstone Mixture",
    "GLEAMING_CRYSTAL":           "Gleaming Crystal",
    "WISHING_COMPASS":            "Wishing Compass",
    "SPEED_TALISMAN":             "Speed Talisman",
    "SPEED_RING":                 "Speed Ring",
    "SPEED_ARTIFACT":             "Speed Artifact",
}

def _bz_id_to_ah_name(item_id: str) -> str:
    """Convert a Bazaar item_id to its expected AH display name."""
    if item_id in _BZ_TO_AH_NAME:
        return _BZ_TO_AH_NAME[item_id]
    parts = item_id.replace("_", " ").lower().split()
    return " ".join(
        p.capitalize() if i == 0 or p not in _SMALL_WORDS else p
        for i, p in enumerate(parts)
    )


@router.get("/status")
async def auction_status():
    """Return AH index status."""
    return {
        "ready": ah_index.ready,
        "auction_count": ah_index.auction_count,
        "total_pages": ah_index.total_pages,
        "last_update": ah_index.last_update,
        "age_seconds": round(time.time() - ah_index.last_update, 1) if ah_index.ready else None,
    }


@router.get("/ended")
@limiter.limit("20/minute")
async def ended_auctions(request: Request):
    """Return recently ended auctions (cached 60 s)."""
    try:
        return await get_ended_auctions()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/search")
@limiter.limit("60/minute")
async def search_auctions(
    request: Request,
    query: str = Query(..., min_length=2),
    bin_only: bool = Query(False),
):
    """Search ALL live auctions by item name from in-memory index."""
    try:
        await ah_index.ensure_fresh()
    except asyncio.TimeoutError:
        # Serverless cold start: don't fail the request outright; report warming up.
        pass

    if not ah_index.ready:
        return {
            "ready": False,
            "count": 0,
            "index_age_seconds": None,
            "error": ah_index.last_error,
            "auctions": [],
        }

    results = ah_index.search(query, bin_only=bin_only)
    return {
        "ready": True,
        "count": len(results),
        "index_age_seconds": round(time.time() - ah_index.last_update, 1),
        "auctions": results,
    }


@router.get("/sniper")
@limiter.limit("30/minute")
async def sniper(
    request: Request,
    threshold: float = Query(20.0, ge=5, le=80, description="% below median to flag as snipe"),
    min_profit: int = Query(100_000, ge=0),
    limit: int = Query(50, ge=1, le=200),
    category: str = Query("all"),
):
    """
    Find BIN listings priced significantly below the median for that item.
    Uses the in-memory AH index — no extra Hypixel calls.
    """
    try:
        await ah_index.ensure_fresh()
    except asyncio.TimeoutError:
        pass

    if not ah_index.ready:
        return {
            "ready": False,
            "count": 0,
            "snipes": [],
            "index_age_seconds": None,
            "error": ah_index.last_error,
        }

    # Gather all BIN auctions
    bins: list[dict] = [a for a in ah_index._auctions if a.get("bin")]

    # Optional category filter (by tier / item_lore keywords)
    if category != "all":
        tier_map = {
            "common": "COMMON", "uncommon": "UNCOMMON", "rare": "RARE",
            "epic": "EPIC", "legendary": "LEGENDARY", "mythic": "MYTHIC",
        }
        wanted_tier = tier_map.get(category.lower())
        if wanted_tier:
            bins = [a for a in bins if a.get("tier", "").upper() == wanted_tier]

    # Group prices by normalised item name
    price_groups: dict[str, list[float]] = defaultdict(list)
    for a in bins:
        name = a.get("item_name", "").strip()
        if name:
            price_groups[name].append(float(a.get("starting_bid", 0)))

    # Find snipe opportunities
    snipes = []
    for a in bins:
        name = a.get("item_name", "").strip()
        prices = price_groups.get(name, [])
        if len(prices) < 3:
            continue  # not enough data for a reliable median
        med = statistics.median(prices)
        if med <= 0:
            continue
        listing_price = float(a.get("starting_bid", 0))
        if listing_price <= 0:
            continue
        pct_below = (1 - listing_price / med) * 100
        profit = med - listing_price
        if pct_below >= threshold and profit >= min_profit:
            snipes.append({
                "uuid": a.get("uuid"),
                "name": name,
                "item_id": a.get("item_id") or a.get("item_name"),
                "listing_price": listing_price,
                "median_price": round(med),
                "profit": round(profit),
                "pct_below": round(pct_below, 1),
                "tier": a.get("tier", "COMMON"),
                "seller": a.get("auctioneer", ""),
                "end_time": a.get("end", 0),
                "listings_count": len(prices),
            })

    snipes.sort(key=lambda x: x["profit"], reverse=True)
    return {
        "ready": True,
        "count": len(snipes),
        "snipes": snipes[:limit],
        "index_age_seconds": round(time.time() - ah_index.last_update, 1),
    }


@router.get("/shards")
@limiter.limit("20/minute")
async def shard_fusion(
    request: Request,
    min_profit: int = Query(200_000, ge=0),
    limit: int = Query(80, ge=1, le=200),
):
    """
    Attribute shard fusion sniper.
    Finds opportunities where 2× level-N shards fused → level-(N+1) is
    cheaper than buying level-(N+1) directly on the AH.
    """
    try:
        await ah_index.ensure_fresh()
    except asyncio.TimeoutError:
        pass

    if not ah_index.ready:
        return {
            "ready": False,
            "opportunities": [],
            "error": ah_index.last_error,
        }

    def clean(s: str) -> str:
        return _STRIP_COLOR.sub("", s)

    def parse_level(item_name: str, lore: str) -> int | None:
        # Stars in item name (✦✦✦ = level 3)
        stars = item_name.count("✦") + item_name.count("⭐")
        if stars > 0:
            return min(stars, 10)
        # "Level X" or "Lv X" in lore
        m = re.search(r"[Ll]evel[:\s]+(\d+)", clean(lore))
        if m:
            return int(m.group(1))
        m = re.search(r"\[Lv?\s*(\d+)\]", item_name)
        if m:
            return int(m.group(1))
        return None

    def extract_attr(item_name: str) -> str | None:
        name = re.sub(r"[✦⭐]+", "", item_name).strip()
        name = re.sub(r"\bAttribute\s+Shard\b", "", name, flags=re.IGNORECASE).strip()
        name = re.sub(r"[\[\]]+", "", name).strip()
        name = re.sub(r"\s+", " ", name).strip()
        return name if len(name) >= 3 else None

    # All BIN shard listings
    shard_auctions = [
        a for a in ah_index._auctions
        if a.get("bin")
        and "Shard" in a.get("item_name", "")
        and float(a.get("starting_bid", 0)) > 0
    ]

    # Group by (attribute, level) → sorted price list
    groups: dict[tuple, list[float]] = defaultdict(list)
    for a in shard_auctions:
        attr = extract_attr(a.get("item_name", ""))
        if not attr:
            continue
        level = parse_level(a.get("item_name", ""), a.get("item_lore", ""))
        if level is None or not (1 <= level <= 10):
            continue
        groups[(attr, level)].append(float(a["starting_bid"]))

    for key in groups:
        groups[key].sort()

    all_attrs = sorted({attr for attr, _ in groups.keys()})
    opportunities = []

    for attr in all_attrs:
        for from_level in range(1, 10):
            to_level = from_level + 1
            buy_prices = groups.get((attr, from_level), [])
            sell_prices = groups.get((attr, to_level), [])
            if len(buy_prices) < 2 or not sell_prices:
                continue
            fusion_cost = buy_prices[0] + buy_prices[1]
            sell_price = statistics.median(sell_prices)
            # 1% AH BIN listing fee
            profit = sell_price * 0.99 - fusion_cost
            if profit < min_profit:
                continue
            opportunities.append({
                "attribute": attr,
                "from_level": from_level,
                "to_level": to_level,
                "shard_1_price": round(buy_prices[0]),
                "shard_2_price": round(buy_prices[1]),
                "fusion_cost": round(fusion_cost),
                "sell_price": round(sell_price),
                "sell_min": round(min(sell_prices)),
                "profit": round(profit),
                "roi_pct": round((profit / fusion_cost * 100) if fusion_cost else 0, 1),
                "available_pairs": len(buy_prices) // 2,
                "sell_listings": len(sell_prices),
            })

    opportunities.sort(key=lambda x: x["profit"], reverse=True)

    return {
        "ready": True,
        "count": len(opportunities),
        "opportunities": opportunities[:limit],
        "total_shard_auctions": len(shard_auctions),
        "attributes_found": len(all_attrs),
        "index_age_seconds": round(time.time() - ah_index.last_update, 1),
    }


@router.get("/bz-to-ah")
@limiter.limit("20/minute")
async def bz_to_ah_arb(
    request: Request,
    min_profit: int = Query(50_000, ge=0),
    min_margin: float = Query(5.0, ge=0),
    limit: int = Query(60, ge=1, le=150),
):
    """
    Items you can buy cheaply on Bazaar and resell on Auction House for profit.
    Compares BZ instant-buy price vs AH median BIN price for matching items.
    """
    try:
        await ah_index.ensure_fresh()
    except asyncio.TimeoutError:
        pass

    if not ah_index.ready:
        return {"ready": False, "flips": [], "error": ah_index.last_error}

    raw_bz = await get_bazaar()
    products = raw_bz.get("products", {})

    # Build AH price map: lowercase display name → sorted list of BIN prices
    ah_by_name: dict[str, list[float]] = defaultdict(list)
    for a in ah_index._auctions:
        if not a.get("bin"):
            continue
        name = a.get("item_name", "").strip()
        price = float(a.get("starting_bid", 0))
        if name and price > 0:
            ah_by_name[name.lower()].append(price)
    for k in ah_by_name:
        ah_by_name[k].sort()

    flips = []
    for item_id, data in products.items():
        quick = data.get("quick_status", {})
        bz_buy = float(quick.get("buyPrice", 0))       # instant buy from BZ
        bz_weekly = int(quick.get("buyMovingWeek", 0))

        if bz_buy < 1_000:
            continue

        # Match by display name (title-case conversion)
        display = _bz_id_to_ah_name(item_id)
        ah_listings = ah_by_name.get(display.lower(), [])
        if len(ah_listings) < 3:
            continue

        ah_min = ah_listings[0]
        ah_median = statistics.median(ah_listings)

        # Conservative: sell at lowest AH price, subtract 1% BIN fee
        profit = ah_min * 0.99 - bz_buy
        margin = (profit / bz_buy * 100) if bz_buy else 0

        if profit < min_profit or margin < min_margin:
            continue

        flips.append({
            "item_id": item_id,
            "name": display,
            "bz_buy": round(bz_buy, 1),
            "ah_min": round(ah_min),
            "ah_median": round(ah_median),
            "profit": round(profit),
            "margin_pct": round(margin, 1),
            "ah_listings": len(ah_listings),
            "bz_weekly_vol": bz_weekly,
        })

    flips.sort(key=lambda x: x["profit"], reverse=True)
    return {
        "ready": True,
        "count": len(flips),
        "flips": flips[:limit],
        "index_age_seconds": round(time.time() - ah_index.last_update, 1),
    }
