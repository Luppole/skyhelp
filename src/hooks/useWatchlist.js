import { useState, useEffect, useCallback } from 'react';
import { fetchUserData, saveUserData } from '../utils/supabaseStore';

const STORAGE_KEY = 'sb-watchlist';

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); }
  catch { return []; }
}

/**
 * Persists a list of watched item IDs in localStorage + Supabase (when signed in).
 * Returns { watchlist: string[], toggle(itemId), isWatched(itemId) }
 */
export function useWatchlist(userId) {
  const [watchlist, setWatchlist] = useState(load);

  // Load from Supabase on sign-in
  useEffect(() => {
    let mounted = true;
    async function loadRemote() {
      if (!userId) return;
      const remote = await fetchUserData(userId, 'watchlist');
      if (mounted && Array.isArray(remote)) {
        setWatchlist(remote);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
      }
    }
    loadRemote();
    return () => { mounted = false; };
  }, [userId]);

  // Sync to Supabase whenever the list changes
  useEffect(() => {
    if (!userId) return;
    saveUserData(userId, 'watchlist', watchlist).catch(() => {});
  }, [watchlist, userId]);

  const toggle = useCallback((itemId) => {
    setWatchlist(prev => {
      const next = prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isWatched = useCallback((itemId) => watchlist.includes(itemId), [watchlist]);

  return { watchlist, toggle, isWatched };
}
