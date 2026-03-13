import time
import statistics
from collections import defaultdict
from fastapi import APIRouter, Query, HTTPException, Request
from ..utils.hypixel import get_ended_auctions
from ..utils.ah_index import ah_index
from ..limiter import limiter

router = APIRouter(prefix="/auctions", tags=["auctions"])


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
    if not ah_index.ready:
        return {
            "ready": False,
            "count": 0,
            "index_age_seconds": None,
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
    if not ah_index.ready:
        return {
            "ready": False,
            "count": 0,
            "snipes": [],
            "index_age_seconds": None,
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
