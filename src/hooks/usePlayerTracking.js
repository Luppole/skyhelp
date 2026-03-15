/**
 * usePlayerTracking
 *
 * Saves and loads full player net-worth snapshots so users can track changes
 * over time.  Data flows to/from:
 *   1. Supabase `player_snapshots` table (when signed in).
 *   2. localStorage (always — acts as a local cache / offline fallback).
 *
 * The `snapshot` object is the complete /player/{ign}/networth API response,
 * so it captures literally everything: total, breakdown, all inventories,
 * pets, purse, bank, wardrobe, etc.
 */
import { useCallback } from 'react';
import { supabase, supabaseEnabled } from '../utils/supabase';

const LOCAL_KEY = (username) =>
  `player_snapshots_${username.toLowerCase().trim()}`;

function loadLocal(username) {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY(username)) || '[]');
  } catch {
    return [];
  }
}

function saveLocal(username, snapshots) {
  try {
    localStorage.setItem(LOCAL_KEY(username), JSON.stringify(snapshots));
  } catch { /* quota exceeded — ignore */ }
}

export function usePlayerTracking(userId) {
  /**
   * Save a full snapshot for a player.
   * @param {string} username    — Minecraft IGN
   * @param {string} profileName — SkyBlock profile cute-name
   * @param {object} data        — complete net-worth API response
   * @returns {boolean} true on success
   */
  const saveSnapshot = useCallback(async (username, profileName, data) => {
    if (!data || !username) return false;

    const now = new Date().toISOString();
    const row = {
      minecraft_username: username.toLowerCase().trim(),
      profile_name: profileName || null,
      net_worth: Math.round(data.total || 0),
      snapshot: {
        // Everything from the API response
        total:          data.total,
        breakdown:      data.breakdown,
        username:       data.username,
        profile:        data.profile,
        pets:           data.pets,
        inv_all:        data.inv_all,
        ec_pages:       data.ec_pages,
        wardrobe_sets:  data.wardrobe_sets,
        backpack_slots: data.backpack_slots,
        vault_all:      data.vault_all,
        talisman_all:   data.talisman_all,
        fishing_all:    data.fishing_all,
        equipment_all:  data.equipment_all,
        saved_at:       now,
      },
    };

    // ── Supabase ──────────────────────────────────────────────────────────
    if (supabaseEnabled && supabase && userId) {
      try {
        const { error } = await supabase
          .from('player_snapshots')
          .insert({ ...row, user_id: userId });
        if (error) console.warn('[PlayerTracking] Supabase insert:', error.message);
      } catch (err) {
        console.warn('[PlayerTracking] Supabase error:', err);
      }
    }

    // ── Local cache (keep last 50 per player) ────────────────────────────
    const local = loadLocal(username);
    const next = [
      ...local.slice(-49),
      {
        net_worth:    row.net_worth,
        profile_name: row.profile_name,
        breakdown:    row.snapshot.breakdown,
        pets_count:   row.snapshot.pets?.length || 0,
        saved_at:     now,
        created_at:   now,
      },
    ];
    saveLocal(username, next);
    return true;
  }, [userId]);

  /**
   * Load all saved snapshots for a player (most recent first).
   * Falls back to localStorage when not signed in.
   */
  const loadSnapshots = useCallback(async (username) => {
    if (!username) return [];

    if (supabaseEnabled && supabase && userId) {
      try {
        const { data, error } = await supabase
          .from('player_snapshots')
          .select('id, net_worth, profile_name, snapshot, created_at')
          .eq('user_id', userId)
          .eq('minecraft_username', username.toLowerCase().trim())
          .order('created_at', { ascending: false })
          .limit(50);

        if (!error && data?.length) {
          // Also refresh local cache
          saveLocal(username, data.map(r => ({
            net_worth:    r.net_worth,
            profile_name: r.profile_name,
            breakdown:    r.snapshot?.breakdown,
            pets_count:   r.snapshot?.pets?.length || 0,
            saved_at:     r.created_at,
            created_at:   r.created_at,
          })));
          return data;
        }
      } catch (err) {
        console.warn('[PlayerTracking] loadSnapshots error:', err);
      }
    }

    // Fallback to local
    return loadLocal(username).reverse(); // most-recent first
  }, [userId]);

  /**
   * Delete a single snapshot by id (Supabase-only).
   */
  const deleteSnapshot = useCallback(async (id) => {
    if (!supabaseEnabled || !supabase || !userId) return;
    await supabase
      .from('player_snapshots')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
  }, [userId]);

  return { saveSnapshot, loadSnapshots, deleteSnapshot };
}
