import asyncio
import os
import sys
from typing import Iterable
import httpx

from ..utils.hypixel import get_bazaar
from ..utils.supabase_storage import upload_public_object


def _build_url(base: str, item_id: str) -> str:
    if "{id}" in base:
        return base.replace("{id}", item_id)
    return f"{base}{item_id}"


async def _fetch_icon(client: httpx.AsyncClient, url: str) -> bytes | None:
    r = await client.get(url)
    if r.status_code == 200 and r.headers.get("content-type", "").startswith("image/"):
        return r.content
    return None


async def _get_item_ids(limit: int | None) -> list[str]:
    raw = await get_bazaar()
    ids = list(raw.get("products", {}).keys())
    return ids[:limit] if limit else ids


async def run(limit: int | None = None) -> None:
    source_base = os.environ.get("ICON_SOURCE_BASE", "").strip()
    if not source_base:
        raise RuntimeError("ICON_SOURCE_BASE not set. Example: https://cdn.example.com/{id}.png")

    bucket = os.environ.get("ICON_BUCKET", "item-icons")
    item_ids = await _get_item_ids(limit)

    async with httpx.AsyncClient(timeout=30) as client:
        for item_id in item_ids:
            url = _build_url(source_base, item_id)
            data = await _fetch_icon(client, url)
            if not data:
                print(f"[icon] missing: {item_id}")
                continue
            await upload_public_object(bucket, f"{item_id}.png", data, "image/png")
            print(f"[icon] uploaded: {item_id}")


if __name__ == "__main__":
    limit = None
    if len(sys.argv) > 1:
        try:
            limit = int(sys.argv[1])
        except Exception:
            limit = None
    asyncio.run(run(limit))
