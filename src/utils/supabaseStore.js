import { supabase, supabaseEnabled } from './supabase';

export async function fetchUserData(userId, key) {
  if (!supabaseEnabled || !supabase || !userId) return null;
  const { data, error } = await supabase
    .from('user_data')
    .select('data')
    .eq('user_id', userId)
    .eq('key', key)
    .maybeSingle();
  if (error && (error.code === '42P01' || error.status === 404)) {
    return null;
  }
  return data?.data ?? null;
}

export async function saveUserData(userId, key, data) {
  if (!supabaseEnabled || !supabase || !userId) return;
  const { error } = await supabase.from('user_data').upsert({
    user_id: userId,
    key,
    data,
    updated_at: new Date().toISOString(),
  });
  if (error && (error.code === '42P01' || error.status === 404)) {
    return;
  }
}
