const BASE = import.meta.env.VITE_API_BASE ?? '/api';
const DEFAULT_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(status, message) {
    super(message || 'Request failed');
    this.status = status;
  }
}

async function request(path, options = {}) {
  const { timeout = DEFAULT_TIMEOUT_MS, signal, headers, ...rest } = options;
  let controller;
  let timeoutId;

  if (!signal && timeout > 0) {
    controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), timeout);
  }

  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      Accept: 'application/json',
      ...(headers || {}),
    },
    signal: signal ?? controller?.signal,
  }).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const err = await res.json();
      detail = err.detail || err.message || detail;
    } catch {
      // ignore JSON parse errors
    }
    throw new ApiError(res.status, detail);
  }

  return res.json();
}

async function requestAbsolute(url, options = {}) {
  const { timeout = DEFAULT_TIMEOUT_MS, signal, headers, ...rest } = options;
  let controller;
  let timeoutId;

  if (!signal && timeout > 0) {
    controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), timeout);
  }

  const res = await fetch(url, {
    ...rest,
    headers: {
      Accept: 'application/json',
      ...(headers || {}),
    },
    signal: signal ?? controller?.signal,
  }).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const err = await res.json();
      detail = err.detail || err.message || detail;
    } catch {
      // ignore JSON parse errors
    }
    throw new ApiError(res.status, detail);
  }

  return res.json();
}

// Bazaar
export const fetchBazaarFlips   = (minVolume = 1000, minMargin = 2, limit = 200, options = {}) =>
  request(`/bazaar/flips?min_volume=${minVolume}&min_margin=${minMargin}&limit=${limit}`, options);
export const fetchBazaarSummary = (options = {}) => request('/bazaar/summary', options);
export const fetchBazaarHistory = (itemId, options = {}) =>
  request(`/bazaar/history/${encodeURIComponent(itemId)}`, options);
export const fetchBazaarHistoryLong = (itemId, range = '7d', options = {}) =>
  request(`/bazaar/history-long/${encodeURIComponent(itemId)}?range=${range}`, options);

// Auctions
export const fetchAuctionStatus  = (options = {}) => request('/auctions/status', options);
export const fetchEndedAuctions  = (options = {}) => request('/auctions/ended', options);
export const searchAuctions      = (query, binOnly = false, options = {}) =>
  request(`/auctions/search?query=${encodeURIComponent(query)}&bin_only=${binOnly}`, options);
export const fetchSniperResults  = (threshold = 20, minProfit = 100000, category = 'all', limit = 100, options = {}) =>
  request(`/auctions/sniper?threshold=${threshold}&min_profit=${minProfit}&category=${category}&limit=${limit}`, options);

// Player
export const fetchPlayer       = (username, options = {}) => request(`/player/${username}`, options);
export const fetchProfileStats = (username, profileId, options = {}) =>
  request(`/player/${username}/profile/${profileId}`, options);
export const fetchNetWorth     = (username, profileId, options = {}) =>
  request(`/player/${username}/networth${profileId ? `?profile_id=${profileId}` : ''}`, options);

// Mayor
export const fetchMayor = (options = {}) => request('/mayor', options);
export const fetchHealth = (options = {}) => request('/healthz', options);
export const fetchStatus = (options = {}) => request('/status', options);
export const fetchPriceItem = (itemId, options = {}) =>
  request(`/prices/item/${encodeURIComponent(itemId)}`, options);
export const fetchPriceBulk = (items, options = {}) =>
  request(`/prices/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
    ...options,
  });

// Formatting helpers
export function formatCoins(num) {
  if (!num && num !== 0) return '0';
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000)     return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000)         return `${(num / 1_000).toFixed(1)}K`;
  return Math.round(num).toLocaleString();
}

export function formatNumber(num) {
  if (!num && num !== 0) return '0';
  return num.toLocaleString();
}
