from fastapi import APIRouter, Query
from ..utils.calculators import calc_bazaar_flip, calc_craft_profit

router = APIRouter(prefix="/calculators", tags=["calculators"])


@router.get("/bazaar-flip")
async def bazaar_flip_calc(
    buy_price: float = Query(..., description="Price you pay per item (buy order)"),
    sell_price: float = Query(..., description="Price you sell per item (sell order)"),
    quantity: int = Query(1, ge=1),
    use_buy_order: bool = Query(True),
):
    """Calculate profit for a bazaar flip."""
    return calc_bazaar_flip(buy_price, sell_price, quantity, use_buy_order)


@router.get("/craft-profit")
async def craft_profit_calc(
    craft_cost: float = Query(..., description="Total cost to craft one item"),
    sell_price: float = Query(..., description="Sell order price per item"),
    quantity: int = Query(1, ge=1),
):
    """Calculate profit from crafting and selling via bazaar sell orders."""
    return calc_craft_profit(craft_cost, sell_price, quantity)
