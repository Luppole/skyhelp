"""
In-memory price history ring buffers.
Short: records buy/sell snapshots every 90 s, up to 12 hours per item.
Long: records buy/sell snapshots every 60 minutes, up to 30 days per item.
"""
import asyncio
import logging
import time
from collections import deque
from typing import Optional

logger = logging.getLogger(__name__)

SHORT_MAX_SLOTS = 480    # 480 × 90 s = 43,200 s ≈ 12 h
SHORT_INTERVAL  = 90     # seconds between snapshots
LONG_MAX_SLOTS  = 720    # 720 × 3600 s = 30 days
LONG_INTERVAL   = 3600   # seconds between snapshots
LONG_TRACK_LIMIT = 600   # cap items to reduce memory pressure


class PriceHistoryBuffer:
    def __init__(self) -> None:
        self._data_short: dict[str, deque] = {}
        self._data_long: dict[str, deque] = {}
        self._last_short: float = 0.0
        self._last_long: float = 0.0
        self._task: Optional[asyncio.Task] = None
        self._last_snapshot: float = 0.0

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> None:
        await self._snapshot()
        self._task = asyncio.create_task(self._loop())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    async def _loop(self) -> None:
        while True:
            await asyncio.sleep(SHORT_INTERVAL)
            await self._snapshot()

    async def _snapshot(self) -> None:
        # Local import to avoid circular deps at module load time
        from .hypixel import get_bazaar
        try:
            raw = await get_bazaar()
            ts = int(time.time())
            products = raw.get("products", {})

            # Determine long-history tracked set by moving week volume
            long_items = set()
            if ts - self._last_long >= LONG_INTERVAL:
                tracked = []
                for item_id, data in products.items():
                    qs = data.get("quick_status", {})
                    mv = max(qs.get("buyMovingWeek", 0), qs.get("sellMovingWeek", 0))
                    if mv > 0:
                        tracked.append((item_id, mv))
                tracked.sort(key=lambda x: x[1], reverse=True)
                long_items = set([i for i, _ in tracked[:LONG_TRACK_LIMIT]])

            for item_id, data in raw.get("products", {}).items():
                qs = data.get("quick_status", {})
                buy  = qs.get("buyPrice", 0)
                sell = qs.get("sellPrice", 0)
                if buy <= 0 or sell <= 0:
                    continue
                if item_id not in self._data_short:
                    self._data_short[item_id] = deque(maxlen=SHORT_MAX_SLOTS)
                self._data_short[item_id].append({
                    "t": ts,
                    "buy": round(buy, 2),
                    "sell": round(sell, 2),
                })

                # Long history snapshot (hourly)
                if item_id in long_items and (ts - self._last_long >= LONG_INTERVAL):
                    if item_id not in self._data_long:
                        self._data_long[item_id] = deque(maxlen=LONG_MAX_SLOTS)
                    self._data_long[item_id].append({
                        "t": ts,
                        "buy": round(buy, 2),
                        "sell": round(sell, 2),
                    })

            now = time.time()
            self._last_snapshot = now
            self._last_short = now
            if ts - self._last_long >= LONG_INTERVAL:
                self._last_long = ts
        except Exception as exc:
            logger.warning("[PriceHistory] snapshot failed: %s", exc)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get(self, item_id: str) -> list[dict]:
        return list(self._data_short.get(item_id.upper(), []))

    def get_long(self, item_id: str, days: int = 7) -> list[dict]:
        data = list(self._data_long.get(item_id.upper(), []))
        if days <= 0:
            return data
        cutoff = int(time.time()) - days * 86400
        return [d for d in data if d.get("t", 0) >= cutoff]

    @property
    def tracked_items(self) -> int:
        return len(self._data_short)

    @property
    def tracked_items_long(self) -> int:
        return len(self._data_long)

    @property
    def last_snapshot(self) -> float:
        return self._last_snapshot


# Module-level singleton
price_history = PriceHistoryBuffer()
