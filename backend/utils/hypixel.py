import os
import httpx
from typing import Optional
from .cache import cached

HYPIXEL_BASE = "https://api.hypixel.net"
PLAYERDB_BASE = "https://playerdb.co/api/player/minecraft"

# Loaded once from env (set by main.py calling load_dotenv before import)
_SERVER_API_KEY: str = ""


def load_api_key() -> None:
    global _SERVER_API_KEY
    _SERVER_API_KEY = os.environ.get("HYPIXEL_API_KEY", "")


def get_server_api_key() -> Optional[str]:
    return _SERVER_API_KEY or None


def _hypixel_error(r: httpx.Response) -> str:
    """Extract a human-readable error from a Hypixel API error response."""
    try:
        body = r.json()
        return body.get("cause") or body.get("message") or r.reason_phrase
    except Exception:
        return r.reason_phrase


async def get_bazaar() -> dict:
    return await cached("bazaar", ttl=90, fn=_fetch_bazaar)


async def _fetch_bazaar() -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(f"{HYPIXEL_BASE}/skyblock/bazaar")
        if not r.is_success:
            raise ValueError(f"Hypixel bazaar error: {_hypixel_error(r)}")
        return r.json()


async def get_auctions_raw(page: int = 0) -> dict:
    """Raw auction page fetch — used by AHIndex; not cached (index manages its own TTL)."""
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(f"{HYPIXEL_BASE}/skyblock/auctions", params={"page": page})
        if not r.is_success:
            raise ValueError(f"Hypixel auctions error: {_hypixel_error(r)}")
        return r.json()


async def get_ended_auctions() -> dict:
    return await cached("auctions:ended", ttl=60, fn=_fetch_ended_auctions)


async def _fetch_ended_auctions() -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(f"{HYPIXEL_BASE}/skyblock/auctions/ended")
        if not r.is_success:
            raise ValueError(f"Hypixel ended auctions error: {_hypixel_error(r)}")
        return r.json()


async def get_player_uuid(username: str) -> Optional[str]:
    cache_key = f"uuid:{username.lower()}"
    return await cached(cache_key, ttl=3600, fn=lambda: _fetch_uuid(username))


async def _fetch_uuid(username: str) -> Optional[str]:
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"{PLAYERDB_BASE}/{username}")
        if r.status_code == 404:
            return None
        r.raise_for_status()
        data = r.json()
        if not data.get("success"):
            return None
        return data["data"]["player"]["id"]


async def get_player_data(api_key: str, uuid: str) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{HYPIXEL_BASE}/player",
            params={"key": api_key, "uuid": uuid},
        )
        if not r.is_success:
            raise ValueError(f"Hypixel player error: {_hypixel_error(r)}")
        return r.json()


async def get_skyblock_profiles(api_key: str, uuid: str) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{HYPIXEL_BASE}/skyblock/profiles",
            params={"key": api_key, "uuid": uuid},
        )
        if not r.is_success:
            raise ValueError(f"Hypixel profiles error: {_hypixel_error(r)}")
        return r.json()
