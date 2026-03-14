import { useState } from 'react';
import {
  User, RefreshCw, Wallet, BarChart2, Shield,
  Star, Package, Activity, Search, Layers,
} from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { SkeletonCard } from './ui/Skeleton';
import PageHeader from './ui/PageHeader';
import {
  fetchPlayer, fetchProfileStats,
  fetchPlayerAuctions, fetchNetWorth,
  formatCoins,
} from '../utils/api';
import { useUserData } from '../hooks/useUserData';

// ── Constants ─────────────────────────────────────────────────────────────────

const SKILL_ICONS = {
  farming: '🌾', mining: '⛏️', combat: '⚔️', foraging: '🌲', fishing: '🎣',
  enchanting: '✨', alchemy: '⚗️', carpentry: '🪚', runecrafting: '🔮', social: '🤝',
};
const SLAYER_ICONS = {
  zombie: '🧟', spider: '🕷️', wolf: '🐺', enderman: '👾', blaze: '🔥', vampire: '🧛',
};
const RADAR_SKILLS = ['farming', 'mining', 'combat', 'foraging', 'fishing', 'enchanting', 'alchemy'];

const RANK_STYLES = {
  MVP_PLUS_PLUS: { bg: '#fbbf24', color: '#0a0e14', label: 'MVP++' },
  MVP_PLUS:      { bg: '#22d3ee', color: '#0a0e14', label: 'MVP+' },
  MVP:           { bg: '#22d3ee', color: '#0a0e14', label: 'MVP' },
  VIP_PLUS:      { bg: '#4ade80', color: '#0a0e14', label: 'VIP+' },
  VIP:           { bg: '#4ade80', color: '#0a0e14', label: 'VIP' },
  YOUTUBER:      { bg: '#f87171', color: '#fff',    label: 'YT' },
  ADMIN:         { bg: '#f87171', color: '#fff',    label: 'ADMIN' },
  MODERATOR:     { bg: '#4ade80', color: '#0a0e14', label: 'MOD' },
};

const NW_COLORS = {
  purse:       '#f5c518',
  bank:        '#ff9f43',
  pets:        '#bc8cff',
  inventory:   '#58a6ff',
  ender_chest: '#39d0d8',
  wardrobe:    '#3fb950',
  backpack:    '#fb923c',
  vault:       '#f472b6',
  talismans:   '#a855f7',
};
const NW_LABELS = {
  purse: 'Purse', bank: 'Bank', pets: 'Pets',
  inventory: 'Inventory', ender_chest: 'Ender Chest', wardrobe: 'Wardrobe',
  backpack: 'Backpack', vault: 'Vault', talismans: 'Talismans',
};

const MAIN_TABS = [
  { id: 'overview',   label: '📊 Overview' },
  { id: 'skills',     label: '⭐ Skills' },
  { id: 'combat',     label: '⚔️ Combat' },
  { id: 'inventory',  label: '🎒 Inventory' },
  { id: 'auctions',   label: '🔨 Auctions' },
];

const INV_TABS = [
  { id: 'main',      label: '🎒 Inventory',   field: 'inv_all' },
  { id: 'ec',        label: '📦 Ender Chest',  field: 'ec_all' },
  { id: 'wardrobe',  label: '👕 Wardrobe',     field: 'ward_all' },
  { id: 'backpack',  label: '🎽 Backpack',     field: 'backpack_all' },
  { id: 'vault',     label: '🔒 Vault',        field: 'vault_all' },
  { id: 'talismans', label: '💎 Talismans',    field: 'talisman_all' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTimeSince(ms) {
  if (!ms) return null;
  const diff = Date.now() - ms;
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (days > 0)  return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0)  return `${mins}m ago`;
  return 'Just now';
}

function formatTimeLeft(secs) {
  if (secs <= 0) return 'Ended';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtItemName(id, name) {
  if (name && name.trim()) return name.trim();
  return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function rarityFromValue(val) {
  if (val >= 100_000_000) return 'legendary';
  if (val >= 10_000_000)  return 'epic';
  if (val >= 1_000_000)   return 'rare';
  if (val >= 100_000)     return 'uncommon';
  return null;
}

function getRankTag(player) {
  if (!player) return null;
  const rank  = player.rank || player.newPackageRank;
  const style = RANK_STYLES[rank];
  if (!style) return null;
  return (
    <span style={{
      background: style.bg, color: style.color,
      padding: '2px 8px', borderRadius: 4,
      fontSize: 10, fontWeight: 900, letterSpacing: '0.5px', lineHeight: 1.6,
    }}>
      {style.label}
    </span>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Tile({ color, label, icon: Icon, value, sub }) {
  return (
    <div className={`stat-tile stat-tile--${color}`}>
      <div className="stat-tile__header">
        <span className="stat-tile__label">{label}</span>
        {Icon && <Icon size={15} className="stat-tile__icon" />}
      </div>
      <div className="stat-tile__value">{value ?? '—'}</div>
      {sub && <div className="stat-tile__sub">{sub}</div>}
    </div>
  );
}

function StatRow({ label, value, gold }) {
  return (
    <div className="stat-row">
      <span className="stat-row__label">{label}</span>
      <span className={gold ? 'stat-row__value--gold' : 'stat-row__value'}>{value}</span>
    </div>
  );
}

function ItemsTable({ items }) {
  if (!items || items.length === 0) {
    return (
      <div className="text-muted" style={{ fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
        Nothing found here.
      </div>
    );
  }
  return (
    <div className="table-wrap" style={{ border: 'none', maxHeight: 480, overflowY: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th style={{ width: 60, textAlign: 'center' }}>Qty</th>
            <th style={{ width: 130, textAlign: 'right' }}>Est. Value</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const rarity = rarityFromValue(item.value);
            return (
              <tr key={i}>
                <td style={{ fontWeight: 600, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {rarity && (
                    <span
                      className={`rarity-tag rarity-${rarity}`}
                      style={{ marginRight: 7, fontSize: 9, padding: '2px 5px' }}
                    >
                      ◆
                    </span>
                  )}
                  {fmtItemName(item.id, item.name)}
                </td>
                <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  {item.count > 1 ? `×${item.count}` : ''}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {item.value > 0 ? (
                    <span style={{ color: 'var(--gold)', fontWeight: 700 }}>
                      {formatCoins(item.value)}
                    </span>
                  ) : (
                    <span className="text-dim" style={{ fontSize: 11 }}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PlayerStats() {
  const [username, setUsername]           = useUserData('player_ign', '');
  const [data, setData]                   = useState(null);
  const [nwData, setNwData]               = useState(null);
  const [auctions, setAuctions]           = useState(null);
  const [loading, setLoading]             = useState(false);
  const [nwLoading, setNwLoading]         = useState(false);
  const [auctionsLoading, setAuctionsLoading] = useState(false);
  const [error, setError]                 = useState('');
  const [selectedProfile, setSelected]    = useState(null);
  const [profileStats, setProfileStats]   = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [activeTab, setActiveTab]         = useState('overview');
  const [invTab, setInvTab]               = useState('main');

  async function loadNetWorth(user, profileId) {
    setNwLoading(true);
    setNwData(null);
    try {
      setNwData(await fetchNetWorth(user, profileId));
    } catch { /* non-critical */ }
    finally { setNwLoading(false); }
  }

  async function loadAuctions(user, profileId) {
    setAuctionsLoading(true);
    try {
      setAuctions(await fetchPlayerAuctions(user, profileId));
    } catch { setAuctions(null); }
    finally { setAuctionsLoading(false); }
  }

  async function lookup() {
    if (!username.trim()) return;
    setLoading(true);
    setError(''); setData(null); setNwData(null);
    setAuctions(null); setProfileStats(null);
    setActiveTab('overview'); setInvTab('main');
    try {
      const result = await fetchPlayer(username.trim());
      setData(result);
      setProfileStats(result.active_profile?.stats ?? null);
      setSelected(result.active_profile?.profile_id ?? null);
      const pid = result.active_profile?.profile_id ?? null;
      loadNetWorth(username.trim(), pid);
      loadAuctions(username.trim(), null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function switchProfile(profileId) {
    if (profileId === selectedProfile) return;
    setSelected(profileId);
    setProfileLoading(true);
    setNwData(null); setAuctions(null);
    try {
      const result = await fetchProfileStats(username, profileId);
      if (result.error) {
        setError(result.error);
        setProfileStats(null);
      } else {
        setProfileStats(result.stats);
        setError('');
      }
      loadNetWorth(username, profileId);
      loadAuctions(username, profileId);
    } catch (e) { setError(e.message); }
    finally { setProfileLoading(false); }
  }

  const stats = profileStats;

  const radarData = stats
    ? RADAR_SKILLS.map(skill => ({
        skill: skill.charAt(0).toUpperCase() + skill.slice(1),
        level: stats.skills?.[skill]?.level ?? 0,
        fullMark: 60,
      }))
    : [];

  const nwPieData = nwData
    ? Object.entries(nwData.breakdown)
        .filter(([, v]) => v > 0)
        .map(([key, value]) => ({
          name:  NW_LABELS[key] || key,
          value,
          color: NW_COLORS[key] || '#888',
        }))
    : [];

  function getInvItems(tab) {
    if (!nwData) return [];
    return nwData[tab.field] ?? [];
  }

  const lastSaveMs = data?.active_profile?.last_save_ms ?? 0;
  const lastSeen   = formatTimeSince(lastSaveMs);

  return (
    <div className="page">
      <PageHeader
        icon={User}
        title="Player Profile"
        description="Skills, slayers, dungeons, net worth, inventory, and auctions — all in one place."
      />

      {/* ── Search bar ──────────────────────────────────────────────────── */}
      <div className="toolbar">
        <div className="field">
          <label>Minecraft Username</label>
          <input
            type="text"
            placeholder="e.g. Technoblade"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && lookup()}
            style={{ width: 220 }}
          />
        </div>
        <button className="btn-primary" onClick={lookup} disabled={loading || !username.trim()}>
          {loading
            ? <><RefreshCw size={14} className="spin" /> Loading…</>
            : <><Search size={14} /> Look Up</>}
        </button>
      </div>

      {error && <div className="error-box">{error}</div>}
      {loading && (
        <div className="stat-grid">
          {[4, 6, 4, 4].map((r, i) => <SkeletonCard key={i} rows={r} />)}
        </div>
      )}

      {data && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Player Hero ───────────────────────────────────────────────── */}
          <div className="card card--glow-gold" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <img
                src={`https://crafatar.com/avatars/${data.uuid}?size=80&overlay=true`}
                alt={data.username}
                style={{
                  width: 80, height: 80, borderRadius: 10, flexShrink: 0,
                  border: '2px solid rgba(251,191,36,0.4)',
                  imageRendering: 'pixelated',
                  boxShadow: '0 0 20px rgba(251,191,36,0.2)',
                }}
                onError={e => { e.target.style.display = 'none'; }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 24, fontWeight: 900, lineHeight: 1 }}>
                    {data.username}
                  </span>
                  {getRankTag(data.player)}
                  {data.active_profile?.cute_name && (
                    <span className="tag tag-blue" style={{ fontSize: 10 }}>
                      {data.active_profile.cute_name}
                    </span>
                  )}
                </div>
                {lastSeen && (
                  <div className="text-muted" style={{ fontSize: 12, marginBottom: 10 }}>
                    Last active: {lastSeen}
                  </div>
                )}
                {data.profiles?.length > 1 && (
                  <div className="btn-group" style={{ flexWrap: 'wrap' }}>
                    {data.profiles.map(p => (
                      <button
                        key={p.profile_id}
                        className={selectedProfile === p.profile_id ? 'btn-primary btn-xs' : 'btn-secondary btn-xs'}
                        onClick={() => switchProfile(p.profile_id)}
                        disabled={profileLoading}
                      >
                        {p.cute_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Stat Tiles ────────────────────────────────────────────────── */}
          <div
            className="dash-tiles"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 12 }}
          >
            <Tile
              color="gold" icon={Wallet} label="Net Worth"
              value={nwData ? formatCoins(nwData.total) : nwLoading ? '…' : '—'}
              sub={nwData ? `~estimated` : undefined}
            />
            <Tile
              color="blue" icon={BarChart2} label="Skill Average"
              value={stats?.skill_average ?? (profileLoading ? '…' : '—')}
            />
            <Tile
              color="purple" icon={Shield} label="Catacombs"
              value={stats?.catacombs?.level != null ? `Lvl ${stats.catacombs.level}` : '—'}
            />
            <Tile
              color="cyan" icon={Star} label="Fairy Souls"
              value={stats?.fairy_souls ?? '—'}
            />
            <Tile
              color="orange" icon={Activity} label="Deaths"
              value={stats?.deaths?.toLocaleString() ?? '—'}
            />
            <Tile
              color="green" icon={Package} label="Minions"
              value={nwData?.minion_count ?? (nwLoading ? '…' : '—')}
              sub="crafted types"
            />
          </div>

          {profileLoading && (
            <div className="stat-grid">
              {[4, 6, 4, 4].map((r, i) => <SkeletonCard key={i} rows={r} />)}
            </div>
          )}

          {!profileLoading && (
            <>
              {/* ── Main Tabs ──────────────────────────────────────────────── */}
              <div className="tab-pills">
                {MAIN_TABS.map(tab => (
                  <button
                    key={tab.id}
                    className={`tab-pill${activeTab === tab.id ? ' tab-pill--active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                    {tab.id === 'auctions' && auctions && auctions.count > 0 && (
                      <span style={{
                        marginLeft: 5, background: 'var(--gold-dim)',
                        color: 'var(--gold)', borderRadius: 10,
                        padding: '1px 6px', fontSize: 10, fontWeight: 700,
                      }}>
                        {auctions.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* ════════════════════════════════════════════════════════════
                  OVERVIEW TAB
              ════════════════════════════════════════════════════════════ */}
              {activeTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {stats && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      {/* Skill radar */}
                      <div className="card">
                        <div className="card__title">⭐ Skill Radar</div>
                        <ResponsiveContainer width="100%" height={240}>
                          <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                            <PolarGrid stroke="var(--border)" />
                            <PolarAngleAxis
                              dataKey="skill"
                              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                            />
                            <Tooltip
                              formatter={v => [v, 'Level']}
                              contentStyle={{
                                background: 'var(--bg-3)',
                                border: '1px solid var(--border)',
                                borderRadius: 6,
                              }}
                            />
                            <Radar
                              name="Level" dataKey="level"
                              stroke="var(--gold)" fill="var(--gold)"
                              fillOpacity={0.15} strokeWidth={2}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Quick stats */}
                      <div className="card">
                        <div className="card__title">📋 Overview</div>
                        <StatRow label="Skill Average"    value={stats.skill_average}                    gold />
                        <StatRow label="Catacombs Level"  value={`Lvl ${stats.catacombs?.level ?? 0}`}  gold />
                        <StatRow label="Fairy Souls"      value={`${stats.fairy_souls} collected`} />
                        <StatRow label="Purse"            value={`${formatCoins(stats.purse)} coins`} />
                        <StatRow label="Deaths"           value={(stats.deaths ?? 0).toLocaleString()} />
                        {stats.collections?.length > 0 && (
                          <>
                            <div style={{ borderTop: '1px solid var(--border)', margin: '10px 0' }} />
                            <div className="card__title" style={{ marginBottom: 8 }}>
                              🏆 Top Collections
                            </div>
                            {stats.collections.slice(0, 6).map(c => (
                              <StatRow key={c.id} label={c.name} value={c.count.toLocaleString()} />
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Net Worth section */}
                  {(nwData || nwLoading) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div className="card">
                        <div className="card__title">
                          💰 Net Worth Breakdown
                          {nwData && (
                            <span style={{
                              marginLeft: 'auto', color: 'var(--gold)',
                              fontWeight: 800, fontSize: 15,
                              textTransform: 'none', letterSpacing: 0,
                            }}>
                              {formatCoins(nwData.total)}
                            </span>
                          )}
                        </div>
                        {nwLoading && !nwData
                          ? <div className="spinner" style={{ margin: '24px auto' }} />
                          : nwData
                            ? Object.entries(nwData.breakdown)
                                .filter(([, v]) => v > 0)
                                .map(([key, value]) => (
                                  <div key={key} style={{
                                    display: 'flex', justifyContent: 'space-between',
                                    alignItems: 'center', padding: '7px 0',
                                    borderBottom: '1px solid rgba(30,45,71,0.6)',
                                  }}>
                                    <span style={{
                                      display: 'flex', alignItems: 'center', gap: 8,
                                      color: 'var(--text-muted)', fontSize: 13,
                                    }}>
                                      <span style={{
                                        width: 8, height: 8, borderRadius: '50%',
                                        background: NW_COLORS[key] || '#888', flexShrink: 0,
                                      }} />
                                      {NW_LABELS[key] || key}
                                    </span>
                                    <span style={{ fontWeight: 700, color: NW_COLORS[key] || 'var(--text)' }}>
                                      {formatCoins(value)}
                                    </span>
                                  </div>
                                ))
                            : null}
                      </div>

                      {nwData && nwPieData.length > 0 && (
                        <div className="card">
                          <div className="card__title">📊 Wealth Distribution</div>
                          <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                              <Pie
                                data={nwPieData} cx="50%" cy="50%"
                                outerRadius={78} dataKey="value" stroke="none"
                              >
                                {nwPieData.map((entry, i) => (
                                  <Cell key={i} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(v, name) => [formatCoins(v), name]}
                                contentStyle={{
                                  background: 'var(--bg-3)',
                                  border: '1px solid var(--border)',
                                  borderRadius: 6,
                                }}
                              />
                              <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-muted)' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ════════════════════════════════════════════════════════════
                  SKILLS TAB
              ════════════════════════════════════════════════════════════ */}
              {activeTab === 'skills' && (
                <>
                  {!stats && (
                    <div className="info-box">Stats unavailable — try another profile.</div>
                  )}
                  {stats && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12 }}>
                      {Object.entries(stats.skills ?? {}).map(([skill, s]) => (
                        <div key={skill} className="card" style={{ padding: '16px 18px' }}>
                          <div style={{
                            display: 'flex', justifyContent: 'space-between',
                            alignItems: 'center', marginBottom: 10,
                          }}>
                            <span style={{ fontWeight: 700, fontSize: 14 }}>
                              {SKILL_ICONS[skill] ?? '•'}{' '}
                              {skill.charAt(0).toUpperCase() + skill.slice(1)}
                            </span>
                            <span className="tag tag-gold" style={{ fontSize: 11 }}>
                              Lvl {s.level}
                            </span>
                          </div>
                          <div className="progress-bar progress-bar--thick" style={{ marginBottom: 6 }}>
                            <div className="progress-fill" style={{ width: `${s.progress}%` }} />
                          </div>
                          <div style={{
                            display: 'flex', justifyContent: 'space-between',
                            fontSize: 11, color: 'var(--text-muted)',
                          }}>
                            <span>{(s.xp ?? 0).toLocaleString()} XP</span>
                            <span>{s.progress}% to next</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* ════════════════════════════════════════════════════════════
                  COMBAT TAB
              ════════════════════════════════════════════════════════════ */}
              {activeTab === 'combat' && (
                <>
                  {!stats && (
                    <div className="info-box">Stats unavailable — try another profile.</div>
                  )}
                  {stats && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                      {/* Catacombs */}
                      <div className="card">
                        <div className="card__title">🏰 Catacombs</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 16 }}>
                          <span style={{
                            fontSize: 40, fontWeight: 900, color: 'var(--purple)',
                            lineHeight: 1, textShadow: '0 0 20px rgba(192,132,252,0.4)',
                          }}>
                            {stats.catacombs?.level ?? 0}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              display: 'flex', justifyContent: 'space-between',
                              fontSize: 12, color: 'var(--text-muted)', marginBottom: 5,
                            }}>
                              <span>Catacombs Level</span>
                              <span>{stats.catacombs?.progress ?? 0}% to next</span>
                            </div>
                            <div className="progress-bar progress-bar--thick progress-bar--blue">
                              <div className="progress-fill" style={{ width: `${stats.catacombs?.progress ?? 0}%` }} />
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                              {(stats.catacombs?.xp ?? 0).toLocaleString()} XP
                            </div>
                          </div>
                        </div>

                        {/* Classes */}
                        {stats.catacombs?.classes && (
                          <>
                            <div style={{
                              fontSize: 10, fontWeight: 800, color: 'var(--text-muted)',
                              textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10,
                            }}>
                              Dungeon Classes
                            </div>
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                              gap: 8,
                            }}>
                              {Object.entries(stats.catacombs.classes).map(([cls, c]) => (
                                <div key={cls} style={{
                                  background: 'var(--bg-3)', borderRadius: 8,
                                  padding: '10px 12px', border: '1px solid var(--border)',
                                }}>
                                  <div style={{
                                    display: 'flex', justifyContent: 'space-between',
                                    marginBottom: 6,
                                  }}>
                                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                                      {cls.charAt(0).toUpperCase() + cls.slice(1)}
                                    </span>
                                    <span style={{ color: 'var(--purple)', fontWeight: 700 }}>
                                      {c.level}
                                    </span>
                                  </div>
                                  <div className="progress-bar progress-bar--blue">
                                    <div className="progress-fill" style={{ width: `${c.progress}%` }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Slayers */}
                      <div className="card">
                        <div className="card__title">👹 Slayers</div>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                          gap: 10,
                        }}>
                          {Object.entries(stats.slayers ?? {}).map(([name, s]) => (
                            <div key={name} style={{
                              background: 'var(--bg-3)', border: '1px solid var(--border)',
                              borderRadius: 10, padding: '12px 14px',
                              display: 'flex', alignItems: 'center', gap: 14,
                            }}>
                              <span style={{ fontSize: 26 }}>{SLAYER_ICONS[name] ?? '👹'}</span>
                              <div style={{ flex: 1 }}>
                                <div style={{
                                  display: 'flex', justifyContent: 'space-between',
                                  alignItems: 'center', marginBottom: 2,
                                }}>
                                  <span style={{ fontWeight: 700, fontSize: 13 }}>
                                    {name.charAt(0).toUpperCase() + name.slice(1)}
                                  </span>
                                  <span className="tag tag-purple" style={{ fontSize: 10 }}>
                                    Lvl {s.level}
                                  </span>
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                  {(s.xp ?? 0).toLocaleString()} XP
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ════════════════════════════════════════════════════════════
                  INVENTORY TAB
              ════════════════════════════════════════════════════════════ */}
              {activeTab === 'inventory' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {nwLoading && !nwData && (
                    <div className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
                      <div className="spinner" style={{ margin: '0 auto 12px' }} />
                      <div className="text-muted" style={{ fontSize: 13 }}>Loading inventory data…</div>
                    </div>
                  )}
                  {!nwData && !nwLoading && (
                    <div className="info-box">
                      Inventory data unavailable. Net worth endpoint may need an API key.
                    </div>
                  )}

                  {nwData && (
                    <>
                      {/* Inventory sub-tabs */}
                      <div className="tab-pills">
                        {INV_TABS.map(t => {
                          const items = getInvItems(t);
                          const total = items.reduce((s, it) => s + (it.value || 0), 0);
                          return (
                            <button
                              key={t.id}
                              className={`tab-pill${invTab === t.id ? ' tab-pill--active' : ''}`}
                              onClick={() => setInvTab(t.id)}
                            >
                              {t.label}
                              {items.length > 0 && (
                                <span style={{
                                  marginLeft: 5, background: 'var(--bg-4)',
                                  borderRadius: 10, padding: '1px 6px',
                                  fontSize: 10, color: 'var(--text-muted)',
                                }}>
                                  {items.length}
                                </span>
                              )}
                              {total > 0 && invTab === t.id && (
                                <span style={{
                                  marginLeft: 4, color: 'var(--gold)',
                                  fontWeight: 700, fontSize: 10,
                                }}>
                                  · {formatCoins(total)}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Item table */}
                      {INV_TABS.map(t => invTab === t.id && (
                        <div key={t.id} className="card">
                          <div className="card__title">
                            {t.label}
                            {(() => {
                              const items = getInvItems(t);
                              const total = items.reduce((s, it) => s + (it.value || 0), 0);
                              return total > 0 ? (
                                <span style={{
                                  marginLeft: 'auto', color: 'var(--gold)',
                                  fontWeight: 700, fontSize: 14,
                                  textTransform: 'none', letterSpacing: 0,
                                }}>
                                  ~{formatCoins(total)}
                                </span>
                              ) : null;
                            })()}
                          </div>
                          <ItemsTable items={getInvItems(t)} />
                        </div>
                      ))}

                      {/* Pets */}
                      {nwData.pets?.length > 0 && (
                        <div className="card">
                          <div className="card__title">
                            🐾 Pets
                            <span style={{
                              marginLeft: 'auto', color: 'var(--purple)',
                              fontWeight: 700, fontSize: 14,
                              textTransform: 'none', letterSpacing: 0,
                            }}>
                              ~{formatCoins(nwData.breakdown?.pets ?? 0)}
                            </span>
                          </div>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                            gap: 8,
                          }}>
                            {nwData.pets.slice(0, 24).map((pet, i) => (
                              <div key={i} style={{
                                background: 'var(--bg-3)', border: '1px solid var(--border)',
                                borderRadius: 8, padding: '10px 12px',
                              }}>
                                <div style={{
                                  display: 'flex', justifyContent: 'space-between',
                                  alignItems: 'flex-start', marginBottom: 5,
                                }}>
                                  <span style={{ fontWeight: 700, fontSize: 12, lineHeight: 1.3 }}>
                                    {pet.type?.replace(/_/g, ' ')}
                                  </span>
                                  {pet.active && (
                                    <span className="tag tag-gold" style={{ fontSize: 9 }}>Active</span>
                                  )}
                                </div>
                                <span
                                  className={`tag rarity-tag rarity-${(pet.tier ?? 'common').toLowerCase()}`}
                                  style={{ fontSize: 10 }}
                                >
                                  {pet.tier}
                                </span>
                                <div style={{
                                  color: 'var(--gold)', fontWeight: 700,
                                  fontSize: 12, marginTop: 6,
                                }}>
                                  ~{formatCoins(pet.value)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ════════════════════════════════════════════════════════════
                  AUCTIONS TAB
              ════════════════════════════════════════════════════════════ */}
              {activeTab === 'auctions' && (
                <div className="card">
                  <div className="card__title">
                    🔨 Active Auctions
                    {auctions && (
                      <span style={{
                        marginLeft: 'auto', fontWeight: 400, fontSize: 12,
                        textTransform: 'none', letterSpacing: 0,
                        color: 'var(--text-muted)',
                      }}>
                        {auctions.count} listing{auctions.count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {auctionsLoading && (
                    <div className="spinner" style={{ margin: '32px auto' }} />
                  )}

                  {auctions && !auctionsLoading && auctions.auctions?.length === 0 && (
                    <div className="text-muted" style={{ padding: '20px 0', fontSize: 13, textAlign: 'center' }}>
                      No active auctions.
                    </div>
                  )}

                  {auctions && !auctionsLoading && auctions.auctions?.length > 0 && (
                    <div className="table-wrap" style={{ border: 'none' }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th>Type</th>
                            <th>Tier</th>
                            <th style={{ textAlign: 'right' }}>Top Bid</th>
                            <th style={{ textAlign: 'center' }}>Bids</th>
                            <th style={{ textAlign: 'right' }}>Time Left</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auctions.auctions.map(a => (
                            <tr key={a.uuid} style={{ opacity: a.claimed ? 0.45 : 1 }}>
                              <td style={{
                                fontWeight: 600, maxWidth: 220,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {a.item_name}
                              </td>
                              <td>
                                {a.bin
                                  ? <span className="tag tag-blue"   style={{ fontSize: 10 }}>BIN</span>
                                  : <span className="tag tag-orange" style={{ fontSize: 10 }}>AUC</span>}
                              </td>
                              <td>
                                <span
                                  className={`tag rarity-tag rarity-${(a.tier || 'common').toLowerCase()}`}
                                  style={{ fontSize: 10 }}
                                >
                                  {a.tier}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right', color: 'var(--gold)', fontWeight: 700 }}>
                                {formatCoins(a.highest_bid || a.starting_bid)}
                              </td>
                              <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                                {a.bids}
                              </td>
                              <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: 12 }}>
                                {a.claimed ? '✅ Claimed' : formatTimeLeft(a.time_left_s)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
