import { useEffect, useState } from 'react';
import { User, LogIn, LogOut, Mail, Link, Link2Off, RefreshCw, ShieldCheck } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import { supabase, supabaseEnabled } from '../utils/supabase';
import { useSupabaseUser } from '../hooks/useSupabaseUser';

const API_BASE        = import.meta.env.VITE_API_BASE ?? '/api';
const DISCORD_ENABLED = Boolean(import.meta.env.VITE_DISCORD_CLIENT_ID);

export default function Account() {
  const { user, loading } = useSupabaseUser();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [info, setInfo]         = useState('');
  const [status, setStatus]     = useState('');
  const [error, setError]       = useState('');

  // Discord state
  const [discordConn, setDiscordConn]       = useState(null);
  const [discordLoading, setDiscordLoading] = useState(false);

  // Load Discord connection whenever the signed-in user changes
  useEffect(() => {
    if (!user || !supabase) { setDiscordConn(null); return; }
    supabase
      .from('discord_connections')
      .select('discord_id, discord_username, discord_avatar')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setDiscordConn(data ?? null));
  }, [user]);

  // Handle the OAuth redirect back from Discord (/account?discord=connected)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('discord') === 'connected') {
      setStatus('Discord connected successfully!');
      window.history.replaceState({}, '', '/account');
      if (user && supabase) {
        supabase
          .from('discord_connections')
          .select('discord_id, discord_username, discord_avatar')
          .eq('user_id', user.id)
          .maybeSingle()
          .then(({ data }) => setDiscordConn(data ?? null));
      }
    } else if (params.get('discord_error')) {
      setError(`Discord connection failed: ${params.get('discord_error').replace(/_/g, ' ')}`);
      window.history.replaceState({}, '', '/account');
    }
  }, [user]);

  // ── Discord ─────────────────────────────────────────────────────────────
  async function connectDiscord() {
    if (!user) { setError('Please sign in first.'); return; }
    setDiscordLoading(true);
    setError('');
    try {
      const state = btoa(user.id);
      const res   = await fetch(`${API_BASE}/auth/discord/initiate?state=${state}`);
      if (!res.ok) throw new Error('Backend returned an error');
      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      setError(`Could not start Discord OAuth: ${err.message}`);
      setDiscordLoading(false);
    }
  }

  async function disconnectDiscord() {
    if (!user || !supabase) return;
    await supabase.from('discord_connections').delete().eq('user_id', user.id);
    setDiscordConn(null);
    setStatus('Discord disconnected.');
  }

  // ── Auth ────────────────────────────────────────────────────────────────
  function clearMessages() { setError(''); setStatus(''); setInfo(''); }

  async function signIn() {
    clearMessages();
    if (!supabase) return;
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError(err.message);
    else setStatus('Signed in successfully.');
  }

  async function signUp() {
    clearMessages();
    if (!supabase) return;
    const { error: err } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (err) setError(err.message);
    else setStatus('Check your email to confirm your account.');
  }

  async function signOut() {
    clearMessages();
    if (!supabase) return;
    await supabase.auth.signOut();
    setDiscordConn(null);
  }

  async function resetPassword() {
    clearMessages();
    if (!supabase) return;
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (err) setError(err.message);
    else setInfo('Password reset email sent. Check your inbox.');
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  const avatarUrl = discordConn?.discord_avatar
    ? `https://cdn.discordapp.com/avatars/${discordConn.discord_id}/${discordConn.discord_avatar}.png?size=64`
    : null;

  return (
    <div className="page">
      <PageHeader
        icon={User}
        title="Account"
        description="Sign in to sync data across devices and connect integrations."
      />

      {!supabaseEnabled && (
        <div className="info-box">
          Supabase is not configured — set <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> in your <code>.env</code>.
        </div>
      )}

      {error  && <div className="error-box">{error}</div>}
      {status && <div className="info-box">{status}</div>}
      {info   && <div className="info-box">{info}</div>}

      {loading && <div className="spinner" />}

      {/* ── Signed-in ──────────────────────────────────────────────────── */}
      {!loading && user && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Profile card */}
          <div className="card">
            <div className="card__title"><ShieldCheck size={14} /> Account</div>
            <div className="stat-row">
              <span className="stat-row__label">Email</span>
              <span className="stat-row__value">{user.email}</span>
            </div>
            <div className="stat-row">
              <span className="stat-row__label">User ID</span>
              <span
                className="stat-row__value text-muted"
                style={{ fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all' }}
              >
                {user.id}
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-row__label">Cloud Sync</span>
              <span className="stat-row__value" style={{ fontSize: 12, color: 'var(--green)' }}>
                ● Active — portfolio, alerts &amp; preferences sync automatically
              </span>
            </div>
            <button className="btn-secondary" onClick={signOut} style={{ marginTop: 14 }}>
              <LogOut size={14} /> Sign out
            </button>
          </div>

          {/* Discord card */}
          <div className="card">
            <div className="card__title">
              <span style={{ color: '#5865F2', fontWeight: 700 }}>Discord</span>
              {discordConn
                ? <span className="tag tag-green"                                style={{ marginLeft: 8, fontSize: 10 }}>Connected</span>
                : <span className="tag" style={{ marginLeft: 8, fontSize: 10, background: 'var(--bg-4)' }}>Not connected</span>}
            </div>

            {discordConn ? (
              /* ─ Connected ─ */
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                {avatarUrl && (
                  <img
                    src={avatarUrl}
                    alt={`${discordConn.discord_username} avatar`}
                    style={{ width: 52, height: 52, borderRadius: '50%', border: '2px solid var(--border-bright)' }}
                  />
                )}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{discordConn.discord_username}</div>
                  <div className="text-muted" style={{ fontSize: 11 }}>
                    Discord ID: {discordConn.discord_id}
                  </div>
                </div>
                <button
                  className="btn-secondary btn-sm"
                  onClick={disconnectDiscord}
                  style={{ marginLeft: 'auto' }}
                >
                  <Link2Off size={13} /> Disconnect
                </button>
              </div>
            ) : (
              /* ─ Not connected ─ */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
                  Link your Discord account to use bot commands (
                  <code>/player</code>, <code>/flip</code>, <code>/price</code>…),
                  receive price-alert notifications, and unlock role-gated features.
                </p>
                <div>
                  <button
                    className="btn-primary"
                    onClick={connectDiscord}
                    disabled={discordLoading || !DISCORD_ENABLED}
                    style={{ background: '#5865F2', borderColor: '#5865F2' }}
                  >
                    {discordLoading
                      ? <><RefreshCw size={14} className="spin" /> Connecting…</>
                      : <><Link size={14} /> Connect Discord</>}
                  </button>
                  {!DISCORD_ENABLED && (
                    <div className="text-muted" style={{ fontSize: 11, marginTop: 6 }}>
                      Set <code>VITE_DISCORD_CLIENT_ID</code> in <code>.env</code> to enable.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Signed-out ─────────────────────────────────────────────────── */}
      {!loading && !user && (
        <div className="card">
          <div className="card__title">Sign In or Create Account</div>
          <p className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>
            Your portfolio, tracked players, price alerts, and preferences are all
            tied to your account and sync across every device.
          </p>
          <div className="field" style={{ maxWidth: 320 }}>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && signIn()}
            />
          </div>
          <div className="field" style={{ maxWidth: 320 }}>
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && signIn()}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              className="btn-primary"
              onClick={signIn}
              disabled={!email || !password || !supabaseEnabled}
            >
              <LogIn size={14} /> Sign in
            </button>
            <button
              className="btn-secondary"
              onClick={signUp}
              disabled={!email || !password || !supabaseEnabled}
            >
              <Mail size={14} /> Sign up
            </button>
          </div>
          <button
            className="btn-ghost"
            onClick={resetPassword}
            disabled={!email || !supabaseEnabled}
            style={{ marginTop: 8 }}
          >
            Forgot password?
          </button>
        </div>
      )}
    </div>
  );
}
