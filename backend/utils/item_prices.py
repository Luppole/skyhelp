"""
Live item price cache.

Priority per item_id: bazaar → lowest-BIN → 25th-pct ended-auction/bid → fallback

Special keys:
  Pets           → "PET_{TYPE}_{TIER}"            e.g.  PET_TIGER_LEGENDARY
  Enchanted books→ "ENCHANTMENT_{NAME}_{LEVEL}"   e.g.  ENCHANTMENT_SHARPNESS_6

Updated every REFRESH_INTERVAL seconds via a background task.
"""
import asyncio
import base64
import gzip
import json
import struct
import time
from typing import Optional

# ── Minimal binary NBT parser ──────────────────────────────────────────────────
_TAG_END = 0; _TAG_BYTE = 1; _TAG_SHORT = 2; _TAG_INT = 3; _TAG_LONG = 4
_TAG_FLOAT = 5; _TAG_DOUBLE = 6; _TAG_BYTE_ARRAY = 7; _TAG_STRING = 8
_TAG_LIST = 9; _TAG_COMPOUND = 10; _TAG_INT_ARRAY = 11; _TAG_LONG_ARRAY = 12
_SCALAR = {_TAG_BYTE: 1, _TAG_SHORT: 2, _TAG_INT: 4, _TAG_LONG: 8,
           _TAG_FLOAT: 4, _TAG_DOUBLE: 8}


def _nbt_read(buf: memoryview, pos: int, tag: int):
    if tag in _SCALAR:
        sz = _SCALAR[tag]
        return int.from_bytes(buf[pos:pos + sz], 'big', signed=True), pos + sz
    if tag == _TAG_STRING:
        slen = struct.unpack_from('>H', buf, pos)[0]; pos += 2
        return bytes(buf[pos:pos + slen]).decode('utf-8', 'replace'), pos + slen
    if tag == _TAG_BYTE_ARRAY:
        alen = struct.unpack_from('>i', buf, pos)[0]; return None, pos + 4 + alen
    if tag == _TAG_INT_ARRAY:
        alen = struct.unpack_from('>i', buf, pos)[0]; return None, pos + 4 + alen * 4
    if tag == _TAG_LONG_ARRAY:
        alen = struct.unpack_from('>i', buf, pos)[0]; return None, pos + 4 + alen * 8
    if tag == _TAG_LIST:
        elem = buf[pos]; pos += 1
        n = struct.unpack_from('>i', buf, pos)[0]; pos += 4
        items = []
        for _ in range(n):
            v, pos = _nbt_read(buf, pos, elem); items.append(v)
        return items, pos
    if tag == _TAG_COMPOUND:
        out = {}
        while True:
            ct = buf[pos]; pos += 1
            if ct == _TAG_END: break
            nl = struct.unpack_from('>H', buf, pos)[0]; pos += 2
            name = bytes(buf[pos:pos + nl]).decode('utf-8', 'replace'); pos += nl
            v, pos = _nbt_read(buf, pos, ct); out[name] = v
        return out, pos
    raise ValueError(f"Unknown NBT tag {tag}")


# ── AH item decoder ────────────────────────────────────────────────────────────

def _parse_auction_item(item_bytes_b64: str) -> tuple[Optional[str], dict]:
    """
    Decode item_bytes and return (pricing_key, enchants).

    pricing_key:
      - Regular item   → skyblock item_id         e.g. "HYPERION"
      - Pet (with info)→ "PET_{TYPE}_{TIER}"      e.g. "PET_TIGER_LEGENDARY"
      - Enchanted book → None   (enchants dict will be populated)
      - Pet (no info)  → None
    enchants: {name: level} — non-empty only for ENCHANTED_BOOK items
    """
    if not item_bytes_b64:
        return None, {}
    try:
        raw = base64.b64decode(item_bytes_b64)
        try:
            raw = gzip.decompress(raw)
        except Exception:
            pass
        buf = memoryview(raw)
        if len(buf) < 3 or buf[0] != _TAG_COMPOUND:
            return None, {}
        pos = 1
        nlen = struct.unpack_from('>H', buf, pos)[0]; pos += 2 + nlen
        root, _ = _nbt_read(buf, pos, _TAG_COMPOUND)
        items_list = root.get('i') or []
        if not items_list or not isinstance(items_list[0], dict):
            return None, {}
        item  = items_list[0]
        tag   = item.get('tag') or {}
        extra = tag.get('ExtraAttributes') or {}
        sid   = str(extra.get('id', '') or '').strip()
        if not sid:
            return None, {}

        # ── Enchanted book ───────────────────────────────────────────────
        if sid == 'ENCHANTED_BOOK':
            enc_raw  = extra.get('enchantments') or {}
            enchants = ({str(k): int(v) for k, v in enc_raw.items()
                         if isinstance(v, (int, float))}
                        if isinstance(enc_raw, dict) else {})
            return None, enchants

        # ── Pet ──────────────────────────────────────────────────────────
        if sid == 'PET':
            pet_info_str = str(extra.get('petInfo', '') or '')
            if pet_info_str:
                try:
                    pi    = json.loads(pet_info_str)
                    ptype = str(pi.get('type', '') or '').upper()
                    tier  = str(pi.get('tier', '') or '').upper()
                    if ptype and tier:
                        return f"PET_{ptype}_{tier}", {}
                except Exception:
                    pass
            return None, {}

        # ── Regular item ─────────────────────────────────────────────────
        return sid, {}

    except Exception:
        return None, {}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _register_bin(price: float, key: str, target: dict[str, list]) -> None:
    """Append a BIN price to the raw list for that key (we'll percentile later)."""
    target.setdefault(key, []).append(price)


def _register_auction(auction: dict, skip_bazaar: set,
                       out_bin_raw: dict, out_ah_raw: dict) -> None:
    """
    Extract pricing info from one auction dict and populate out_bin_raw / out_ah_raw.
    BIN auctions → out_bin_raw (list; we compute a low-percentile later).
    Non-BIN auctions with active bids → out_ah_raw (list for percentile calc).
    """
    is_bin = bool(auction.get('bin'))
    if is_bin:
        price = float(auction.get('starting_bid', 0) or 0)
    else:
        # Regular auction: only use it if someone has actually bid
        price = float(auction.get('highest_bid_amount', 0) or 0)
        if price <= 0:
            return

    if price <= 0:
        return

    item_bytes = auction.get('item_bytes', '')
    if not item_bytes:
        return

    key, enchants = _parse_auction_item(item_bytes)

    if enchants:
        # Enchanted book — store each enchantment
        for enc_name, enc_level in enchants.items():
            enc_key = f"ENCHANTMENT_{enc_name.upper()}_{enc_level}"
            if enc_key in skip_bazaar:
                continue
            if is_bin:
                _register_bin(price, enc_key, out_bin_raw)
            else:
                out_ah_raw.setdefault(enc_key, []).append(price)
    elif key and key not in skip_bazaar:
        if is_bin:
            _register_bin(price, key, out_bin_raw)
        else:
            out_ah_raw.setdefault(key, []).append(price)


# ── Price cache ────────────────────────────────────────────────────────────────

REFRESH_INTERVAL = 90  # seconds


class ItemPriceCache:
    """
    Background-updated price dict.

    Sources (priority):
      bazaar  → bazaar quick_status.sellPrice
      bin     → lowest active BIN per item/pet/enchant
      ah      → 25th-pct of: ended-auction sale prices + active bid prices
    """

    def __init__(self) -> None:
        self._bazaar: dict[str, float] = {}
        self._bin:    dict[str, float] = {}
        self._ah:     dict[str, float] = {}
        self._last_update: float = 0.0
        self._task: Optional[asyncio.Task] = None

    # ── Lifecycle ──────────────────────────────────────────────────────────

    async def start(self) -> None:
        await self._update()
        self._task = asyncio.create_task(self._loop())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _loop(self) -> None:
        while True:
            await asyncio.sleep(REFRESH_INTERVAL)
            await self._update()

    # ── Update ─────────────────────────────────────────────────────────────

    async def _update(self) -> None:
        from .hypixel import get_bazaar, get_ended_auctions
        from .ah_index import ah_index
        try:
            bazaar_resp, ended_resp = await asyncio.gather(
                get_bazaar(),
                get_ended_auctions(),
                return_exceptions=True,
            )

            # ── 1. Bazaar ────────────────────────────────────────────────
            new_bazaar: dict[str, float] = {}
            if not isinstance(bazaar_resp, Exception):
                for item_id, data in bazaar_resp.get('products', {}).items():
                    sell = (data.get('quick_status') or {}).get('sellPrice', 0) or 0
                    if sell > 0:
                        new_bazaar[item_id] = float(sell)

            skip = set(new_bazaar)  # don't override bazaar items with AH prices
            new_bin_raw: dict[str, list[float]] = {}
            new_ah_raw:  dict[str, list[float]] = {}

            # ── 2. Ended auctions (recent sales) ─────────────────────────
            if not isinstance(ended_resp, Exception):
                for auction in ended_resp.get('auctions', []):
                    price = float(auction.get('price', 0) or 0)
                    if price <= 0:
                        continue
                    item_bytes = auction.get('item_bytes', '')
                    if not item_bytes:
                        continue
                    key, enchants = _parse_auction_item(item_bytes)
                    if enchants:
                        for enc_name, enc_level in enchants.items():
                            enc_key = f"ENCHANTMENT_{enc_name.upper()}_{enc_level}"
                            if enc_key not in skip:
                                new_ah_raw.setdefault(enc_key, []).append(price)
                    elif key and key not in skip:
                        new_ah_raw.setdefault(key, []).append(price)

            # ── 3. Active AH (BIN = collect for percentile; non-BIN bids = soft signal)
            if ah_index.ready:
                for auction in ah_index._auctions:
                    _register_auction(auction, skip, new_bin_raw, new_ah_raw)

            # ── 4. Compute BIN price: 10th percentile of active listings ─
            # Using 10th-percentile (rather than the absolute lowest) removes
            # price-manipulation listings and single outlier cheap BINs while
            # still giving a conservative floor that reflects real market value.
            new_bin: dict[str, float] = {}
            for key, prices in new_bin_raw.items():
                s = sorted(prices)
                idx = max(0, min(len(s) - 1, len(s) // 10))  # 10th percentile
                new_bin[key] = s[idx]

            # ── 5. Compute AH 25th-percentile from ended / bid prices ─────
            new_ah: dict[str, float] = {}
            for key, prices in new_ah_raw.items():
                s = sorted(prices)
                new_ah[key] = s[max(0, len(s) // 4)]

            self._bazaar = new_bazaar
            self._bin    = new_bin
            self._ah     = new_ah
            self._last_update = time.time()

            pet_keys = sum(1 for k in new_bin if k.startswith('PET_'))
            enc_keys = sum(1 for k in new_bin if k.startswith('ENCHANTMENT_'))
            print(
                f"[ItemPrices] bazaar={len(new_bazaar):,}  "
                f"bin={len(new_bin):,} (pets={pet_keys} encs={enc_keys})  "
                f"ah={len(new_ah):,}"
            )

        except Exception as exc:
            print(f"[ItemPrices] update failed: {exc}")

    # ── Public API ─────────────────────────────────────────────────────────

    def get(self, item_id: str, fallback: float = 0.0) -> float:
        """Bazaar > lowest BIN > 25th-pct AH > fallback."""
        return (self._bazaar.get(item_id)
                or self._bin.get(item_id)
                or self._ah.get(item_id)
                or fallback)

    def get_bazaar(self, item_id: str) -> float:
        return self._bazaar.get(item_id, 0.0)

    def get_bin(self, item_id: str) -> float:
        return self._bin.get(item_id, 0.0)

    def get_ah(self, item_id: str) -> float:
        return self._ah.get(item_id, 0.0)

    @property
    def ready(self) -> bool:
        return self._last_update > 0

    @property
    def item_count(self) -> int:
        return len(self._bazaar) + len(self._bin) + len(self._ah)


# Module-level singleton imported by routers
item_prices = ItemPriceCache()
