import json
import os
from functools import lru_cache
from typing import Optional

_DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "manual_prices.json")


@lru_cache(maxsize=1)
def _load() -> dict:
    try:
        with open(_DATA_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        # Normalize keys to upper case
        return {str(k).upper(): float(v) for k, v in data.items()}
    except Exception:
        return {}


def lookup(item_id: str) -> Optional[float]:
    data = _load()
    return data.get(item_id.upper())


def bulk_lookup(item_ids: list[str]) -> dict[str, float]:
    data = _load()
    result: dict[str, float] = {}
    for item_id in item_ids:
        key = item_id.upper()
        if key in data:
            result[key] = data[key]
    return result
