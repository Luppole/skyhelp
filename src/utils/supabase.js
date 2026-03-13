import { createClient } from '@supabase/supabase-js';

function normalizeSupabaseUrl(raw) {
  if (!raw) return '';
  let value = raw.trim();
  if (value.endsWith('/')) value = value.slice(0, -1);
  if (value.endsWith('/rest/v1')) value = value.slice(0, -8);
  if (value.endsWith('/auth/v1')) value = value.slice(0, -8);
  return value;
}

const url = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseEnabled = Boolean(url && anonKey);
export const supabase = supabaseEnabled
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
