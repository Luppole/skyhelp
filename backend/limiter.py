import base64
import json
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request


def _get_user_or_ip(request: Request) -> str:
    """Use Supabase user ID from JWT when available, else fall back to IP."""
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        token = auth[7:]
        parts = token.split(".")
        if len(parts) == 3:
            try:
                payload = parts[1]
                # Restore base64 padding
                payload += "=" * (4 - len(payload) % 4)
                data = json.loads(base64.b64decode(payload).decode("utf-8"))
                sub = data.get("sub")
                if sub:
                    return f"user:{sub}"
            except Exception:
                pass
    return get_remote_address(request)


limiter = Limiter(key_func=_get_user_or_ip, default_limits=["200/minute"])
