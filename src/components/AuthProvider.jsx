import { createContext, useContext, useMemo, useState } from 'react';
import AuthModal from './AuthModal';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [open, setOpen] = useState(false);

  const value = useMemo(() => ({
    openAuth: () => setOpen(true),
    closeAuth: () => setOpen(false),
  }), []);

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthModal open={open} onClose={() => setOpen(false)} />
    </AuthContext.Provider>
  );
}

export function useAuthModal() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return { openAuth: () => {}, closeAuth: () => {} };
  }
  return ctx;
}
