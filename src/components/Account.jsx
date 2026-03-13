import { useState } from 'react';
import { User, LogIn, LogOut, Mail } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import { supabase, supabaseEnabled } from '../utils/supabase';
import { useSupabaseUser } from '../hooks/useSupabaseUser';

export default function Account() {
  const { user, loading } = useSupabaseUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [info, setInfo] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function signIn() {
    setError('');
    setStatus('');
    setInfo('');
    if (!supabase) return;
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError(err.message);
    else setStatus('Signed in successfully.');
  }

  async function signUp() {
    setError('');
    setStatus('');
    setInfo('');
    if (!supabase) return;
    const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
    });
    if (err) setError(err.message);
    else setStatus('Check your email to confirm your account.');
  }

  async function signOut() {
    setError('');
    setStatus('');
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  async function resetPassword() {
    setError('');
    setStatus('');
    setInfo('');
    if (!supabase) return;
    const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (err) setError(err.message);
    else setInfo('Password reset email sent.');
  }

  return (
    <div className="page">
      <PageHeader
        icon={User}
        title="Account"
        description="Create an account to sync data, alerts, and preferences."
      />

      {!supabaseEnabled && (
        <div className="info-box">
          Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
        </div>
      )}

      {error && <div className="error-box">{error}</div>}
      {status && <div className="info-box">{status}</div>}
      {info && <div className="info-box">{info}</div>}

      {loading && <div className="spinner" />}

      {!loading && user && (
        <div className="card">
          <div className="card__title">Signed In</div>
          <div className="stat-row">
            <span className="stat-row__label">Email</span>
            <span className="stat-row__value">{user.email}</span>
          </div>
          <button className="btn-secondary" onClick={signOut}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      )}

      {!loading && !user && (
        <div className="card">
          <div className="card__title">Sign In or Create Account</div>
          <div className="field" style={{ maxWidth: 320 }}>
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="field" style={{ maxWidth: 320 }}>
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn-primary" onClick={signIn} disabled={!email || !password || !supabaseEnabled}>
              <LogIn size={14} /> Sign in
            </button>
            <button className="btn-secondary" onClick={signUp} disabled={!email || !password || !supabaseEnabled}>
              <Mail size={14} /> Sign up
            </button>
          </div>
          <button
            className="btn-ghost"
            onClick={resetPassword}
            disabled={!email || !supabaseEnabled}
            style={{ marginTop: 8 }}
          >
            Send password reset
          </button>
        </div>
      )}
    </div>
  );
}
