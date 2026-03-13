import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Generic data-fetching hook.
 *
 * @param {Function} fetcher  - async function that returns data
 * @param {Array}    deps     - dependency array (re-fetches when these change)
 * @param {Object}   options
 * @param {boolean}  options.immediate  - fetch on mount (default true)
 * @param {number}   options.refreshInterval - auto-refresh in ms (0 = off)
 */
export function useFetch(fetcher, deps = [], { immediate = true, refreshInterval = 0 } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const fetcherRef = useRef(fetcher);
  const requestIdRef = useRef(0);
  const inFlightRef = useRef(null);
  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
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
      setData(result);
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

  return { data, loading, error, reload: load };
}
