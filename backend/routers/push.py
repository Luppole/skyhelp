"""
Push notification subscription management + background alert checker.

Required env vars:
  VAPID_PRIVATE_KEY   — base64url VAPID private key
  VAPID_PUBLIC_KEY    — base64url VAPID public key
  VAPID_EMAIL         — mailto:you@example.com  (for VAPID subject)
  SUPABASE_URL        — Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY — Supabase service role key (to read/write push subs & alerts)
"""

import asyncio
import json
import logging
import os
import time
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

log = logging.getLogger(__name__)
router = APIRouter(prefix="/push", tags=["push"])

# ── Helpers ──────────────────────────────────────────────────────────────────

def _supabase_headers() -> dict:
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

def _supabase_url() -> str:
    return os.environ.get("SUPABASE_URL", "").rstrip("/")

def _vapid_configured() -> bool:
    return bool(
        os.environ.get("VAPID_PRIVATE_KEY")
        and os.environ.get("VAPID_PUBLIC_KEY")
        and os.environ.get("VAPID_EMAIL")
    )

# ── Schemas ───────────────────────────────────────────────────────────────────

class SubscribeRequest(BaseModel):
    user_id: str
    subscription: dict   # PushSubscription JSON (endpoint + keys)

class UnsubscribeRequest(BaseModel):
    user_id: str
    endpoint: str

# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/subscribe")
async def push_subscribe(req: SubscribeRequest):
    """Store a push subscription in Supabase."""
    import httpx
    base = _supabase_url()
    if not base:
        raise HTTPException(503, "Supabase not configured")

    endpoint = req.subscription.get("endpoint", "")
    if not endpoint:
        raise HTTPException(400, "Missing subscription endpoint")

    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(
            f"{base}/rest/v1/push_subscriptions",
            headers={**_supabase_headers(), "Prefer": "resolution=merge-duplicates"},
            json={
                "user_id":      req.user_id,
                "endpoint":     endpoint,
                "subscription": req.subscription,
                "updated_at":   "now()",
            },
        )
    if r.status_code not in (200, 201):
        log.warning("push subscribe error %s: %s", r.status_code, r.text[:200])
    return {"ok": True}


@router.post("/unsubscribe")
async def push_unsubscribe(req: UnsubscribeRequest):
    """Remove a push subscription from Supabase."""
    import httpx
    base = _supabase_url()
    if not base:
        return {"ok": True}

    async with httpx.AsyncClient(timeout=10) as client:
        await client.delete(
            f"{base}/rest/v1/push_subscriptions",
            headers=_supabase_headers(),
            params={"user_id": f"eq.{req.user_id}", "endpoint": f"eq.{req.endpoint}"},
        )
    return {"ok": True}


@router.get("/vapid-public-key")
async def vapid_public_key():
    """Return the VAPID public key so the frontend can subscribe."""
    key = os.environ.get("VAPID_PUBLIC_KEY", "")
    return {"key": key, "configured": bool(key)}


# ── Background alert checker ──────────────────────────────────────────────────

async def _send_push(subscription: dict, payload: dict) -> bool:
    """Send a Web Push notification using pywebpush. Returns True on success."""
    try:
        from pywebpush import webpush, WebPushException
        webpush(
            subscription_info=subscription,
            data=json.dumps(payload),
            vapid_private_key=os.environ.get("VAPID_PRIVATE_KEY", ""),
            vapid_claims={"sub": os.environ.get("VAPID_EMAIL", "mailto:admin@skyhelper.gg")},
        )
        return True
    except Exception as exc:
        log.debug("push send failed: %s", exc)
        return False


async def run_alert_checker():
    """
    Background loop: every 60 s, fetch bazaar prices, then for every push
    subscription check whether the user's saved alerts have triggered.
    """
    import httpx

    while True:
        try:
            await _check_all_alerts()
        except Exception as exc:
            log.warning("alert checker error: %s", exc)
        await asyncio.sleep(60)


async def _check_all_alerts():
    import httpx
    from ..utils.hypixel import get_bazaar

    if not _vapid_configured():
        return
    base = _supabase_url()
    if not base:
        return

    # 1. Fetch bazaar prices
    bz_raw = await get_bazaar()
    price_map: dict[str, dict] = {}
    for item_id, product in bz_raw.get("products", {}).items():
        qs = product.get("quick_status", {})
        price_map[item_id] = {
            "buy":  float(qs.get("buyPrice", 0)),
            "sell": float(qs.get("sellPrice", 0)),
        }

    # 2. Fetch all push subscriptions
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{base}/rest/v1/push_subscriptions",
            headers={**_supabase_headers(), "Prefer": "return=representation"},
            params={"select": "user_id,subscription"},
        )
        if r.status_code != 200:
            return
        subscriptions = r.json()

    # 3. For each subscriber, fetch their alerts and check
    async with httpx.AsyncClient(timeout=15) as client:
        for sub_row in subscriptions:
            user_id      = sub_row["user_id"]
            subscription = sub_row["subscription"]
            await _check_user_alerts(client, base, user_id, subscription, price_map)


async def _check_user_alerts(client, base: str, user_id: str, subscription: dict, price_map: dict):
    # Fetch alerts from user_data table
    r = await client.get(
        f"{base}/rest/v1/user_data",
        headers=_supabase_headers(),
        params={"user_id": f"eq.{user_id}", "key": "eq.price_alerts", "select": "data"},
    )
    if r.status_code != 200:
        return
    rows = r.json()
    if not rows:
        return
    alerts = rows[0].get("data", [])
    if not isinstance(alerts, list):
        return

    for alert in alerts:
        if alert.get("triggered"):
            continue
        item_id     = alert.get("itemId", "")
        direction   = alert.get("direction", "below")
        target      = float(alert.get("targetPrice", 0))
        price_type  = alert.get("priceType", "buy")
        item_name   = alert.get("itemName", item_id)

        prices = price_map.get(item_id)
        if not prices:
            continue
        current = prices[price_type]
        triggered = (
            (direction == "below" and current <= target) or
            (direction == "above" and current >= target)
        )
        if not triggered:
            continue

        # Fire push notification
        payload = {
            "title": f"🔔 {item_name} alert triggered!",
            "body":  (
                f"Price {'dropped below' if direction == 'below' else 'rose above'} "
                f"{target:,.0f} coins — now {current:,.0f}"
            ),
            "url":   "/alerts",
            "tag":   f"alert-{item_id}",
        }
        await asyncio.get_event_loop().run_in_executor(
            None, lambda s=subscription, p=payload: _send_push_sync(s, p)
        )


def _send_push_sync(subscription: dict, payload: dict) -> bool:
    try:
        from pywebpush import webpush
        webpush(
            subscription_info=subscription,
            data=json.dumps(payload),
            vapid_private_key=os.environ.get("VAPID_PRIVATE_KEY", ""),
            vapid_claims={"sub": os.environ.get("VAPID_EMAIL", "mailto:admin@skyhelper.gg")},
        )
        return True
    except Exception as exc:
        log.debug("push sync send failed: %s", exc)
        return False
