import asyncio
import gzip
import base64
import io
from fastapi import APIRouter, HTTPException, Request, Header
from typing import Optional

try:
    import nbtlib
    HAS_NBTLIB = True
except ImportError:
    HAS_NBTLIB = False

from ..utils.hypixel import get_player_uuid, get_player_data, get_skyblock_profiles, get_server_api_key
from ..utils.calculators import analyze_profile
from ..limiter import limiter

router = APIRouter(prefix="/player", tags=["player"])


def _resolve_key(header_key: Optional[str]) -> str:
    key = get_server_api_key() or header_key
    if not key:
        raise HTTPException(
            status_code=401,
            detail="No Hypixel API key configured. Set HYPIXEL_API_KEY in .env or pass X-Api-Key header.",
        )
    return key


def _decode_inventory(data_b64: str) -> list[dict]:
    """Decode base64-gzipped NBT inventory to list of {id, count}."""
    if not HAS_NBTLIB or not data_b64:
        return []
    try:
        raw = base64.b64decode(data_b64)
        try:
            raw = gzip.decompress(raw)
        except Exception:
            pass
        nbt = nbtlib.load(fileobj=io.BytesIO(raw))
        items = []
        for item in nbt.get("", {}).get("i", []):
            if not item:
                continue
            tag = item.get("tag", {})
            if not tag:
                continue
            extra = tag.get("ExtraAttributes", {})
            item_id = str(extra.get("id", "")).strip()
            count = int(item.get("Count", 1))
            if item_id:
                items.append({"id": item_id, "count": count})
        return items
    except Exception:
        return []


# Approximate market values for common items (fallback when not in bazaar)
_KNOWN_VALUES: dict[str, float] = {
    "ASPECT_OF_THE_DRAGONS": 3_500_000,
    "SHADOW_FURY": 12_000_000,
    "HYPERION": 700_000_000,
    "SCYLLA": 400_000_000,
    "VALKYRIE": 300_000_000,
    "TERMINATOR": 550_000_000,
    "NECRON_BLADE": 200_000_000,
    "LIVID_DAGGER": 8_000_000,
    "PIGMAN_SWORD": 2_500_000,
    "ASPECT_OF_THE_END": 600_000,
    "NECRON_HANDLE": 10_000_000,
    "WITHER_HELMET": 5_000_000,
    "WITHER_CHESTPLATE": 8_000_000,
    "WITHER_LEGGINGS": 6_000_000,
    "WITHER_BOOTS": 5_000_000,
    "STRONG_DRAGON_HELMET": 1_000_000,
    "STRONG_DRAGON_CHESTPLATE": 2_000_000,
    "STRONG_DRAGON_LEGGINGS": 1_500_000,
    "STRONG_DRAGON_BOOTS": 1_000_000,
    "SUPERIOR_DRAGON_HELMET": 3_000_000,
    "SUPERIOR_DRAGON_CHESTPLATE": 5_000_000,
}

PET_BASE_VALUES: dict[str, dict[str, float]] = {
    "TIGER":      {"COMMON": 100_000, "UNCOMMON": 500_000, "RARE": 2_000_000, "EPIC": 8_000_000, "LEGENDARY": 50_000_000},
    "LION":       {"COMMON": 50_000,  "UNCOMMON": 200_000, "RARE": 1_000_000, "EPIC": 4_000_000, "LEGENDARY": 20_000_000},
    "ENDER DRAGON":{"EPIC": 100_000_000, "LEGENDARY": 300_000_000},
    "GOLDEN DRAGON":{"LEGENDARY": 800_000_000},
    "GRIFFIN":    {"RARE": 2_000_000, "EPIC": 10_000_000, "LEGENDARY": 80_000_000},
    "ENDERMAN":   {"UNCOMMON": 300_000, "RARE": 1_000_000, "EPIC": 4_000_000, "LEGENDARY": 15_000_000},
    "BLAZE":      {"UNCOMMON": 200_000, "RARE": 800_000, "EPIC": 3_000_000, "LEGENDARY": 10_000_000},
}


def _estimate_pet_value(pet: dict) -> float:
    ptype = pet.get("type", "").upper().replace("_", " ")
    tier = pet.get("tier", "COMMON").upper()
    tiers = PET_BASE_VALUES.get(ptype, {})
    return tiers.get(tier, 50_000)


@router.get("/{username}")
@limiter.limit("20/minute")
async def player_lookup(
    request: Request,
    username: str,
    x_api_key: Optional[str] = Header(None, alias="x-api-key"),
):
    api_key = _resolve_key(x_api_key)

    try:
        uuid = await get_player_uuid(username)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Player '{username}' not found")

    if not uuid:
        raise HTTPException(status_code=404, detail=f"Player '{username}' not found")

    try:
        player_data, profiles_data = await asyncio.gather(
            get_player_data(api_key, uuid),
            get_skyblock_profiles(api_key, uuid),
        )
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Hypixel API error: {e}")

    profiles = profiles_data.get("profiles", []) or []

    selected_profile = None
    latest_save = 0
    for p in profiles:
        member = p.get("members", {}).get(uuid.replace("-", ""), {})
        save_time = member.get("last_save", 0)
        if save_time > latest_save:
            latest_save = save_time
            selected_profile = p

    analyzed = None
    if selected_profile:
        try:
            analyzed = analyze_profile(selected_profile, uuid)
        except Exception:
            pass

    return {
        "uuid": uuid,
        "username": username,
        "player": player_data.get("player", {}),
        "profiles": [
            {
                "profile_id": p.get("profile_id"),
                "cute_name": p.get("cute_name"),
                "selected": p.get("selected", False),
            }
            for p in profiles
        ],
        "active_profile": {
            "cute_name": selected_profile.get("cute_name") if selected_profile else None,
            "profile_id": selected_profile.get("profile_id") if selected_profile else None,
            "stats": analyzed,
        },
    }


@router.get("/{username}/profile/{profile_id}")
@limiter.limit("20/minute")
async def profile_stats(
    request: Request,
    username: str,
    profile_id: str,
    x_api_key: Optional[str] = Header(None, alias="x-api-key"),
):
    api_key = _resolve_key(x_api_key)

    try:
        uuid = await get_player_uuid(username)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Player '{username}' not found")

    try:
        profiles_data = await get_skyblock_profiles(api_key, uuid)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))

    profiles = profiles_data.get("profiles", []) or []
    target = next((p for p in profiles if p.get("profile_id") == profile_id), None)

    if not target:
        raise HTTPException(status_code=404, detail="Profile not found")

    try:
        stats = analyze_profile(target, uuid)
        error = None
    except Exception as exc:
        stats = None
        error = str(exc)

    return {
        "profile_id": profile_id,
        "cute_name": target.get("cute_name"),
        "stats": stats,
        "error": error,
    }


@router.get("/{username}/networth")
@limiter.limit("10/minute")
async def networth(
    request: Request,
    username: str,
    profile_id: Optional[str] = None,
    x_api_key: Optional[str] = Header(None, alias="x-api-key"),
):
    """Estimate a player's net worth across all storage locations."""
    api_key = _resolve_key(x_api_key)

    try:
        uuid = await get_player_uuid(username)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Player '{username}' not found")

    try:
        profiles_data = await get_skyblock_profiles(api_key, uuid)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))

    profiles = profiles_data.get("profiles", []) or []

    if profile_id:
        profile = next((p for p in profiles if p.get("profile_id") == profile_id), None)
    else:
        # Most recently active
        profile = None
        latest = 0
        for p in profiles:
            m = p.get("members", {}).get(uuid.replace("-", ""), {})
            t = m.get("last_save", 0)
            if t > latest:
                latest = t
                profile = p

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    member = profile.get("members", {}).get(uuid.replace("-", ""), {})

    # ── Liquid coins ──────────────────────────────────────────────────────
    purse   = float(member.get("purse", 0) or 0)
    banking = float((profile.get("banking") or {}).get("balance", 0) or 0)

    # ── Pets ──────────────────────────────────────────────────────────────
    pets_raw = (member.get("pets_data") or {}).get("pets", []) or []
    pets_value = sum(_estimate_pet_value(p) for p in pets_raw)
    pets_list = [
        {
            "type": p.get("type"),
            "tier": p.get("tier"),
            "active": p.get("active", False),
            "value": _estimate_pet_value(p),
        }
        for p in sorted(pets_raw, key=_estimate_pet_value, reverse=True)[:20]
    ]

    # ── Inventory items ──────────────────────────────────────────────────
    def price_items(items: list[dict]) -> tuple[float, list[dict]]:
        valued = []
        total = 0.0
        for it in items:
            item_id = it["id"]
            val = _KNOWN_VALUES.get(item_id, 0) * it["count"]
            if val > 0:
                total += val
                valued.append({**it, "value": val})
        return total, valued

    inv_items   = _decode_inventory((member.get("inv_contents") or {}).get("data", ""))
    ec_items    = _decode_inventory((member.get("ender_chest_contents") or {}).get("data", ""))
    ward_items  = _decode_inventory((member.get("wardrobe_contents") or {}).get("data", ""))

    inv_val,  inv_valued  = price_items(inv_items)
    ec_val,   ec_valued   = price_items(ec_items)
    ward_val, ward_valued = price_items(ward_items)

    # ── Minions ────────────────────────────────────────────────────────────
    crafted = member.get("crafted_generators", []) or []
    minion_count = len(crafted)

    # ── Summary ───────────────────────────────────────────────────────────
    total = purse + banking + pets_value + inv_val + ec_val + ward_val

    return {
        "username": username,
        "profile": profile.get("cute_name"),
        "total": round(total),
        "breakdown": {
            "purse":       round(purse),
            "bank":        round(banking),
            "pets":        round(pets_value),
            "inventory":   round(inv_val),
            "ender_chest": round(ec_val),
            "wardrobe":    round(ward_val),
        },
        "pets":        pets_list,
        "inv_items":   sorted(inv_valued,  key=lambda x: x["value"], reverse=True)[:30],
        "ec_items":    sorted(ec_valued,   key=lambda x: x["value"], reverse=True)[:30],
        "ward_items":  sorted(ward_valued, key=lambda x: x["value"], reverse=True)[:20],
        "minion_count": minion_count,
    }
