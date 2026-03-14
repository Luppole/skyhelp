import { useState, useEffect } from 'react';
import {
  LogIn, Mail, X, LogOut, KeyRound, User, AtSign, Lock,
  ArrowLeft, CheckCircle, Eye, EyeOff, ShieldCheck, Zap, BarChart2,
} from 'lucide-react';
import { supabase, supabaseEnabled } from '../utils/supabase';
import { useSupabaseUser } from '../hooks/useSupabaseUser';

const PERKS = [
  { icon: BarChart2, text: 'Sync alerts & watchlist across devices' },
  { icon: Zap,       text: 'Background push notifications for price alerts' },
  { icon: ShieldCheck, text: 'Portfolio saved to the cloud automatically' },
];

function PasswordInput({ value, onChange, onEnter, disabled, placeholder = '••••••••', autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="auth-modal__input-wrap">
      <span className="auth-modal__input-icon"><Lock size={14} /></span>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        onKeyDown={e => e.key === 'Enter' && onEnter?.()}
        autoComplete={autoComplete}
        style={{ paddingRight: 40 }}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="auth-modal__pw-toggle"
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
    </div>
  );
}

export default function AuthModal({ open, initialMode = 'signin', onClose }) {
  const { user, loading } = useSupabaseUser();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [feedback, setFeedback] = useState(null);
  const [busy,     setBusy]     = useState(false);
  const [mode,     setMode]     = useState(initialMode);

  // Sync mode when prop changes (e.g. PASSWORD_RECOVERY opens modal at 'new-password')
  useEffect(() => { if (open) setMode(initialMode); }, [open, initialMode]);

  if (!open) return null;

  function switchMode(m) { setFeedback(null); setPassword(''); setConfirm(''); setMode(m); }
  function ok(msg)  { setFeedback({ type: 'success', msg }); }
  function err(msg) { setFeedback({ type: 'error',   msg }); }

  async function signIn() {
    setBusy(true); setFeedback(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) err(error.message);
    else { ok('Signed in!'); setTimeout(onClose, 800); }
  }

  async function signUp() {
    setBusy(true); setFeedback(null);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) err(error.message);
    else ok('Check your email to confirm your account.');
  }

  async function signOut() {
    await supabase.auth.signOut();
    onClose();
  }

  async function sendReset() {
    setBusy(true); setFeedback(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    setBusy(false);
    if (error) err(error.message);
    else ok('Reset email sent — check your inbox.');
  }

  async function setNewPassword() {
    if (password !== confirm) { err("Passwords don't match."); return; }
    if (password.length < 8)  { err('Password must be at least 8 characters.'); return; }
    setBusy(true); setFeedback(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) err(error.message);
    else { ok('Password updated! You are now signed in.'); setTimeout(onClose, 1200); }
  }

  const TITLES = {
    signin:       'Welcome back',
    signup:       'Create account',
    reset:        'Reset password',
    'new-password': 'Set new password',
  };
  const SUBS = {
    signin:       'Sign in to sync your SkyBlock progress',
    signup:       'Start tracking your SkyBlock empire',
    reset:        "We'll email you a secure reset link",
    'new-password': 'Choose a new password for your account',
  };

  const isAuthForm = !user && !loading;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal auth-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Account"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Branded header ─────────────────────────────────────────────── */}
        <div className="auth-modal__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="auth-modal__icon">
              {mode === 'new-password' ? <KeyRound size={18} /> : <User size={18} />}
            </div>
            <div className="auth-modal__title-wrap">
              <div className="auth-modal__brand">SkyHelper</div>
              <div className="auth-modal__title">
                {user ? 'Account' : TITLES[mode]}
              </div>
              {!user && (
                <div className="auth-modal__subtitle">{SUBS[mode]}</div>
              )}
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>

        {/* ── Sign-in / Sign-up tabs ──────────────────────────────────────── */}
        {isAuthForm && mode !== 'reset' && mode !== 'new-password' && (
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

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="auth-modal__body">

          {/* Supabase not configured */}
          {!supabaseEnabled && (
            <div className="info-box">
              <strong style={{ display: 'block', marginBottom: 6 }}>Auth not configured</strong>
              Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your{' '}
              <code>.env</code> file.
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

          {loading && <div className="spinner" style={{ margin: '16px auto' }} />}

          {/* ── Signed-in view ─────────────────────────────────────────── */}
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

          {/* ── Auth forms ─────────────────────────────────────────────── */}
          {isAuthForm && (
            <>
              {/* Email field */}
              {mode !== 'new-password' && (
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
              )}

              {/* Password fields */}
              {(mode === 'signin' || mode === 'signup') && (
                <div className="field" style={{ margin: 0 }}>
                  <label>Password</label>
                  <PasswordInput
                    value={password}
                    onChange={setPassword}
                    onEnter={mode === 'signin' ? signIn : undefined}
                    disabled={!supabaseEnabled || busy}
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  />
                </div>
              )}

              {/* New password fields */}
              {mode === 'new-password' && (
                <>
                  <div className="field" style={{ margin: 0 }}>
                    <label>New password</label>
                    <PasswordInput
                      value={password}
                      onChange={setPassword}
                      disabled={!supabaseEnabled || busy}
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                    />
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label>Confirm password</label>
                    <PasswordInput
                      value={confirm}
                      onChange={setConfirm}
                      onEnter={setNewPassword}
                      disabled={!supabaseEnabled || busy}
                      autoComplete="new-password"
                    />
                  </div>
                </>
              )}

              {/* Perks list — only on signup */}
              {mode === 'signup' && (
                <div className="auth-modal__perks">
                  {PERKS.map(({ icon: Icon, text }) => (
                    <div key={text} className="auth-modal__perk">
                      <Icon size={13} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Primary CTA */}
              <div className="auth-modal__actions">
                {mode === 'signin' && (
                  <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                    onClick={signIn} disabled={!email || !password || !supabaseEnabled || busy}>
                    {busy ? <span className="spinner spinner-sm" /> : <LogIn size={14} />}
                    Sign in
                  </button>
                )}
                {mode === 'signup' && (
                  <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                    onClick={signUp} disabled={!email || !password || !supabaseEnabled || busy}>
                    {busy ? <span className="spinner spinner-sm" /> : <Mail size={14} />}
                    Create account
                  </button>
                )}
                {mode === 'reset' && (
                  <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                    onClick={sendReset} disabled={!email || !supabaseEnabled || busy}>
                    {busy ? <span className="spinner spinner-sm" /> : <KeyRound size={14} />}
                    Send reset email
                  </button>
                )}
                {mode === 'new-password' && (
                  <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                    onClick={setNewPassword} disabled={!password || !confirm || !supabaseEnabled || busy}>
                    {busy ? <span className="spinner spinner-sm" /> : <ShieldCheck size={14} />}
                    Set new password
                  </button>
                )}
              </div>

              {/* Footer links */}
              {mode === 'signin' && (
                <div className="auth-modal__footer-links">
                  <button className="auth-modal__text-link" onClick={() => switchMode('reset')} disabled={!supabaseEnabled}>
                    Forgot password?
                  </button>
                </div>
              )}
              {mode === 'reset' && (
                <div className="auth-modal__footer-links">
                  <button className="auth-modal__text-link" onClick={() => switchMode('signin')}>
                    <ArrowLeft size={11} /> Back to sign in
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
