import { createContext, useContext, useMemo, useState, useEffect } from 'react';
import AuthModal from './AuthModal';
import { supabase, supabaseEnabled } from '../utils/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [open,        setOpen]        = useState(false);
  const [initialMode, setInitialMode] = useState('signin');

  // Detect password-recovery flow: Supabase fires PASSWORD_RECOVERY when
  // the user lands with #access_token=...&type=recovery in the URL hash.
  useEffect(() => {
    if (!supabaseEnabled || !supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        // Strip the token from the URL bar without navigation
        history.replaceState(null, '', window.location.pathname + window.location.search);
        setInitialMode('new-password');
        setOpen(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo(() => ({
    openAuth:  (mode = 'signin') => { setInitialMode(mode); setOpen(true); },
    closeAuth: () => setOpen(false),
  }), []);

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthModal
        open={open}
        initialMode={initialMode}
        onClose={() => setOpen(false)}
      />
    </AuthContext.Provider>
  );
}

export function useAuthModal() {
  const ctx = useContext(AuthContext);
  if (!ctx) return { openAuth: () => {}, closeAuth: () => {} };
  return ctx;
}
