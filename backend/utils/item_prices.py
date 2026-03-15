"""
Live item price cache.

Pricing sources (in priority order):
  1. Bazaar instant-sell price  — covers all bazaar-tradeable items
  2. Ended-auction median price  — covers all AH items that sold recently
  3. Caller-supplied fallback table — for cold-start or items not yet seen

Updated every REFRESH_INTERVAL seconds via a background task.
"""
import asyncio
import base64
import gzip
import struct
import time
from typing import Optional

# ── Minimal binary NBT parser ──────────────────────────────────────────────────
_TAG_END = 0; _TAG_BYTE = 1; _TAG_SHORT = 2; _TAG_INT = 3; _TAG_LONG = 4
_TAG_FLOAT = 5; _TAG_DOUBLE = 6; _TAG_BYTE_ARRAY = 7; _TAG_STRING = 8
_TAG_LIST = 9; _TAG_COMPOUND = 10; _TAG_INT_ARRAY = 11; _TAG_LONG_ARRAY = 12
_SCALAR = {_TAG_BYTE: 1, _TAG_SHORT: 2, _TAG_INT: 4, _TAG_LONG: 8,
           _TAG_FLOAT: 4, _TAG_DOUBLE: 8}


def _nbt_read(buf: memoryview, pos: int, tag: int):
    if tag in _SCALAR:
        sz = _SCALAR[tag]
        return int.from_bytes(buf[pos:pos + sz], 'big', signed=True), pos + sz
    if tag == _TAG_STRING:
        slen = struct.unpack_from('>H', buf, pos)[0]; pos += 2
        return bytes(buf[pos:pos + slen]).decode('utf-8', 'replace'), pos + slen
    if tag == _TAG_BYTE_ARRAY:
        alen = struct.unpack_from('>i', buf, pos)[0]; return None, pos + 4 + alen
    if tag == _TAG_INT_ARRAY:
        alen = struct.unpack_from('>i', buf, pos)[0]; return None, pos + 4 + alen * 4
    if tag == _TAG_LONG_ARRAY:
        alen = struct.unpack_from('>i', buf, pos)[0]; return None, pos + 4 + alen * 8
    if tag == _TAG_LIST:
        elem = buf[pos]; pos += 1
        n = struct.unpack_from('>i', buf, pos)[0]; pos += 4
        items = []
        for _ in range(n):
            v, pos = _nbt_read(buf, pos, elem); items.append(v)
        return items, pos
    if tag == _TAG_COMPOUND:
        out = {}
        while True:
            ct = buf[pos]; pos += 1
            if ct == _TAG_END: break
            nl = struct.unpack_from('>H', buf, pos)[0]; pos += 2
            name = bytes(buf[pos:pos + nl]).decode('utf-8', 'replace'); pos += nl
            v, pos = _nbt_read(buf, pos, ct); out[name] = v
        return out, pos
    raise ValueError(f"Unknown NBT tag {tag}")


def _extract_item_id(item_bytes_b64: str) -> Optional[str]:
    """
    Decode a Hypixel AH / inventory item_bytes field and return the
    SkyBlock item ID string (ExtraAttributes.id), or None if not found.
    """
    if not item_bytes_b64:
        return None
    try:
        raw = base64.b64decode(item_bytes_b64)
        try:
            raw = gzip.decompress(raw)
        except Exception:
            pass
        buf = memoryview(raw)
        if len(buf) < 3 or buf[0] != _TAG_COMPOUND:
            return None
        pos = 1
        nlen = struct.unpack_from('>H', buf, pos)[0]; pos += 2 + nlen
        root, _ = _nbt_read(buf, pos, _TAG_COMPOUND)
        items_list = root.get('i') or []
        if not items_list or not isinstance(items_list[0], dict):
            return None
        item = items_list[0]
        tag  = item.get('tag') or {}
        extra = tag.get('ExtraAttributes') or {}
        sid = str(extra.get('id', '') or '').strip()
        return sid or None
    except Exception:
        return None


# ── Price cache ────────────────────────────────────────────────────────────────

REFRESH_INTERVAL = 90  # seconds


class ItemPriceCache:
    """
    Background-updated dict of {SKYBLOCK_ITEM_ID: price_per_item}.

    Price sources:
      bazaar  → quick_status.sellPrice  (what a buyer is paying = what you receive minus sell tax)
      ah      → 25th-percentile of recent ended-auction sale prices (roughly "low price")
    """

    def __init__(self) -> None:
        self._bazaar: dict[str, float] = {}   # item_id → sell price
        self._ah: dict[str, float] = {}       # item_id → recent AH price
        self._last_update: float = 0.0
        self._task: Optional[asyncio.Task] = None

    # ── Lifecycle ─────────────────────────────────────────────────────────

    async def start(self) -> None:
        await self._update()
        self._task = asyncio.create_task(self._loop())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _loop(self) -> None:
        while True:
            await asyncio.sleep(REFRESH_INTERVAL)
            await self._update()

    # ── Update ────────────────────────────────────────────────────────────

    async def _update(self) -> None:
        from .hypixel import get_bazaar, get_ended_auctions
        try:
            bazaar_resp, ended_resp = await asyncio.gather(
                get_bazaar(),
                get_ended_auctions(),
                return_exceptions=True,
            )
            new_bazaar: dict[str, float] = {}
            new_ah:     dict[str, list[float]] = {}

            # ── Bazaar ──────────────────────────────────────────────────
            if not isinstance(bazaar_resp, Exception):
                for item_id, data in bazaar_resp.get('products', {}).items():
                    sell = (data.get('quick_status') or {}).get('sellPrice', 0) or 0
                    if sell > 0:
                        new_bazaar[item_id] = float(sell)

            # ── Ended auctions ──────────────────────────────────────────
            if not isinstance(ended_resp, Exception):
                for auction in ended_resp.get('auctions', []):
                    price = auction.get('price', 0) or 0
                    if price <= 0:
                        continue
                    item_bytes = auction.get('item_bytes', '')
                    if not item_bytes:
                        continue
                    item_id = _extract_item_id(item_bytes)
                    if not item_id:
                        continue
                    # Don't override bazaar items — bazaar prices are more reliable
                    if item_id in new_bazaar:
                        continue
                    new_ah.setdefault(item_id, []).append(float(price))

            # Use 25th-percentile sale price (closer to realistic "low bin")
            ah_prices: dict[str, float] = {}
            for item_id, sales in new_ah.items():
                s = sorted(sales)
                ah_prices[item_id] = s[max(0, len(s) // 4)]

            self._bazaar = new_bazaar
            self._ah     = ah_prices
            self._last_update = time.time()
            print(f"[ItemPrices] bazaar={len(new_bazaar):,}  ah={len(ah_prices):,}")

        except Exception as exc:
            print(f"[ItemPrices] update failed: {exc}")

    # ── Public API ────────────────────────────────────────────────────────

    def get(self, item_id: str, fallback: float = 0.0) -> float:
        """Return price per 1 unit. Bazaar > AH > fallback."""
        return self._bazaar.get(item_id) or self._ah.get(item_id) or fallback

    def get_bazaar(self, item_id: str) -> float:
        return self._bazaar.get(item_id, 0.0)

    def get_ah(self, item_id: str) -> float:
        return self._ah.get(item_id, 0.0)

    @property
    def ready(self) -> bool:
        return self._last_update > 0

    @property
    def item_count(self) -> int:
        return len(self._bazaar) + len(self._ah)


# Module-level singleton imported by routers
item_prices = ItemPriceCache()
