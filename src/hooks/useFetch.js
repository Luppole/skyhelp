import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Module-level in-memory cache shared across all hook instances.
 * Entries: { data, expiresAt }
 */
const _cache = new Map();

/**
 * Generic data-fetching hook.
 *
 * @param {Function} fetcher  - async function that returns data
 * @param {Array}    deps     - dependency array (re-fetches when these change)
 * @param {Object}   options
 * @param {boolean}  options.immediate        - fetch on mount (default true)
 * @param {number}   options.refreshInterval  - auto-refresh in ms (0 = off)
 * @param {string}   options.cacheKey         - if set, cache result for cacheTtl ms
 * @param {number}   options.cacheTtl         - cache lifetime in ms (default 30 000)
 */
export function useFetch(
  fetcher,
  deps = [],
  { immediate = true, refreshInterval = 0, cacheKey = null, cacheTtl = 30_000 } = {},
) {
  const cached = cacheKey ? _cache.get(cacheKey) : null;
  const now = Date.now();
  const initialData = cached && cached.expiresAt > now ? cached.data : null;

  const [data, setData]                 = useState(initialData);
  const [loading, setLoading]           = useState(immediate && !initialData);
  const [error, setError]               = useState(null);
  const [lastFetchedAt, setLastFetchedAt] = useState(initialData ? now : null);

  const fetcherRef   = useRef(fetcher);
  const requestIdRef = useRef(0);
  const inFlightRef  = useRef(null);
  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
    // Serve from cache if still fresh (stale-while-revalidate: show cached, refresh in bg)
    if (cacheKey) {
      const hit = _cache.get(cacheKey);
      if (hit && hit.expiresAt > Date.now()) {
        setData(hit.data);
        setLastFetchedAt(hit.fetchedAt);
        setLoading(false);
        return;
      }
    }

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    if (inFlightRef.current) {
      inFlightRef.current.abort();
    }
    const controller = new AbortController();
    inFlightRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current({ signal: controller.signal });
      if (requestId !== requestIdRef.current || controller.signal.aborted) return;

      const fetchedAt = Date.now();
      if (cacheKey) {
        _cache.set(cacheKey, { data: result, fetchedAt, expiresAt: fetchedAt + cacheTtl });
      }
      setData(result);
      setLastFetchedAt(fetchedAt);
    } catch (e) {
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      setError(e.message ?? 'Unknown error');
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (immediate) load();
  }, [load, immediate]);

  useEffect(() => {
    if (!refreshInterval) return;
    const id = setInterval(load, refreshInterval);
    return () => clearInterval(id);
  }, [load, refreshInterval]);

  useEffect(() => () => {
    if (inFlightRef.current) inFlightRef.current.abort();
  }, []);

  return { data, loading, error, reload: load, lastFetchedAt };
}
