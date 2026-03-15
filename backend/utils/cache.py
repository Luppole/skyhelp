"""Cache layer with Redis (optional) + in-process fallback."""
import json
import logging
import os
import time
from typing import Any, Awaitable, Callable, Optional

logger = logging.getLogger(__name__)

try:
    import redis.asyncio as redis
except Exception:  # pragma: no cover - optional dependency
    redis = None

_store: dict[str, tuple[float, Any]] = {}
_redis: Optional["redis.Redis"] = None
_redis_enabled = False


async def init_cache() -> None:
    global _redis, _redis_enabled
    url = os.environ.get("REDIS_URL", "").strip()
    if not url or not redis:
        _redis_enabled = False
        return
    try:
        _redis = redis.from_url(url, decode_responses=True)
        await _redis.ping()
        _redis_enabled = True
        logger.info("[Cache] Redis enabled")
    except Exception as exc:
        _redis_enabled = False
        _redis = None
        logger.warning("[Cache] Redis disabled: %s", exc)


async def close_cache() -> None:
    global _redis, _redis_enabled
    if _redis:
        try:
            await _redis.close()
        except Exception:
            pass
    _redis = None
    _redis_enabled = False


async def _get_redis(key: str) -> Optional[Any]:
    if not _redis_enabled or not _redis:
        return None
    try:
        raw = await _redis.get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception:
        return None


async def _set_redis(key: str, ttl: float, value: Any) -> None:
    if not _redis_enabled or not _redis:
        return
    try:
        await _redis.set(key, json.dumps(value), ex=int(ttl))
    except Exception:
        pass


async def cached(key: str, ttl: float, fn: Callable[[], Awaitable[Any]]) -> Any:
    # Redis first
    cached_val = await _get_redis(key)
    if cached_val is not None:
        return cached_val

    now = time.monotonic()
    if key in _store:
        ts, val = _store[key]
        if now - ts < ttl:
            return val

    result = await fn()
    _store[key] = (now, result)
    await _set_redis(key, ttl, result)
    return result


def invalidate(key: str) -> None:
    _store.pop(key, None)


def stats() -> dict:
    return {
        "entries": len(_store),
        "keys": list(_store.keys()),
        "redis_enabled": _redis_enabled,
    }
