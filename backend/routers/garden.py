"""
Farming Fortune & BPS upgrade optimizer — price data only.

GET /garden/enchant-prices
  Returns live Bazaar instant-buy prices for every farming enchant book.
  All calculation is done client-side; this endpoint has no Hypixel dependency.
"""

import logging
from fastapi import APIRouter, Request
from ..utils.hypixel import get_bazaar
from ..limiter import limiter

log = logging.getLogger(__name__)
router = APIRouter(prefix="/garden", tags=["garden"])

# Every enchant book ID we track (farming fortune + BPS)
_ENCHANT_IDS: list[str] = [
    # Turbo (crop-specific, I-V)
    *[f"ENCHANTMENT_TURBO_WHEAT_{i}"     for i in range(1, 6)],
    *[f"ENCHANTMENT_TURBO_CARROT_{i}"    for i in range(1, 6)],
    *[f"ENCHANTMENT_TURBO_POTATO_{i}"    for i in range(1, 6)],
    *[f"ENCHANTMENT_TURBO_PUMPKIN_{i}"   for i in range(1, 6)],
    *[f"ENCHANTMENT_TURBO_MELON_{i}"     for i in range(1, 6)],
    *[f"ENCHANTMENT_TURBO_MUSHROOMS_{i}" for i in range(1, 6)],
    *[f"ENCHANTMENT_TURBO_COCOA_{i}"     for i in range(1, 6)],
    *[f"ENCHANTMENT_TURBO_CANE_{i}"      for i in range(1, 6)],
    *[f"ENCHANTMENT_TURBO_WARTS_{i}"     for i in range(1, 6)],
    *[f"ENCHANTMENT_TURBO_CACTI_{i}"     for i in range(1, 6)],
    # Fortune (global)
    *[f"ENCHANTMENT_DEDICATION_{i}"  for i in range(1, 5)],
    *[f"ENCHANTMENT_HARVESTING_{i}"  for i in range(1, 7)],
    *[f"ENCHANTMENT_GREEN_THUMB_{i}" for i in range(1, 6)],
    # BPS
    *[f"ENCHANTMENT_SUGAR_RUSH_{i}"  for i in range(1, 4)],
]


@router.get("/enchant-prices")
@limiter.limit("60/minute")
async def enchant_prices(request: Request):
    """
    Live Bazaar instant-buy prices for all tracked farming enchant books.
    Cached via the shared bazaar cache (90 s TTL).
    """
    raw = await get_bazaar()
    products = raw.get("products", {})
    prices: dict[str, float] = {}
    for iid in _ENCHANT_IDS:
        qs = products.get(iid, {}).get("quick_status", {})
        p = float(qs.get("buyPrice", 0))
        if p > 0:
            prices[iid] = round(p, 2)
    return {"prices": prices, "count": len(prices)}
