import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase, supabaseEnabled } from '../utils/supabase';

export function useTrackPage() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (!supabaseEnabled || !supabase) return;
    if (localStorage.getItem('sb:disable_events') === '1') return;
    let cancelled = false;
    async function send() {
      try {
        const { error } = await supabase.from('events').insert({
          event: 'page_view',
          path: pathname,
          ts: new Date().toISOString(),
          ua: navigator.userAgent,
        });
        if (!cancelled && error) {
          if (error.code === '42P01' || error.status === 404) {
            localStorage.setItem('sb:disable_events', '1');
          }
          // swallow errors to avoid breaking UI
        }
      } catch {
        // ignore
      }
    }
    send();
    return () => { cancelled = true; };
  }, [pathname]);
}
