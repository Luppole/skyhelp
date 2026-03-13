from contextlib import asynccontextmanager
import os
import time
from dotenv import load_dotenv

load_dotenv()  # must run before any module reads os.environ

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .limiter import limiter
from .utils.hypixel import load_api_key
from .utils.ah_index import ah_index
from .utils.price_history import price_history
from .utils.cache import stats as cache_stats, init_cache, close_cache
from .routers import bazaar, auctions, player, mayor, prices

START_TIME = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_api_key()
    await init_cache()
    await ah_index.start()
    await price_history.start()
    yield
    await price_history.stop()
    await ah_index.stop()
    await close_cache()


app = FastAPI(
    title="Hypixel SkyBlock Tool API",
    description="Bazaar flips, AH search, player stats, mayor and events, all server-side cached.",
    version="3.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_origins = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bazaar.router,   prefix="/api")
app.include_router(auctions.router, prefix="/api")
app.include_router(player.router,   prefix="/api")
app.include_router(mayor.router,    prefix="/api")
app.include_router(prices.router,   prefix="/api")


@app.get("/")
async def root():
    return {
        "status": "ok",
        "ah_index": {
            "ready":    ah_index.ready,
            "auctions": ah_index.auction_count,
            "pages":    ah_index.total_pages,
        },
    }


@app.get("/healthz")
async def healthz():
    return {
        "status": "ok",
        "uptime_seconds": round(time.time() - START_TIME, 1),
        "ah_index_ready": ah_index.ready,
        "price_history_ready": price_history.last_snapshot > 0,
    }


@app.get("/api/status")
async def api_status():
    return {
        "uptime_seconds": round(time.time() - START_TIME, 1),
        "cache": cache_stats(),
        "ah_index": {
            "ready": ah_index.ready,
            "auctions": ah_index.auction_count,
            "pages": ah_index.total_pages,
            "last_update": ah_index.last_update,
        },
        "price_history": {
            "tracked_items": price_history.tracked_items,
            "tracked_items_long": price_history.tracked_items_long,
            "last_snapshot": price_history.last_snapshot,
        },
    }
