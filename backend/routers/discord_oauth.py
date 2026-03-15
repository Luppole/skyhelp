"""
Discord OAuth 2.0 integration.

Flow:
  1.  GET /auth/discord/initiate?state=<base64(supabase_uid)>
        → returns the Discord OAuth URL for the frontend to redirect to.
  2.  Discord redirects the user to:
        GET /auth/discord/callback?code=…&state=…
        → exchanges code for Discord user info, upserts into
          discord_connections via Supabase REST API (service role),
          then redirects the browser to FRONTEND_URL/account?discord=connected.

Required env vars:
  DISCORD_CLIENT_ID      — your Discord application client ID
  DISCORD_CLIENT_SECRET  — your Discord application client secret
  DISCORD_REDIRECT_URI   — full callback URL, e.g. https://yourdomain.com/auth/discord/callback
                           (must match what's registered in Discord dev portal)

Optional:
  FRONTEND_URL           — where to redirect after OAuth  (default: http://localhost:5173)
  SUPABASE_URL           — fallback from VITE_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
"""
import os
import httpx
from fastapi import APIRouter
from fastapi.responses import JSONResponse, RedirectResponse
from starlette.requests import Request

router = APIRouter(prefix="/auth/discord", tags=["discord"])

DISCORD_CLIENT_ID     = os.environ.get("DISCORD_CLIENT_ID", "")
DISCORD_CLIENT_SECRET = os.environ.get("DISCORD_CLIENT_SECRET", "")
FRONTEND_URL          = os.environ.get("FRONTEND_URL", "http://localhost:5173").rstrip("/")
SUPABASE_URL          = (
    os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL", "")
).rstrip("/")
SUPABASE_SERVICE_KEY  = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


def _redirect_uri(request: Request) -> str:
    """Return the Discord callback URL."""
    forced = os.environ.get("DISCORD_REDIRECT_URI", "")
    if forced:
        return forced
    scheme = "https" if request.headers.get("x-forwarded-proto") == "https" else request.url.scheme
    return f"{scheme}://{request.url.netloc}/auth/discord/callback"


# ── Initiate ─────────────────────────────────────────────────────────────────

@router.get("/initiate")
async def initiate(request: Request, state: str = ""):
    """
    Return the Discord OAuth URL.
    The frontend base64-encodes the Supabase user_id into `state`.
    """
    if not DISCORD_CLIENT_ID:
        return JSONResponse({"error": "DISCORD_CLIENT_ID not configured"}, status_code=501)

    redirect_uri = _redirect_uri(request)
    url = (
        "https://discord.com/api/oauth2/authorize"
        f"?client_id={DISCORD_CLIENT_ID}"
        f"&redirect_uri={httpx.URL(redirect_uri)}"
        f"&response_type=code"
        f"&scope=identify"
        f"&state={state}"
    )
    return JSONResponse({"url": url, "redirect_uri": redirect_uri})


# ── Callback ─────────────────────────────────────────────────────────────────

@router.get("/callback")
async def callback(
    request: Request,
    code:  str = "",
    state: str = "",
    error: str = "",
):
    """Exchange Discord authorization code → user info → Supabase upsert."""
    if error or not code:
        return RedirectResponse(
            f"{FRONTEND_URL}/account?discord_error={error or 'missing_code'}"
        )

    # Decode state → supabase user_id (frontend sent btoa(user.id))
    import base64
    try:
        supabase_uid = base64.b64decode(state + "==").decode("utf-8").strip()
    except Exception:
        supabase_uid = state  # fallback: raw value

    redirect_uri = _redirect_uri(request)

    async with httpx.AsyncClient(timeout=10) as client:
        # 1. Exchange code for Discord access token
        token_res = await client.post(
            "https://discord.com/api/oauth2/token",
            data={
                "client_id":     DISCORD_CLIENT_ID,
                "client_secret": DISCORD_CLIENT_SECRET,
                "grant_type":    "authorization_code",
                "code":          code,
                "redirect_uri":  redirect_uri,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if not token_res.is_success:
            return RedirectResponse(
                f"{FRONTEND_URL}/account?discord_error=token_exchange_failed"
            )

        access_token = token_res.json().get("access_token", "")

        # 2. Fetch Discord user identity
        user_res = await client.get(
            "https://discord.com/api/users/@me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if not user_res.is_success:
            return RedirectResponse(
                f"{FRONTEND_URL}/account?discord_error=user_fetch_failed"
            )

        discord_user = user_res.json()

        # 3. Upsert into Supabase discord_connections (service-role bypass RLS)
        if SUPABASE_URL and SUPABASE_SERVICE_KEY and supabase_uid:
            await client.post(
                f"{SUPABASE_URL}/rest/v1/discord_connections",
                headers={
                    "apikey":        SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    "Content-Type":  "application/json",
                    "Prefer":        "resolution=merge-duplicates,return=minimal",
                },
                json={
                    "user_id":          supabase_uid,
                    "discord_id":       discord_user.get("id", ""),
                    "discord_username": discord_user.get("username", ""),
                    "discord_avatar":   discord_user.get("avatar", ""),
                },
            )

    return RedirectResponse(f"{FRONTEND_URL}/account?discord=connected")
