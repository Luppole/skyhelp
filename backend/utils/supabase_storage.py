import os
import httpx


def _get_config() -> tuple[str, str]:
    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        raise RuntimeError("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set")
    return url, key


async def upload_public_object(bucket: str, object_path: str, content: bytes, content_type: str) -> None:
    url, key = _get_config()
    endpoint = f"{url}/storage/v1/object/{bucket}/{object_path}"
    headers = {
        "Authorization": f"Bearer {key}",
        "apikey": key,
        "Content-Type": content_type,
        "x-upsert": "true",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.put(endpoint, content=content, headers=headers)
        r.raise_for_status()
