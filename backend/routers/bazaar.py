from fastapi import APIRouter, Query, HTTPException, Request
from ..utils.hypixel import get_bazaar
from ..utils.calculators import analyze_bazaar
from ..utils.price_history import price_history
from ..limiter import limiter
import statistics

router = APIRouter(prefix="/bazaar", tags=["bazaar"])


@router.get("/summary")
@limiter.limit("30/minute")
async def bazaar_summary(request: Request):
    """Top flip + product count — used by Dashboard tiles."""
    try:
        raw = await get_bazaar()
        flips = analyze_bazaar(raw, min_volume=1000, min_margin=2.0)
        return {
            "product_count": len(raw.get("products", {})),
            "top_flip": flips[0] if flips else None,
            "price_history_items": price_history.tracked_items,
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/flips")
@limiter.limit("30/minute")
async def bazaar_flips(
    request: Request,
    min_volume: int = Query(1000, description="Minimum weekly volume"),
    min_margin: float = Query(2.0, description="Minimum margin %"),
    limit: int = Query(50, le=200),
):
    """Return sorted flip opportunities (cached 90 s)."""
    try:
        raw = await get_bazaar()
        flips = analyze_bazaar(raw, min_volume=min_volume, min_margin=min_margin)
        return {"count": len(flips), "flips": flips[:limit]}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/history/{item_id}")
@limiter.limit("60/minute")
async def bazaar_history(request: Request, item_id: str):
    """Return up to 12 h of price history (90 s resolution) for one item."""
    data = price_history.get(item_id)
    if not data:
        raise HTTPException(
            status_code=404,
            detail=f"No history for '{item_id}'. Item may not exist or server just started.",
        )
    return {"item_id": item_id.upper(), "slots": len(data), "history": data}


def _volatility(prices: list[float]) -> float:
    if len(prices) < 2:
        return 0.0
    returns = []
    for i in range(1, len(prices)):
        prev = prices[i - 1]
        cur = prices[i]
        if prev > 0:
            returns.append((cur - prev) / prev)
    if len(returns) < 2:
        return 0.0
    return statistics.pstdev(returns) * 100


@router.get("/history-long/{item_id}")
@limiter.limit("30/minute")
async def bazaar_history_long(
    request: Request,
    item_id: str,
    range_key: str = Query("7d", alias="range"),
):
    """Return up to 7d/30d hourly history + volatility metrics."""
    days = 7 if range_key.lower() == "7d" else 30
    data = price_history.get_long(item_id, days=days)
    if not data:
        return {"item_id": item_id.upper(), "slots": 0, "history": [], "metrics": {}}

    prices = [d.get("sell", 0) for d in data if d.get("sell", 0) > 0]
    if not prices:
        return {"item_id": item_id.upper(), "slots": len(data), "history": data, "metrics": {}}

    first = prices[0]
    last = prices[-1]
    change_pct = ((last - first) / first * 100) if first else 0
    metrics = {
        "min": round(min(prices), 2),
        "max": round(max(prices), 2),
        "avg": round(sum(prices) / len(prices), 2),
        "volatility_pct": round(_volatility(prices), 2),
        "change_pct": round(change_pct, 2),
    }

    return {
        "item_id": item_id.upper(),
        "slots": len(data),
        "history": data,
        "metrics": metrics,
    }


@router.get("/")
@limiter.limit("30/minute")
async def bazaar_raw(request: Request):
    """Return raw bazaar data (cached 90 s)."""
    try:
        return await get_bazaar()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
