import { useEffect, useState } from 'react';
import { useSupabaseUser } from './useSupabaseUser';
import { fetchUserData, saveUserData } from '../utils/supabaseStore';

function loadLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function useUserData(key, fallback) {
  const storageKey = `sb:${key}`;
  const [value, setValue] = useState(() => loadLocal(storageKey, fallback));
  const { user } = useSupabaseUser();

  useEffect(() => {
    let mounted = true;
    async function loadRemote() {
      if (!user) return;
      const remote = await fetchUserData(user.id, key);
      if (mounted && remote != null) {
        setValue(remote);
        saveLocal(storageKey, remote);
      }
    }
    loadRemote();
    return () => { mounted = false; };
  }, [user, key, storageKey]);

  useEffect(() => {
    saveLocal(storageKey, value);
    if (!user) return;
    saveUserData(user.id, key, value).catch(() => {});
  }, [value, user, key, storageKey]);

  return [value, setValue];
}
