"""
In-memory Auction House index.

Fetches all AH pages on startup then refreshes every 60 s.
Searches run entirely in-process — no per-query Hypixel calls.
"""
import asyncio
import time
import httpx

HYPIXEL_BASE = "https://api.hypixel.net"
BATCH_SIZE = 10          # pages fetched in parallel per batch
REFRESH_INTERVAL = 60    # seconds between full refreshes


async def _fetch_page(client: httpx.AsyncClient, page: int) -> dict:
    r = await client.get(
        f"{HYPIXEL_BASE}/skyblock/auctions",
        params={"page": page},
        timeout=15,
    )
    r.raise_for_status()
    return r.json()


class AHIndex:
    def __init__(self) -> None:
        self._auctions: list[dict] = []
        self._total_pages: int = 0
        self._last_update: float = 0.0
        self._task: asyncio.Task | None = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> None:
        """Fetch initial data, then launch background refresh loop."""
        await self._refresh()
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
            await asyncio.sleep(REFRESH_INTERVAL)
            await self._refresh()

    async def _refresh(self) -> None:
        try:
            async with httpx.AsyncClient() as client:
                page0 = await _fetch_page(client, 0)
                total = page0.get("totalPages", 1)
                all_auctions: list[dict] = list(page0.get("auctions", []))

                for batch_start in range(1, total, BATCH_SIZE):
                    pages = range(batch_start, min(batch_start + BATCH_SIZE, total))
                    results = await asyncio.gather(
                        *[_fetch_page(client, p) for p in pages],
                        return_exceptions=True,
                    )
                    for r in results:
                        if isinstance(r, Exception):
                            continue
                        all_auctions.extend(r.get("auctions", []))

            self._auctions = all_auctions
            self._total_pages = total
            self._last_update = time.time()
            print(f"[AH] Indexed {len(all_auctions):,} auctions across {total} pages")

        except Exception as exc:
            print(f"[AH] Refresh failed: {exc}")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def search(self, query: str, bin_only: bool = False) -> list[dict]:
        q = query.lower()
        results = [
            a for a in self._auctions
            if q in a.get("item_name", "").lower()
            and (not bin_only or a.get("bin", False))
        ]
        results.sort(key=lambda x: x.get("starting_bid", 0))
        return results

    @property
    def total_pages(self) -> int:
        return self._total_pages

    @property
    def last_update(self) -> float:
        return self._last_update

    @property
    def auction_count(self) -> int:
        return len(self._auctions)

    @property
    def ready(self) -> bool:
        return self._last_update > 0


# Module-level singleton — imported by routers
ah_index = AHIndex()
