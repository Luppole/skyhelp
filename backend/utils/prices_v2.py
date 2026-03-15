"""
SkyHelperBot/Prices — pricesV2.json cache
==========================================
This is the same live price source used by SkyCrypt / skyhelper-networth.

Key formats (all uppercase after normalisation):
  Regular items   →  "HYPERION"                        : float
  Enchanted books →  "ENCHANTMENT_SHARPNESS_6"         : float
  Pets (lv 1)     →  "PET_TIGER_LEGENDARY_1"           : float
  Pets (lv 100)   →  "PET_TIGER_LEGENDARY_100"         : float
  Pets (lv 200)   →  "PET_GOLDEN_DRAGON_LEGENDARY_200" : float

Refreshed every 5 minutes via a background asyncio task.
"""

import asyncio
import time
from typing import Optional

import httpx

PRICES_URL = (
    "https://raw.githubusercontent.com/SkyHelperBot/Prices/main/pricesV2.json"
)
REFRESH_INTERVAL = 300  # 5 minutes

# Pets whose max level is 200 (not 100)
_LV200_PETS = {"GOLDEN_DRAGON", "JADE_DRAGON", "ROSE_DRAGON"}


class PricesV2Cache:
    """Background-refreshed cache for the SkyHelperBot pricesV2.json dataset."""

    def __init__(self) -> None:
        self._prices: dict[str, float] = {}
        self._last_update: float = 0.0
        self._task: Optional[asyncio.Task] = None

    # ── Lifecycle ──────────────────────────────────────────────────────────

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

    # ── Fetch ──────────────────────────────────────────────────────────────

    async def _update(self) -> None:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(PRICES_URL)
                resp.raise_for_status()
                raw: dict = resp.json()
            self._prices = {
                str(k).upper(): float(v)
                for k, v in raw.items()
                if v is not None
            }
            self._last_update = time.time()
            print(f"[PricesV2] loaded {len(self._prices):,} price entries")
        except Exception as exc:
            print(f"[PricesV2] update failed: {exc}")

    # ── Public API ─────────────────────────────────────────────────────────

    def get(self, key: str, fallback: float = 0.0) -> float:
        """Return price for key (case-insensitive) or fallback."""
        return self._prices.get(key.upper(), fallback)

    def pet_price(self, pet_type: str, tier: str, level: int) -> float:
        """
        Return level-interpolated pet price from pricesV2.json.

        Uses linear interpolation between the lv-1 and lv-100 price points
        (or lv-100 → lv-200 for special 200-max pets).
        Returns 0.0 if neither price point is found.
        """
        ptype = pet_type.upper()
        ptier = tier.upper()
        max_level = 200 if ptype in _LV200_PETS else 100

        key1   = f"PET_{ptype}_{ptier}_1"
        key100 = f"PET_{ptype}_{ptier}_100"
        p1   = self._prices.get(key1,   0.0)
        p100 = self._prices.get(key100, 0.0)

        if max_level == 200:
            key200 = f"PET_{ptype}_{ptier}_200"
            p200 = self._prices.get(key200, 0.0)
            if level <= 100:
                if p1 > 0 and p100 > 0:
                    t = level / 100
                    return p1 + (p100 - p1) * t
                if p100 > 0:
                    return p100
                return p1 or 0.0
            else:
                if p100 > 0 and p200 > 0:
                    t = (level - 100) / 100
                    return p100 + (p200 - p100) * t
                return p200 or p100 or 0.0

        # Normal 100-max pet
        if p1 > 0 and p100 > 0:
            t = min(level / 100, 1.0)
            return p1 + (p100 - p1) * t
        # Only one price point available — use whichever exists
        if p100 > 0:
            # Scale down for low-level pets
            return p100 * (0.20 + 0.80 * min(level / 100, 1.0))
        if p1 > 0:
            # Scale up for high-level pets
            return p1 * (0.20 + 0.80 * min(level / 100, 1.0)) / 0.20
        return 0.0

    @property
    def ready(self) -> bool:
        return self._last_update > 0

    @property
    def item_count(self) -> int:
        return len(self._prices)


# Module-level singleton
prices_v2 = PricesV2Cache()
