import { useState, useCallback } from 'react';
import { Sprout, RefreshCw, Search, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import { fetchFarmingUpgrades, formatCoins } from '../utils/api';
import { useFetch } from '../hooks/useFetch';
import DataAge from './ui/DataAge';

// ── Crop list (matches backend) ──────────────────────────────────────────────
const CROPS = [
  { name: 'Wheat',       key: 'turbo_wheat'     },
  { name: 'Carrot',      key: 'turbo_carrot'    },
  { name: 'Potato',      key: 'turbo_potato'    },
  { name: 'Pumpkin',     key: 'turbo_pumpkin'   },
  { name: 'Melon',       key: 'turbo_melon'     },
  { name: 'Mushroom',    key: 'turbo_mushrooms' },
  { name: 'Cocoa Beans', key: 'turbo_cocoa'     },
  { name: 'Sugar Cane',  key: 'turbo_cane'      },
  { name: 'Nether Wart', key: 'turbo_warts'     },
  { name: 'Cactus',      key: 'turbo_cacti'     },
];

const GLOBAL_ENCHANTS = [
  { label: 'Dedication',   key: 'dedication',   max: 4 },
  { label: 'Harvesting',   key: 'harvesting',   max: 6 },
  { label: 'Green Thumb',  key: 'green_thumb',  max: 5 },
  { label: 'Sugar Rush',   key: 'sugar_rush',   max: 3 },
];

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];

// ── Tier badge ────────────────────────────────────────────────────────────────
function TierBadge({ tier }) {
  const color = tier >= 20 ? 'var(--gold)' : tier >= 10 ? '#34d399' : tier >= 5 ? '#60a5fa' : 'var(--text-muted)';
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color }}>Tier {tier}</span>
  );
}

// ── FF/M score badge ──────────────────────────────────────────────────────────
function ScoreBadge({ ffpm }) {
  const bg =
    ffpm >= 10 ? 'rgba(251,191,36,0.15)' :
    ffpm >= 5  ? 'rgba(52,211,153,0.12)' :
    ffpm >= 2  ? 'rgba(96,165,250,0.12)' :
                 'rgba(100,116,139,0.1)';
  const color =
    ffpm >= 10 ? 'var(--gold)' :
    ffpm >= 5  ? '#34d399'     :
    ffpm >= 2  ? '#60a5fa'     :
                 'var(--text-muted)';
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: bg, color, whiteSpace: 'nowrap' }}>
      {ffpm.toFixed(1)} FF/M
    </span>
  );
}

// ── Enchant level selector (0 = not owned) ───────────────────────────────────
function EnchantSelector({ label, encKey, max, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 110 }}>
      <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</label>
      <select
        value={value}
        onChange={e => onChange(encKey, Number(e.target.value))}
        style={{ fontSize: 12 }}
      >
        <option value={0}>None</option>
        {Array.from({ length: max }, (_, i) => i + 1).map(lvl => (
          <option key={lvl} value={lvl}>{ROMAN[lvl]}</option>
        ))}
      </select>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FarmingUpgrades() {
  const [ign,       setIgn]       = useState('');
  const [query,     setQuery]     = useState('');
  const [profileId, setProfileId] = useState('');
  const [tab,       setTab]       = useState('fortune'); // fortune | bps
  const [cropFilter,setCropFilter]= useState('All Crops');
  const [showSetup, setShowSetup] = useState(true);

  // Enchant overrides (user fills in current levels)
  const [overrides, setOverrides] = useState({});
  function setOverride(key, val) {
    setOverrides(prev => ({ ...prev, [key]: val }));
  }

  // Fetch
  const fetcher = useCallback(
    (opts = {}) => query ? fetchFarmingUpgrades(query, profileId || null, overrides, opts) : Promise.resolve(null),
    [query, profileId, overrides],
  );
  const { data, loading, error, reload, lastFetchedAt } = useFetch(
    fetcher, [query, profileId, overrides], { immediate: !!query }
  );

  function handleSearch(e) {
    e.preventDefault();
    const trimmed = ign.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setProfileId('');
  }

  // Once data loads, auto-set profileId to active profile
  const activeProfile = data?.active_profile;
  const profiles      = data?.profiles ?? [];
  const upgrades      = data?.upgrades ?? [];
  const player        = data?.player;
  const garden        = data?.garden;

  // Filter visible upgrades
  const visible = upgrades.filter(u => {
    if (tab === 'fortune' && u.category !== 'fortune') return false;
    if (tab === 'bps'     && u.category !== 'bps')     return false;
    if (cropFilter !== 'All Crops' && u.crop && u.crop !== cropFilter) return false;
    if (cropFilter !== 'All Crops' && !u.crop) return false; // hide global when crop filtered
    return true;
  });

  const fortuneCount = upgrades.filter(u => u.category === 'fortune').length;
  const bpsCount     = upgrades.filter(u => u.category === 'bps').length;
  const totalFF      = data?.total_ff_gain ?? 0;
  const totalCost    = data?.total_cost ?? 0;

  const allCrops = ['All Crops', ...CROPS.map(c => c.name)];

  return (
    <div className="page">
      <PageHeader
        icon={Sprout}
        title="Farming Optimizer"
        description="Every available Fortune & BPS enchant upgrade ranked by FF per million coins. Works where EliteBot doesn't."
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <DataAge lastFetchedAt={lastFetchedAt} />
            {data && (
              <button className="btn-icon" onClick={reload} disabled={loading} title="Refresh">
                <RefreshCw size={14} className={loading ? 'spin' : ''} />
              </button>
            )}
          </div>
        }
      />

      {/* Search bar */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Enter IGN…"
          value={ign}
          onChange={e => setIgn(e.target.value)}
          style={{ flex: 1, maxWidth: 300 }}
        />
        <button type="submit" className="btn-primary" disabled={loading || !ign.trim()}>
          <Search size={14} /> {loading ? 'Loading…' : 'Look Up'}
        </button>
      </form>

      {error && <div className="error-box" style={{ marginBottom: 16 }}>{String(error)}</div>}

      {data && (
        <>
          {/* Profile selector if multiple profiles */}
          {profiles.length > 1 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
              <span className="text-muted" style={{ fontSize: 12 }}>Profile:</span>
              {profiles.map(p => (
                <button
                  key={p.profile_id}
                  className={profileId === p.profile_id || (!profileId && p.profile_id === activeProfile?.profile_id)
                    ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                  onClick={() => setProfileId(p.profile_id)}
                >
                  {p.cute_name}
                </button>
              ))}
            </div>
          )}

          {/* Player summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 10, marginBottom: 18 }}>
            {[
              { label: 'Farming Level', value: player?.farming_level ?? '—', sub: `${player?.skill_ff ?? 0} FF from skill` },
              { label: 'Skill FF',      value: player?.skill_ff ?? '—',      sub: `${formatCoins(player?.farming_xp ?? 0)} XP` },
              { label: 'Garden Level',  value: garden?.garden_level ?? '—',  sub: `avg milestone tier ${garden?.avg_milestone ?? 0}` },
              { label: 'FF Gain Available', value: `+${totalFF}`,            sub: `across ${fortuneCount} upgrades`, gold: true },
              { label: 'Total Cost',    value: formatCoins(totalCost),        sub: `to max all upgrades` },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: '10px 14px', textAlign: 'center' }}>
                <div className="text-muted" style={{ fontSize: 11, marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontWeight: 800, fontSize: 18, color: s.gold ? 'var(--gold)' : 'var(--text)' }}>{s.value}</div>
                {s.sub && <div className="text-muted" style={{ fontSize: 10, marginTop: 2 }}>{s.sub}</div>}
              </div>
            ))}
          </div>

          {/* "My Setup" enchant overrides */}
          <div className="card" style={{ marginBottom: 18 }}>
            <button
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: '100%', justifyContent: 'space-between' }}
              onClick={() => setShowSetup(s => !s)}
            >
              <div className="card__title" style={{ margin: 0 }}>My Current Enchants <span className="text-muted" style={{ fontSize: 11, fontWeight: 400 }}>(set to show only upgrades from your current level)</span></div>
              {showSetup ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showSetup && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Turbo enchants (per crop):
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
                  {CROPS.map(c => (
                    <EnchantSelector
                      key={c.key}
                      label={c.name}
                      encKey={c.key}
                      max={5}
                      value={overrides[c.key] ?? 0}
                      onChange={setOverride}
                    />
                  ))}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Global enchants:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {GLOBAL_ENCHANTS.map(e => (
                    <EnchantSelector
                      key={e.key}
                      label={e.label}
                      encKey={e.key}
                      max={e.max}
                      value={overrides[e.key] ?? 0}
                      onChange={setOverride}
                    />
                  ))}
                </div>
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <button className="btn-primary btn-sm" onClick={reload} disabled={loading}>
                    <RefreshCw size={12} /> Recalculate
                  </button>
                  <button className="btn-secondary btn-sm" onClick={() => { setOverrides({}); }}>
                    Reset All
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tab bar + crop filter */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {[
              { id: 'fortune', label: `🌾 Fortune Upgrades (${fortuneCount})` },
              { id: 'bps',     label: `⚡ BPS Upgrades (${bpsCount})` },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: '10px 18px', fontWeight: 700, fontSize: 13,
                background: 'none', border: 'none',
                borderBottom: tab === t.id ? '2px solid var(--gold)' : '2px solid transparent',
                color: tab === t.id ? 'var(--gold)' : 'var(--text-muted)',
                cursor: 'pointer', marginBottom: -1,
              }}>
                {t.label}
              </button>
            ))}
            {tab === 'fortune' && (
              <div style={{ marginLeft: 'auto', marginBottom: 4 }}>
                <select value={cropFilter} onChange={e => setCropFilter(e.target.value)} style={{ fontSize: 12, height: 28 }}>
                  {allCrops.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Upgrade table */}
          {visible.length === 0 ? (
            <div className="empty-state" style={{ marginTop: 40 }}>
              <span className="empty-state-icon">🌾</span>
              <span>No upgrades available</span>
              <span className="text-muted" style={{ fontSize: 12 }}>
                {tab === 'fortune' ? 'You may already be maxed on all tracked enchants for this crop.' : 'All tracked BPS enchants are maxed.'}
              </span>
            </div>
          ) : (
            <div className="card" style={{ padding: 0 }}>
              <div className="table-wrap" style={{ border: 'none' }}>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Enchant</th>
                      <th>Crop</th>
                      <th>Level</th>
                      {tab === 'fortune' && <th>FF Gain</th>}
                      {tab === 'bps'     && <th>BPS Gain</th>}
                      <th>Cost</th>
                      {tab === 'fortune' && <th>FF / Million</th>}
                      <th>Note</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((u, i) => (
                      <tr key={u.id} style={{ opacity: u.cost_coins > 0 ? 1 : 0.5 }}>
                        <td className="text-muted" style={{ fontSize: 11 }}>{i + 1}</td>
                        <td>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{u.name}</span>
                        </td>
                        <td>
                          {u.crop
                            ? <span className="tag tag-green" style={{ fontSize: 10 }}>{u.crop}</span>
                            : <span className="text-muted" style={{ fontSize: 11 }}>Global</span>}
                        </td>
                        <td>
                          <span className="text-muted" style={{ fontSize: 11 }}>
                            {ROMAN[u.from_level] || '—'} → <strong style={{ color: 'var(--text)' }}>{ROMAN[u.to_level]}</strong>
                          </span>
                        </td>
                        {tab === 'fortune' && (
                          <td>
                            <span style={{ color: 'var(--green)', fontWeight: 700 }}>+{u.ff_gain} FF</span>
                          </td>
                        )}
                        {tab === 'bps' && (
                          <td>
                            <span style={{ color: '#60a5fa', fontWeight: 700 }}>+{u.bps_gain} BPS</span>
                          </td>
                        )}
                        <td>
                          <span className="text-gold" style={{ fontWeight: 700 }}>
                            {u.cost_coins > 0 ? formatCoins(u.cost_coins) : <span className="text-muted">No BZ price</span>}
                          </span>
                        </td>
                        {tab === 'fortune' && (
                          <td>
                            {u.ff_per_million > 0
                              ? <ScoreBadge ffpm={u.ff_per_million} />
                              : <span className="text-muted" style={{ fontSize: 11 }}>—</span>}
                          </td>
                        )}
                        <td className="text-muted" style={{ fontSize: 11, maxWidth: 240, whiteSpace: 'normal' }}>
                          {u.note}
                        </td>
                        <td>
                          <a
                            href={`https://sky.coflnet.com/auction?itemTag=${u.bz_item_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-icon btn-sm"
                            title="View on sky.coflnet"
                          >
                            <ExternalLink size={11} />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary footer */}
              {tab === 'fortune' && visible.length > 0 && (
                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  <span className="text-muted" style={{ fontSize: 12 }}>
                    {visible.length} upgrades shown
                  </span>
                  <span style={{ fontSize: 12 }}>
                    Total FF gain: <strong style={{ color: 'var(--green)' }}>
                      +{visible.reduce((s, u) => s + u.ff_gain, 0).toFixed(1)}
                    </strong>
                  </span>
                  <span style={{ fontSize: 12 }}>
                    Total cost: <strong className="text-gold">
                      {formatCoins(visible.reduce((s, u) => s + u.cost_coins, 0))}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Crop milestone sidebar for fortune tab */}
          {tab === 'fortune' && garden?.crop_milestones && (
            <div style={{ marginTop: 18 }}>
              <div className="section-title" style={{ marginTop: 0 }}>Crop Milestones (affects Dedication FF)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: 8 }}>
                {Object.entries(garden.crop_milestones).map(([crop, info]) => (
                  <div key={crop} className="card" style={{ padding: '8px 12px' }}>
                    <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 2 }}>{crop}</div>
                    <TierBadge tier={info.tier} />
                    {info.next_threshold_needed && (
                      <div className="text-muted" style={{ fontSize: 10, marginTop: 2 }}>
                        {formatCoins(info.next_threshold_needed)} to next tier
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!data && !loading && !error && (
        <div className="empty-state" style={{ marginTop: 60 }}>
          <span className="empty-state-icon"><Sprout size={40} strokeWidth={1.5} /></span>
          <span>Enter an IGN to get started</span>
          <span className="text-muted" style={{ fontSize: 12 }}>
            Every Fortune & BPS upgrade ranked by efficiency — no EliteBot required
          </span>
        </div>
      )}
    </div>
  );
}
