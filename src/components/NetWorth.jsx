import { useState } from 'react';
import { Wallet, RefreshCw, User } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import PageHeader from './ui/PageHeader';
import { fetchPlayer, fetchNetWorth, formatCoins } from '../utils/api';
import AnimatedNumber from './ui/AnimatedNumber';
import { useUserData } from '../hooks/useUserData';

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
  { id: 'inv',       label: '🎒 Inventory',   field: 'inv_all' },
  { id: 'ec',        label: '📦 Ender Chest',  field: 'ec_all' },
  { id: 'wardrobe',  label: '👕 Wardrobe',     field: 'ward_all' },
  { id: 'backpack',  label: '🎽 Backpack',     field: 'backpack_all' },
  { id: 'vault',     label: '🔒 Vault',        field: 'vault_all' },
  { id: 'talismans', label: '💎 Talismans',    field: 'talisman_all' },
  { id: 'fishing',   label: '🎣 Fishing Bag',  field: 'fishing_all' },
  { id: 'equipment', label: '🛡️ Equipment',    field: 'equipment_all' },
];

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

function ItemsTable({ items }) {
  if (!items || items.length === 0) {
    return (
      <div className="text-muted" style={{ fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
        Nothing found here.
      </div>
    );
  }
  return (
    <div className="table-wrap" style={{ border: 'none', maxHeight: 460, overflowY: 'auto' }}>
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
                <td style={{ fontWeight: 600, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {rarity && (
                    <span className={`rarity-tag rarity-${rarity}`} style={{ marginRight: 7, fontSize: 9, padding: '2px 5px' }}>
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
                    <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{formatCoins(item.value)}</span>
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

export default function NetWorth() {
  const [username, setUsername]   = useUserData('player_ign', '');
  const [profileId, setProfileId] = useState('');
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [profiles, setProfiles]   = useState([]);
  const [invTab, setInvTab]       = useState('inv');

  async function fetchProfiles(user) {
    try {
      const d = await fetchPlayer(user);
      setProfiles(d.profiles || []);
      // Return the most-recently-active profile id (first in list from backend)
      return d.active_profile?.profile_id ?? d.profiles?.[0]?.profile_id ?? '';
    } catch {
      return '';
    }
  }

  async function lookup() {
    if (!username.trim()) return;
    setLoading(true); setError(''); setData(null); setInvTab('inv');
    try {
      let pid = profileId;
      if (!pid) {
        pid = await fetchProfiles(username.trim());
      }
      const result = await fetchNetWorth(username.trim(), pid || null);
      setData(result);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  const breakdownEntries = data ? Object.entries(data.breakdown).filter(([, v]) => v > 0) : [];
  const pieData = breakdownEntries.map(([key, value]) => ({
    name:  LABELS[key] || key,
    value,
    color: COLORS[key] || '#888',
  }));

  return (
    <div className="page">
      <PageHeader
        icon={Wallet}
        title="Net Worth Estimator"
        description="Estimates total wealth across purse, bank, pets, and all inventory locations."
      />

      {/* Search */}
      <div className="toolbar">
        <div className="field">
          <label>Minecraft Username</label>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && lookup()}
            placeholder="e.g. Technoblade" style={{ width: 200 }} />
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

      {error && <div className="error-box">{error}</div>}

      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height: 90 }} />)}
        </div>
      )}

      {data && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Total */}
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
            <div className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
              Based on known item values. Actual net worth may differ.
            </div>
          </div>

          {/* Breakdown tiles + chart */}
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
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
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

          {/* Inventory browser */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="tab-pills">
              {INV_TABS.map(t => {
                const items = data[t.field] ?? [];
                const total = items.reduce((s, it) => s + (it.value || 0), 0);
                return (
                  <button
                    key={t.id}
                    className={`tab-pill${invTab === t.id ? ' tab-pill--active' : ''}`}
                    onClick={() => setInvTab(t.id)}
                  >
                    {t.label}
                    {items.length > 0 && (
                      <span style={{ marginLeft: 5, background: 'var(--bg-4)', borderRadius: 10, padding: '1px 6px', fontSize: 10, color: 'var(--text-muted)' }}>
                        {items.length}
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
                    const items = data[t.field] ?? [];
                    const total = items.reduce((s, it) => s + (it.value || 0), 0);
                    return total > 0 ? (
                      <span style={{ marginLeft: 'auto', color: 'var(--gold)', fontWeight: 700, fontSize: 14, textTransform: 'none', letterSpacing: 0 }}>
                        ~{formatCoins(total)}
                      </span>
                    ) : null;
                  })()}
                </div>
                <ItemsTable items={data[t.field] ?? []} />
              </div>
            ))}
          </div>

          {/* Pets */}
          {data.pets?.length > 0 && (
            <div className="card">
              <div className="card__title">
                🐾 Top Pets by Value
                <span style={{ marginLeft: 'auto', color: 'var(--purple)', fontWeight: 700, fontSize: 14, textTransform: 'none', letterSpacing: 0 }}>
                  ~{formatCoins(data.breakdown?.pets ?? 0)}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                {data.pets.slice(0, 12).map((pet, i) => (
                  <div key={i} style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span className="text-bold" style={{ fontSize: 13 }}>{pet.type?.replace(/_/g, ' ')}</span>
                      {pet.active && <span className="tag tag-gold" style={{ fontSize: 9 }}>Active</span>}
                    </div>
                    <span className={`tag rarity-tag rarity-${pet.tier?.toLowerCase() ?? 'common'}`} style={{ fontSize: 10 }}>
                      {pet.tier}
                    </span>
                    <div style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 13, marginTop: 6 }}>
                      ~{formatCoins(pet.value)}
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
