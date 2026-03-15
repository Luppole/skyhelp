import { useState } from 'react';
import { Wallet, RefreshCw, User, Save, History, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import PageHeader from './ui/PageHeader';
import { fetchPlayer, fetchNetWorth, formatCoins } from '../utils/api';
import AnimatedNumber from './ui/AnimatedNumber';
import { useUserData } from '../hooks/useUserData';
import ItemModal from './ItemModal';
import { SkeletonCard } from './ui/Skeleton';
import { usePlayerTracking } from '../hooks/usePlayerTracking';
import { useSupabaseUser } from '../hooks/useSupabaseUser';

const COLORS = {
  purse:       '#f5c518',
  bank:        '#ff9f43',
  pets:        '#bc8cff',
  inventory:   '#58a6ff',
  ender_chest: '#39d0d8',
  wardrobe:    '#3fb950',
  backpack:    '#fb923c',
  vault:       '#f472b6',
  talismans:   '#a855f7',
  fishing_bag: '#38bdf8',
  equipment:   '#f43f5e',
};

const LABELS = {
  purse: 'Purse', bank: 'Bank', pets: 'Pets',
  inventory: 'Inventory', ender_chest: 'Ender Chest', wardrobe: 'Wardrobe',
  backpack: 'Backpack', vault: 'Vault', talismans: 'Talismans',
  fishing_bag: 'Fishing Bag', equipment: 'Equipment',
};

const INV_TABS = [
  { id: 'inv',       label: '🎒 Inventory',   field: 'inv_all',       mode: 'flat' },
  { id: 'ec',        label: '📦 Ender Chest',  field: 'ec_pages',      mode: 'pages' },
  { id: 'wardrobe',  label: '👕 Wardrobe',     field: 'wardrobe_sets', mode: 'sets' },
  { id: 'backpack',  label: '🎽 Backpack',     field: 'backpack_slots',mode: 'slots' },
  { id: 'vault',     label: '🔒 Vault',        field: 'vault_all',     mode: 'flat' },
  { id: 'talismans', label: '💎 Talismans',    field: 'talisman_all',  mode: 'flat' },
  { id: 'fishing',   label: '🎣 Fishing Bag',  field: 'fishing_all',   mode: 'flat' },
  { id: 'equipment', label: '🛡️ Equipment',    field: 'equipment_all', mode: 'flat' },
];

const SLOT_LABELS = { 0: 'Helmet', 1: 'Chestplate', 2: 'Leggings', 3: 'Boots' };

function fmtItemName(id, name) {
  if (name && name.trim()) return name.trim();
  return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function rarityColor(val) {
  if (val >= 100_000_000) return '#f5c518';
  if (val >= 10_000_000)  return '#bc8cff';
  if (val >= 1_000_000)   return '#58a6ff';
  if (val >= 100_000)     return '#3fb950';
  return null;
}

function ItemRow({ item, onSelect }) {
  const color = rarityColor(item.value);
  return (
    <tr onClick={() => onSelect(item)} style={{ cursor: 'pointer' }} className="clickable-row">
      <td style={{ fontWeight: 600, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {color && <span style={{ marginRight: 6, color, fontSize: 10 }}>◆</span>}
        {fmtItemName(item.id, item.name)}
        {item.dungeon_item_level > 0 && (
          <span style={{ marginLeft: 5, color: '#f5c518', fontSize: 10 }}>{'✦'.repeat(Math.min(item.dungeon_item_level, 5))}</span>
        )}
        {item.rarity_upgrades > 0 && <span style={{ marginLeft: 4, color: '#bc8cff', fontSize: 9 }}>✦RC</span>}
        {item.hot_potato_count > 0 && <span style={{ marginLeft: 4, color: '#ff9f43', fontSize: 9 }}>{item.hot_potato_count}🥔</span>}
      </td>
      <td style={{ textAlign: 'center', color: 'var(--text-muted)', width: 52 }}>
        {item.count > 1 ? `×${item.count}` : ''}
      </td>
      <td style={{ textAlign: 'right', width: 130 }}>
        {item.value > 0
          ? <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{formatCoins(item.value)}</span>
          : <span className="text-dim" style={{ fontSize: 11 }}>—</span>}
      </td>
    </tr>
  );
}

function ItemsTable({ items, onSelect }) {
  if (!items || items.length === 0) {
    return <div className="text-muted" style={{ fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Nothing found here.</div>;
  }
  return (
    <div className="table-wrap" style={{ border: 'none', maxHeight: 420, overflowY: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th style={{ width: 52, textAlign: 'center' }}>Qty</th>
            <th style={{ width: 130, textAlign: 'right' }}>Est. Value</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => <ItemRow key={i} item={item} onSelect={onSelect} />)}
        </tbody>
      </table>
    </div>
  );
}

function EcPagesView({ pages, onSelect }) {
  const [activePage, setActivePage] = useState(0);
  if (!pages || pages.length === 0) return <div className="text-muted" style={{ fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Ender Chest is empty.</div>;
  const cur = pages[Math.min(activePage, pages.length - 1)];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {pages.map((p, i) => (
          <button key={i} onClick={() => setActivePage(i)} className={`tab-pill${activePage === i ? ' tab-pill--active' : ''}`} style={{ fontSize: 12 }}>
            Page {p.page}
            {p.total > 0 && <span style={{ marginLeft: 5, color: activePage === i ? 'var(--gold)' : 'var(--text-muted)', fontWeight: 700, fontSize: 10 }}>· {formatCoins(p.total)}</span>}
          </button>
        ))}
      </div>
      <ItemsTable items={cur.items} onSelect={onSelect} />
    </div>
  );
}

function WardrobeSetsView({ sets, onSelect }) {
  const [activeSet, setActiveSet] = useState(0);
  if (!sets || sets.length === 0) return <div className="text-muted" style={{ fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Wardrobe is empty.</div>;
  const cur = sets[Math.min(activeSet, sets.length - 1)];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {sets.map((s, i) => (
          <button key={i} onClick={() => setActiveSet(i)} className={`tab-pill${activeSet === i ? ' tab-pill--active' : ''}`} style={{ fontSize: 12 }}>
            Set {s.set}
            {s.total > 0 && <span style={{ marginLeft: 5, color: activeSet === i ? 'var(--gold)' : 'var(--text-muted)', fontWeight: 700, fontSize: 10 }}>· {formatCoins(s.total)}</span>}
          </button>
        ))}
      </div>
      <div className="table-wrap" style={{ border: 'none' }}>
        <table>
          <thead><tr><th>Slot</th><th>Item</th><th style={{ width: 130, textAlign: 'right' }}>Est. Value</th></tr></thead>
          <tbody>
            {cur.items.map((item, i) => (
              <tr key={i} onClick={() => onSelect(item)} style={{ cursor: 'pointer' }} className="clickable-row">
                <td style={{ color: 'var(--text-muted)', width: 90, fontSize: 12 }}>{SLOT_LABELS[i] || `Slot ${i + 1}`}</td>
                <td style={{ fontWeight: 600 }}>
                  {rarityColor(item.value) && <span style={{ marginRight: 6, color: rarityColor(item.value), fontSize: 10 }}>◆</span>}
                  {fmtItemName(item.id, item.name)}
                </td>
                <td style={{ textAlign: 'right', width: 130 }}>
                  {item.value > 0 ? <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{formatCoins(item.value)}</span>
                    : <span className="text-dim" style={{ fontSize: 11 }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BackpackSlotsView({ slots, onSelect }) {
  const [activeSlot, setActiveSlot] = useState(0);
  if (!slots || slots.length === 0) return <div className="text-muted" style={{ fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No backpacks found.</div>;
  const cur = slots[Math.min(activeSlot, slots.length - 1)];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {slots.map((s, i) => (
          <button key={i} onClick={() => setActiveSlot(i)} className={`tab-pill${activeSlot === i ? ' tab-pill--active' : ''}`} style={{ fontSize: 12 }}>
            Backpack {s.slot + 1}
            <span style={{ marginLeft: 5, background: 'var(--bg-4)', borderRadius: 10, padding: '1px 5px', fontSize: 10, color: 'var(--text-muted)' }}>{s.items.length}</span>
            {s.total > 0 && <span style={{ marginLeft: 4, color: activeSlot === i ? 'var(--gold)' : 'var(--text-muted)', fontWeight: 700, fontSize: 10 }}>· {formatCoins(s.total)}</span>}
          </button>
        ))}
      </div>
      <ItemsTable items={cur.items} onSelect={onSelect} />
    </div>
  );
}

function TabContent({ tab, data, onSelect }) {
  if (tab.mode === 'pages') return <EcPagesView     pages={data[tab.field] ?? []} onSelect={onSelect} />;
  if (tab.mode === 'sets')  return <WardrobeSetsView sets={data[tab.field]  ?? []} onSelect={onSelect} />;
  if (tab.mode === 'slots') return <BackpackSlotsView slots={data[tab.field] ?? []} onSelect={onSelect} />;
  return <ItemsTable items={data[tab.field] ?? []} onSelect={onSelect} />;
}

function tabTotal(tab, data) {
  if (tab.mode === 'flat') return (data[tab.field] ?? []).reduce((s, it) => s + (it.value || 0), 0);
  return (data[tab.field] ?? []).reduce((s, container) => s + (container.total || 0), 0);
}
function tabCount(tab, data) {
  if (tab.mode === 'flat') return (data[tab.field] ?? []).length;
  return (data[tab.field] ?? []).reduce((s, c) => s + (c.items?.length || 0), 0);
}

// ── History tooltip ────────────────────────────────────────────────────────────
function HistTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border-bright)', borderRadius: 8, padding: '8px 14px', fontSize: 12 }}>
      <div className="text-muted" style={{ marginBottom: 2 }}>{d.date}</div>
      <div style={{ color: 'var(--gold)', fontWeight: 800, fontSize: 15 }}>{formatCoins(d.value)}</div>
    </div>
  );
}

export default function NetWorth() {
  const { user }                = useSupabaseUser();
  const [username, setUsername] = useUserData('player_ign', '');
  const [profileId, setProfileId]   = useState('');
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [profiles, setProfiles]     = useState([]);
  const [invTab, setInvTab]         = useState('inv');
  const [selectedItem, setSelectedItem] = useState(null);

  // Snapshot / tracking state
  const { saveSnapshot, loadSnapshots, deleteSnapshot } = usePlayerTracking(user?.id);
  const [snapshots, setSnapshots]         = useState([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [showHistory, setShowHistory]     = useState(false);
  const [saveMsg, setSaveMsg]             = useState('');   // '' | 'saving' | 'saved' | 'error'

  async function fetchProfiles(ign) {
    try {
      const d = await fetchPlayer(ign);
      setProfiles(d.profiles || []);
      return d.active_profile?.profile_id ?? d.profiles?.[0]?.profile_id ?? '';
    } catch (e) {
      setError(`Could not find player "${ign}": ${e.message}`);
      return '';
    }
  }

  async function lookup() {
    if (!username.trim()) return;
    setLoading(true); setError(''); setData(null); setInvTab('inv');
    setShowHistory(false); setSnapshots([]);
    try {
      let pid = profileId;
      if (!pid) pid = await fetchProfiles(username.trim());
      const result = await fetchNetWorth(username.trim(), pid || null);
      setData(result);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleSaveSnapshot() {
    if (!data || !user) return;
    setSaveMsg('saving');
    const ok = await saveSnapshot(data.username, data.profile, data);
    setSaveMsg(ok ? 'saved' : 'error');
    setTimeout(() => setSaveMsg(''), 3000);
  }

  async function handleLoadHistory() {
    if (!username.trim()) return;
    setSnapshotsLoading(true);
    setShowHistory(true);
    const snaps = await loadSnapshots(username.trim());
    setSnapshots(snaps);
    setSnapshotsLoading(false);
  }

  async function handleDeleteSnapshot(id) {
    await deleteSnapshot(id);
    setSnapshots(prev => prev.filter(s => s.id !== id));
  }

  // Chart data — array of { date, value } from snapshots (oldest first)
  const historyChartData = snapshots
    .slice()
    .reverse()
    .map(s => ({
      date:  new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: s.net_worth ?? s.snapshot?.total ?? 0,
    }));

  const ALWAYS_SHOW = new Set(['purse', 'bank']);
  const breakdownEntries = data
    ? Object.entries(data.breakdown).filter(([k, v]) => ALWAYS_SHOW.has(k) || v > 0)
    : [];
  const pieData = breakdownEntries.filter(([, v]) => v > 0).map(([key, value]) => ({
    name: LABELS[key] || key, value, color: COLORS[key] || '#888',
  }));

  return (
    <div className="page">
      {selectedItem && <ItemModal item={selectedItem} onClose={() => setSelectedItem(null)} />}
      <PageHeader
        icon={Wallet}
        title="Net Worth Estimator"
        description="Estimates total wealth across purse, bank, pets, and every inventory location. Save snapshots to track progress over time."
      />

      {/* Search toolbar */}
      <div className="toolbar">
        <div className="field">
          <label>Minecraft Username</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && lookup()}
            placeholder="e.g. Technoblade"
            style={{ width: 200 }}
          />
        </div>
        {profiles.length > 0 && (
          <div className="field">
            <label>Profile</label>
            <select value={profileId} onChange={e => setProfileId(e.target.value)} style={{ width: 160 }}>
              <option value="">Auto (most recent)</option>
              {profiles.map(p => <option key={p.profile_id} value={p.profile_id}>{p.cute_name}</option>)}
            </select>
          </div>
        )}
        <button className="btn-primary" onClick={lookup} disabled={loading || !username}>
          {loading ? <><RefreshCw size={14} className="spin" /> Analyzing…</> : <><Wallet size={14} /> Estimate Net Worth</>}
        </button>
      </div>

      {error && (
        <div className="error-box" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{error}</span>
          <button className="btn-secondary btn-sm" onClick={lookup} style={{ flexShrink: 0 }}>
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {[1,2,3,4,5,6].map(i => <SkeletonCard key={i} rows={3} />)}
        </div>
      )}

      {data && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* ── Total card ──────────────────────────────────────────────── */}
          <div className="card card--glow-gold" style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', marginBottom: 4 }}>
              <User size={18} style={{ color: 'var(--gold)' }} />
              <span style={{ fontSize: 18, fontWeight: 700 }}>{data.username}</span>
              {data.profile && <span className="tag tag-blue">{data.profile}</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              Estimated Net Worth
            </div>
            <div className="nw-total">
              <AnimatedNumber value={data.total} formatter={formatCoins} />
            </div>
            <div className="text-muted" style={{ fontSize: 12, marginTop: 6, marginBottom: 16 }}>
              Based on live AH/bazaar prices. Actual net worth may differ.
            </div>

            {/* Track / Save actions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                className={`btn-secondary btn-sm${saveMsg === 'saved' ? ' btn-success' : ''}`}
                onClick={handleSaveSnapshot}
                disabled={saveMsg === 'saving' || !user}
                title={!user ? 'Sign in to save snapshots' : "Save a snapshot of this player's data"}
              >
                {saveMsg === 'saving' ? <><RefreshCw size={12} className="spin" /> Saving…</>
                  : saveMsg === 'saved' ? <>✓ Saved</>
                  : saveMsg === 'error' ? <>✗ Error</>
                  : <><Save size={12} /> Save Snapshot</>}
              </button>
              <button
                className="btn-secondary btn-sm"
                onClick={handleLoadHistory}
                disabled={!user}
                title={!user ? 'Sign in to view history' : 'View saved snapshots for this player'}
              >
                <History size={12} /> {showHistory ? 'Refresh' : 'View'} History
              </button>
            </div>
            {!user && (
              <div className="text-muted" style={{ fontSize: 11, marginTop: 6 }}>
                Sign in to save snapshots and track progress over time.
              </div>
            )}
          </div>

          {/* ── History panel ───────────────────────────────────────────── */}
          {showHistory && (
            <div className="card">
              <div className="card__title">
                <History size={13} /> Snapshot History — {data.username}
                <span className="text-muted" style={{ marginLeft: 8, fontSize: 11, fontWeight: 400 }}>
                  {snapshots.length} saved
                </span>
              </div>

              {snapshotsLoading ? (
                <div className="spinner" />
              ) : snapshots.length === 0 ? (
                <div className="text-muted" style={{ fontSize: 13, padding: '16px 0' }}>
                  No snapshots yet. Hit <strong>Save Snapshot</strong> above to start tracking this player.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* History area chart */}
                  {historyChartData.length >= 2 && (
                    <div style={{ height: 180 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={historyChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="var(--gold)" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="var(--gold)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} />
                          <YAxis tickFormatter={v => formatCoins(v)} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} width={68} />
                          <Tooltip content={<HistTooltip />} />
                          <Area type="monotone" dataKey="value" stroke="var(--gold)" strokeWidth={2.5} fill="url(#nwGrad)"
                            dot={{ fill: 'var(--gold)', r: 3, strokeWidth: 0 }}
                            activeDot={{ r: 5, fill: 'var(--gold)', strokeWidth: 0 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Snapshot rows */}
                  <div className="table-wrap" style={{ border: 'none' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Profile</th>
                          <th style={{ textAlign: 'right' }}>Net Worth</th>
                          <th style={{ textAlign: 'right' }}>Purse</th>
                          <th style={{ textAlign: 'right' }}>Bank</th>
                          <th style={{ textAlign: 'right' }}>Pets</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {snapshots.map((s, i) => {
                          const bd = s.snapshot?.breakdown ?? s.breakdown ?? {};
                          return (
                            <tr key={s.id ?? i}>
                              <td className="text-muted" style={{ fontSize: 12 }}>
                                {new Date(s.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                              </td>
                              <td className="text-muted" style={{ fontSize: 12 }}>{s.profile_name || '—'}</td>
                              <td style={{ textAlign: 'right', color: 'var(--gold)', fontWeight: 700 }}>{formatCoins(s.net_worth)}</td>
                              <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: 12 }}>{formatCoins(bd.purse ?? 0)}</td>
                              <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: 12 }}>{formatCoins(bd.bank ?? 0)}</td>
                              <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: 12 }}>{formatCoins(bd.pets ?? 0)}</td>
                              <td>
                                {s.id && (
                                  <button
                                    className="btn-icon btn-sm btn-danger"
                                    onClick={() => handleDeleteSnapshot(s.id)}
                                    title="Delete snapshot"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Breakdown tiles + Pie chart ─────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <div className="nw-breakdown">
              {breakdownEntries.map(([key, value]) => (
                <div key={key} className="nw-item" style={{ borderLeft: `3px solid ${COLORS[key] || '#888'}` }}>
                  <div className="nw-item__label">{LABELS[key] || key}</div>
                  <div className="nw-item__value" style={{ color: COLORS[key] || 'var(--gold)' }}>
                    {formatCoins(value)}
                  </div>
                  <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
                    {data.total > 0 ? Math.round((value / data.total) * 100) : 0}% of total
                  </div>
                </div>
              ))}
            </div>

            {pieData.length > 0 && (
              <div className="card">
                <div className="card__title">Wealth Distribution</div>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={85} dataKey="value" stroke="none">
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip
                      formatter={(v, name) => [formatCoins(v), name]}
                      contentStyle={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-muted)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ── Inventory browser ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="tab-pills">
              {INV_TABS.map(t => {
                const count = tabCount(t, data);
                const total = tabTotal(t, data);
                return (
                  <button
                    key={t.id}
                    className={`tab-pill${invTab === t.id ? ' tab-pill--active' : ''}`}
                    onClick={() => setInvTab(t.id)}
                  >
                    {t.label}
                    {count > 0 && (
                      <span style={{ marginLeft: 5, background: 'var(--bg-4)', borderRadius: 10, padding: '1px 6px', fontSize: 10, color: 'var(--text-muted)' }}>
                        {count}
                      </span>
                    )}
                    {total > 0 && invTab === t.id && (
                      <span style={{ marginLeft: 4, color: 'var(--gold)', fontWeight: 700, fontSize: 10 }}>
                        · {formatCoins(total)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {INV_TABS.map(t => invTab === t.id && (
              <div key={t.id} className="card">
                <div className="card__title">
                  {t.label}
                  {(() => {
                    const total = tabTotal(t, data);
                    return total > 0 ? (
                      <span style={{ marginLeft: 'auto', color: 'var(--gold)', fontWeight: 700, fontSize: 14, textTransform: 'none', letterSpacing: 0 }}>
                        ~{formatCoins(total)}
                      </span>
                    ) : null;
                  })()}
                </div>
                <TabContent tab={t} data={data} onSelect={setSelectedItem} />
              </div>
            ))}
          </div>

          {/* ── Pets ─────────────────────────────────────────────────────── */}
          {data.pets?.length > 0 && (
            <div className="card">
              <div className="card__title">
                🐾 Pets by Value
                <span style={{ marginLeft: 'auto', color: 'var(--purple)', fontWeight: 700, fontSize: 14, textTransform: 'none', letterSpacing: 0 }}>
                  ~{formatCoins(data.breakdown?.pets ?? 0)}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))', gap: 8 }}>
                {data.pets.slice(0, 20).map((pet, i) => (
                  <div key={i} style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <span className="text-bold" style={{ fontSize: 13 }}>
                        {pet.type?.replace(/_/g, ' ')}
                        {pet.level ? <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 11, marginLeft: 5 }}>Lv.{pet.level}</span> : null}
                      </span>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {pet.active && <span className="tag tag-gold" style={{ fontSize: 9 }}>Active</span>}
                        {pet.skin   && <span className="tag" style={{ fontSize: 9, background: 'rgba(57,208,216,0.15)', color: '#39d0d8' }}>Skin</span>}
                        {pet.candy > 0 && <span className="tag" style={{ fontSize: 9, background: 'rgba(255,165,0,0.15)', color: '#ff9f43' }}>{pet.candy}🍬</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className={`tag rarity-tag rarity-${pet.tier?.toLowerCase() ?? 'common'}`} style={{ fontSize: 10 }}>{pet.tier}</span>
                      {pet.held_item && <span style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>+ {pet.held_item.replace(/_/g, ' ')}</span>}
                    </div>
                    <div style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 13, marginTop: 6 }}>
                      ~{formatCoins(pet.value)}
                      {pet.value === 0 && <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 11 }}> (no data)</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
