import os
import httpx
from typing import Optional
from .cache import cached

HYPIXEL_BASE = "https://api.hypixel.net"
MOJANG_BASE   = "https://api.mojang.com"

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
    """Resolve a Minecraft username to UUID via the official Mojang API."""
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"{MOJANG_BASE}/users/profiles/minecraft/{username}")
        if r.status_code in (204, 404):
            return None
        if not r.is_success:
            raise ValueError(f"Mojang API error {r.status_code} for '{username}'")
        data = r.json()
        # Mojang returns UUID without dashes — Hypixel accepts both formats
        return data.get("id")


def _v2_headers(api_key: str) -> dict:
    """Hypixel API v2 uses the API-Key request header instead of ?key= query param."""
    return {"API-Key": api_key}


async def get_player_data(api_key: str, uuid: str) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{HYPIXEL_BASE}/v2/player",
            params={"uuid": uuid},
            headers=_v2_headers(api_key),
        )
        if not r.is_success:
            raise ValueError(f"Hypixel player error {r.status_code}: {_hypixel_error(r)}")
        return r.json()


async def get_player_auctions(api_key: str, uuid: str) -> dict:
    """Player's active AH auctions — not cached (changes every minute)."""
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{HYPIXEL_BASE}/skyblock/auction",
            params={"player": uuid},
            headers=_v2_headers(api_key),
        )
        if not r.is_success:
            raise ValueError(f"Hypixel player auctions error {r.status_code}: {_hypixel_error(r)}")
        return r.json()


async def get_profile_auctions(api_key: str, profile_id: str) -> dict:
    """Active auctions for a specific SkyBlock profile ID."""
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{HYPIXEL_BASE}/skyblock/auction",
            params={"profile": profile_id},
            headers=_v2_headers(api_key),
        )
        if not r.is_success:
            raise ValueError(f"Hypixel profile auctions error {r.status_code}: {_hypixel_error(r)}")
        return r.json()


# ── v2 SkyBlock profile endpoints ────────────────────────────────────────────

async def get_skyblock_profiles(api_key: str, uuid: str) -> dict:
    """All SkyBlock profiles for a player — cached 3 min."""
    cache_key = f"sb_profiles:{uuid}"
    return await cached(cache_key, ttl=180, fn=lambda: _fetch_skyblock_profiles(api_key, uuid))


async def _fetch_skyblock_profiles(api_key: str, uuid: str) -> dict:
    """GET /v2/skyblock/profiles?uuid=UUID  (API-Key header auth)."""
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(
            f"{HYPIXEL_BASE}/v2/skyblock/profiles",
            params={"uuid": uuid},
            headers=_v2_headers(api_key),
        )
        if not r.is_success:
            raise ValueError(f"Hypixel v2 profiles error {r.status_code}: {_hypixel_error(r)}")
        return r.json()


async def get_skyblock_profile(api_key: str, profile_id: str) -> dict:
    """Single SkyBlock profile by ID — cached 3 min.
    Uses GET /v2/skyblock/profile?profile=PROFILE_ID  (much lighter than fetching all profiles).
    """
    cache_key = f"sb_profile:{profile_id}"
    return await cached(cache_key, ttl=180, fn=lambda: _fetch_skyblock_profile(api_key, profile_id))


async def _fetch_skyblock_profile(api_key: str, profile_id: str) -> dict:
    """GET /v2/skyblock/profile?profile=PROFILE_ID  (API-Key header auth)."""
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(
            f"{HYPIXEL_BASE}/v2/skyblock/profile",
            params={"profile": profile_id},
            headers=_v2_headers(api_key),
        )
        if not r.is_success:
            raise ValueError(f"Hypixel v2 profile error {r.status_code}: {_hypixel_error(r)}")
        return r.json()
