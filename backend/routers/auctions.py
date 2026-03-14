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
        display = item_id.replace("_", " ").title()
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
