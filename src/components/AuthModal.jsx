import { useState } from 'react';
import { LogIn, Mail, X, LogOut, KeyRound, User, AtSign, Lock, ArrowLeft, CheckCircle } from 'lucide-react';
import { supabase, supabaseEnabled } from '../utils/supabase';
import { useSupabaseUser } from '../hooks/useSupabaseUser';

export default function AuthModal({ open, onClose }) {
  const { user, loading } = useSupabaseUser();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [feedback, setFeedback] = useState(null); // { type: 'error'|'success'|'info', msg }
  const [busy, setBusy]         = useState(false);
  const [mode, setMode]         = useState('signin'); // 'signin' | 'signup' | 'reset'

  if (!open) return null;

  function switchMode(m) { setFeedback(null); setMode(m); }

  async function signIn() {
    setFeedback(null); setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setFeedback({ type: 'error', msg: error.message });
    else { setFeedback({ type: 'success', msg: 'Signed in!' }); setTimeout(onClose, 900); }
  }

  async function signUp() {
    setFeedback(null); setBusy(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) setFeedback({ type: 'error', msg: error.message });
    else setFeedback({ type: 'success', msg: 'Check your email to confirm your account.' });
  }

  async function signOut() {
    await supabase.auth.signOut();
    onClose();
  }

  async function resetPassword() {
    setFeedback(null); setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    setBusy(false);
    if (error) setFeedback({ type: 'error', msg: error.message });
    else setFeedback({ type: 'success', msg: 'Reset email sent — check your inbox.' });
  }

  const titleMap = { signin: 'Welcome back', signup: 'Create account', reset: 'Reset password' };
  const subtitleMap = { signin: 'Sign in to sync your settings', signup: 'Start tracking your SkyBlock progress', reset: 'Enter your email to get a reset link' };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal auth-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Account"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="auth-modal__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="auth-modal__icon">
              <User size={18} />
            </div>
            <div className="auth-modal__title-wrap">
              <div className="auth-modal__title">
                {user ? 'Account' : titleMap[mode]}
              </div>
              {!user && (
                <div className="auth-modal__subtitle">{subtitleMap[mode]}</div>
              )}
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>

        {/* ── Mode tabs (only for sign-in / sign-up) ── */}
        {!user && !loading && mode !== 'reset' && (
          <div className="auth-modal__tabs">
            <button
              className={`auth-modal__tab${mode === 'signin' ? ' active' : ''}`}
              onClick={() => switchMode('signin')}
            >
              Sign in
            </button>
            <button
              className={`auth-modal__tab${mode === 'signup' ? ' active' : ''}`}
              onClick={() => switchMode('signup')}
            >
              Create account
            </button>
          </div>
        )}

        {/* ── Body ── */}
        <div className="auth-modal__body">

          {/* Supabase not configured notice */}
          {!supabaseEnabled && (
            <div className="info-box">
              <strong style={{ display: 'block', marginBottom: 6 }}>Auth not configured</strong>
              Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your{' '}
              <code>.env</code> file to enable accounts.
            </div>
          )}

          {/* Feedback banner */}
          {feedback && (
            <div
              className={feedback.type === 'error' ? 'error-box' : 'info-box'}
              style={feedback.type === 'success' ? { borderColor: 'var(--green)', display: 'flex', alignItems: 'center', gap: 8 } : {}}
            >
              {feedback.type === 'success' && <CheckCircle size={14} color="var(--green)" />}
              {feedback.msg}
            </div>
          )}

          {/* Loading */}
          {loading && <div className="spinner" style={{ margin: '16px auto' }} />}

          {/* ── Signed-in state ── */}
          {!loading && user && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="auth-modal__user-card">
                <div className="auth-modal__avatar">
                  {user.email?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="auth-modal__user-info">
                  <div className="auth-modal__user-email">{user.email}</div>
                  <div className="auth-modal__user-label">Signed in</div>
                </div>
                <span className="tag tag-green" style={{ fontSize: 10 }}>Active</span>
              </div>
              <button className="btn-secondary" onClick={signOut}>
                <LogOut size={14} /> Sign out
              </button>
            </div>
          )}

          {/* ── Auth forms ── */}
          {!loading && !user && (
            <>
              {/* Back button for reset mode */}
              {mode === 'reset' && (
                <button
                  className="btn-ghost btn-sm"
                  onClick={() => switchMode('signin')}
                  style={{ alignSelf: 'flex-start', marginBottom: -4 }}
                >
                  <ArrowLeft size={12} /> Back to sign in
                </button>
              )}

              {/* Email field */}
              <div className="field" style={{ margin: 0 }}>
                <label>Email</label>
                <div className="auth-modal__input-wrap">
                  <span className="auth-modal__input-icon"><AtSign size={14} /></span>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    disabled={!supabaseEnabled || busy}
                    onKeyDown={e => e.key === 'Enter' && mode === 'signin' && signIn()}
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password field */}
              {mode !== 'reset' && (
                <div className="field" style={{ margin: 0 }}>
                  <label>Password</label>
                  <div className="auth-modal__input-wrap">
                    <span className="auth-modal__input-icon"><Lock size={14} /></span>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={!supabaseEnabled || busy}
                      onKeyDown={e => e.key === 'Enter' && mode === 'signin' && signIn()}
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    />
                  </div>
                </div>
              )}

              {/* Primary action */}
              <div className="auth-modal__actions">
                {mode === 'signin' && (
                  <button
                    className="btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={signIn}
                    disabled={!email || !password || !supabaseEnabled || busy}
                  >
                    {busy ? <span className="spinner spinner-sm" /> : <LogIn size={14} />}
                    Sign in
                  </button>
                )}
                {mode === 'signup' && (
                  <button
                    className="btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={signUp}
                    disabled={!email || !password || !supabaseEnabled || busy}
                  >
                    {busy ? <span className="spinner spinner-sm" /> : <Mail size={14} />}
                    Create account
                  </button>
                )}
                {mode === 'reset' && (
                  <button
                    className="btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={resetPassword}
                    disabled={!email || !supabaseEnabled || busy}
                  >
                    {busy ? <span className="spinner spinner-sm" /> : <KeyRound size={14} />}
                    Send reset email
                  </button>
                )}
              </div>

              {/* Forgot password link — only on sign-in tab */}
              {mode === 'signin' && (
                <>
                  <div className="auth-modal__divider">
                    <span>or</span>
                  </div>
                  <button
                    className="btn-ghost btn-sm"
                    style={{ alignSelf: 'center' }}
                    onClick={() => switchMode('reset')}
                    disabled={!supabaseEnabled}
                  >
                    <KeyRound size={12} /> Forgot password?
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
