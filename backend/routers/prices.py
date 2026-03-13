from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import List
from ..utils.manual_prices import lookup, bulk_lookup
from ..limiter import limiter

router = APIRouter(prefix="/prices", tags=["prices"])


class BulkRequest(BaseModel):
    items: List[str]


@router.get("/item/{item_id}")
@limiter.limit("60/minute")
async def price_item(request: Request, item_id: str):
    value = lookup(item_id)
    return {
        "item_id": item_id.upper(),
        "price": value,
        "source": "curated",
    }


@router.post("/bulk")
@limiter.limit("30/minute")
async def price_bulk(request: Request, payload: BulkRequest):
    items = [i for i in payload.items if i]
    data = bulk_lookup(items)
    return {
        "count": len(data),
        "prices": data,
        "source": "curated",
    }
