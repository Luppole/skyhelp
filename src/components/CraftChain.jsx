import { useState, useMemo, useCallback } from 'react';
import { GitBranch, RefreshCw, ChevronRight } from 'lucide-react';
import { useFetch } from '../hooks/useFetch';
import PageHeader from './ui/PageHeader';
import DataAge from './ui/DataAge';
import { RECIPES, resolveRecipeCost } from '../data/recipes';
import { fetchBazaarFlips, formatCoins } from '../utils/api';

// ── Sell speed ──────────────────────────────────────────────────────────────
function sellSpeed(weeklyVol) {
  const daily = (weeklyVol ?? 0) / 7;
  if (daily >= 100_000) return { label: 'Instant',   icon: '⚡', color: '#34d399' };
  if (daily >= 10_000)  return { label: 'Very Fast', icon: '🚀', color: '#86efac' };
  if (daily >= 1_000)   return { label: 'Fast',      icon: '↑',  color: '#fbbf24' };
  if (daily >= 100)     return { label: 'Medium',    icon: '~',  color: '#fb923c' };
  if (daily > 0)        return { label: 'Slow',      icon: '⏳', color: '#f87171' };
  return                       { label: 'Unknown',   icon: '?',  color: '#64748b' };
}

function SpeedTag({ weekly }) {
  const s = sellSpeed(weekly);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 20,
      fontSize: 11, fontWeight: 700,
      background: `${s.color}18`,
      color: s.color,
      border: `1px solid ${s.color}40`,
    }}>
      {s.icon} {s.label}
    </span>
  );
}

function AhSpeedTag({ listings }) {
  if (!listings) return <span className="text-muted" style={{ fontSize: 11 }}>—</span>;
  if (listings < 5)  return <span className="tag tag-gold" style={{ fontSize: 10 }}>Rare Market</span>;
  if (listings < 20) return <span className="tag tag-blue" style={{ fontSize: 10 }}>Med Market</span>;
  return <span className="tag tag-green" style={{ fontSize: 10 }}>Deep Market</span>;
}

// ── SL helper ───────────────────────────────────────────────────────────────
function SL({ label, value, color, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 2 }}>
      <span className="text-muted">{label}</span>
      <span style={{ color: color || 'var(--text)', fontWeight: bold ? 700 : 400 }}>{value}</span>
    </div>
  );
}

// ── BZ→AH Tab ───────────────────────────────────────────────────────────────
function BzToAhTab() {
  const [minProfit, setMinProfit] = useState(50_000);
  const [minMargin, setMinMargin] = useState(5);
  const [search, setSearch]       = useState('');

  const fetcher = useCallback(
    () => fetch(`/api/auctions/bz-to-ah?min_profit=${minProfit}&min_margin=${minMargin}&limit=80`).then(r => r.json()),
    [minProfit, minMargin]
  );
  const { data, loading, error, reload, lastFetchedAt } = useFetch(fetcher, [minProfit, minMargin]);

  const flips = useMemo(() => {
    const all = data?.flips ?? [];
    if (!search) return all;
    return all.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
  }, [data, search]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Info banner */}
      <div className="info-box" style={{ marginBottom: 0 }}>
        <strong>How it works:</strong> These items are priced cheaper on the Bazaar than on the Auction House.
        Buy instantly from BZ, list as BIN on AH. Profit = AH lowest price × 0.99 − BZ instant buy.
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Min Profit</label>
          <select value={minProfit} onChange={e => setMinProfit(+e.target.value)} style={{ width: 130 }}>
            <option value={0}>Any</option>
            <option value={50_000}>50K+</option>
            <option value={100_000}>100K+</option>
            <option value={500_000}>500K+</option>
            <option value={1_000_000}>1M+</option>
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Min Margin %</label>
          <select value={minMargin} onChange={e => setMinMargin(+e.target.value)} style={{ width: 100 }}>
            <option value={0}>0%</option>
            <option value={5}>5%</option>
            <option value={10}>10%</option>
            <option value={20}>20%</option>
            <option value={50}>50%</option>
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Search</label>
          <input type="text" placeholder="Item name…" value={search}
            onChange={e => setSearch(e.target.value)} style={{ width: 180 }} />
        </div>
        <DataAge lastFetchedAt={lastFetchedAt} />
        <button className="btn-icon btn-sm" onClick={reload} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {error && <div className="error-box">{String(error?.message ?? error)}</div>}
      {loading && <div className="spinner" />}
      {!loading && data && !data.ready && (
        <div className="info-box">AH index is warming up — retry in a moment.</div>
      )}

      {!loading && flips.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item</th>
                  <th>BZ Buy (instant)</th>
                  <th>AH Min BIN</th>
                  <th>Profit / item</th>
                  <th>Margin</th>
                  <th>AH Listings</th>
                  <th>BZ Volume</th>
                </tr>
              </thead>
              <tbody>
                {flips.map((f, i) => (
                  <tr key={f.item_id}>
                    <td className="text-muted" style={{ fontSize: 12 }}>{i + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="text-bold" style={{ fontSize: 13 }}>{f.name}</span>
                        {i === 0 && <span className="tag tag-gold" style={{ fontSize: 9 }}>BEST</span>}
                      </div>
                    </td>
                    <td>
                      <span style={{ color: 'var(--blue)', fontWeight: 700, fontSize: 13 }}>
                        {formatCoins(f.bz_buy)}
                      </span>
                    </td>
                    <td>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{formatCoins(f.ah_min)}</span>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                          median: {formatCoins(f.ah_median)}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{
                        fontSize: 14, fontWeight: 800,
                        color: f.profit >= 1_000_000 ? 'var(--gold)' : 'var(--green)',
                      }}>
                        +{formatCoins(f.profit)}
                      </span>
                    </td>
                    <td>
                      <span className={`tag ${f.margin_pct >= 50 ? 'tag-gold' : f.margin_pct >= 20 ? 'tag-green' : 'tag-blue'}`} style={{ fontSize: 10 }}>
                        {f.margin_pct}%
                      </span>
                    </td>
                    <td><AhSpeedTag listings={f.ah_listings} /></td>
                    <td><SpeedTag weekly={f.bz_weekly_vol} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !error && flips.length === 0 && data?.ready && (
        <div className="empty-state">
          <span className="empty-state-icon">📦</span>
          <span>No BZ→AH opportunities found at current filters.</span>
        </div>
      )}
    </div>
  );
}

// ── Craft → Sell BZ Tab ─────────────────────────────────────────────────────
function CraftBzTab() {
  const [targetId, setTargetId] = useState(RECIPES[0].id);
  const [quantity, setQuantity] = useState(1);
  const [search, setSearch]     = useState('');

  const fetcher = useCallback(
    (options = {}) => fetchBazaarFlips(0, 0, 500, options),
    []
  );
  const { data, loading, reload } = useFetch(fetcher, []);

  const prices = useMemo(() => {
    const map = {};
    for (const f of data?.flips ?? []) {
      map[f.item_id] = f.sell_price;
    }
    return map;
  }, [data]);

  // Weekly volume map for sell speed
  const volumes = useMemo(() => {
    const map = {};
    for (const f of data?.flips ?? []) {
      map[f.item_id] = f.weekly_volume;
    }
    return map;
  }, [data]);

  const recipe = RECIPES.find(r => r.id === targetId);
  const analysis = useMemo(() => {
    if (!recipe || !Object.keys(prices).length) return null;
    return resolveRecipeCost(targetId, quantity, prices);
  }, [targetId, quantity, prices, recipe]);

  const sellPrice   = prices[targetId] ? prices[targetId] * quantity : null;
  const profit      = sellPrice && analysis ? sellPrice * 0.9875 - analysis.craftCost : null;
  const itemWeekly  = volumes[targetId] ?? 0;

  const filteredRecipes = search
    ? RECIPES.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
    : RECIPES;

  return (
    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {/* Config panel */}
      <div className="card" style={{ minWidth: 280, flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="card__title" style={{ margin: 0 }}>Target Item</div>
          <button className="btn-icon btn-sm" onClick={reload} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
          </button>
        </div>
        <div className="field">
          <label>Search Recipe</label>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="e.g. Enchanted Diamond…" />
        </div>
        <div className="field">
          <label>Item</label>
          <select value={targetId} onChange={e => setTargetId(e.target.value)} style={{ width: '100%' }}>
            {filteredRecipes.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Quantity</label>
          <input type="number" value={quantity} min={1}
            onChange={e => setQuantity(Math.max(1, +e.target.value))} />
        </div>

        {analysis && recipe && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <SL label="Craft cost"       value={formatCoins(analysis.craftCost)} color="var(--blue)" bold />
            {sellPrice && <SL label="BZ sell price"  value={formatCoins(sellPrice)} />}
            {/* Sell speed */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <span className="text-muted" style={{ fontSize: 13 }}>Sell speed</span>
              <SpeedTag weekly={itemWeekly} />
            </div>
            {sellPrice && (
              <div style={{
                marginTop: 10,
                background: analysis.shouldCraft ? 'rgba(52,211,153,0.08)' : 'rgba(96,165,250,0.08)',
                border: `1px solid ${analysis.shouldCraft ? 'rgba(52,211,153,0.25)' : 'rgba(96,165,250,0.25)'}`,
                borderRadius: 8, padding: '8px 12px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>RECOMMENDATION</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: analysis.shouldCraft ? 'var(--green)' : 'var(--blue)' }}>
                  {analysis.shouldCraft ? '🔨 CRAFT IT' : '🛒 BUY IT'}
                </div>
                <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>
                  Save {formatCoins(Math.abs(analysis.craftCost - sellPrice))}
                </div>
              </div>
            )}
            {profit !== null && (
              <>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 10 }} />
                <SL label="After tax (×0.9875)" value={formatCoins(sellPrice * 0.9875)} />
                <SL label="Craft profit"
                  value={`${profit > 0 ? '+' : ''}${formatCoins(profit)}`}
                  color={profit > 0 ? 'var(--green)' : 'var(--red)'} bold />
              </>
            )}
          </div>
        )}
      </div>

      {/* Recipe tree */}
      <div style={{ flex: 1, minWidth: 300 }}>
        {!analysis && (
          <div className="empty-state">
            <span className="empty-state-icon">🔗</span>
            <span>{loading ? 'Loading bazaar prices…' : 'Select an item to analyze'}</span>
          </div>
        )}
        {analysis && (
          <div className="card">
            <div className="card__title">
              <GitBranch size={13} /> Craft Chain — {recipe?.name} ×{quantity}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {analysis.steps.map((step, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px',
                  background: step.source === 'craft' ? 'rgba(52,211,153,0.05)' : 'rgba(96,165,250,0.05)',
                  border: `1px solid ${step.source === 'craft' ? 'rgba(52,211,153,0.15)' : 'rgba(96,165,250,0.15)'}`,
                  borderRadius: 8,
                  marginLeft: i > 0 ? Math.min(i * 20, 60) : 0,
                }}>
                  {i > 0 && <ChevronRight size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="text-bold" style={{ fontSize: 13 }}>
                        {step.itemId.replace(/_/g, ' ')}
                        {step.quantity > 1 && <span className="text-muted"> ×{step.quantity}</span>}
                      </span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <SpeedTag weekly={volumes[step.itemId]} />
                        <span className={`tag ${step.source === 'craft' ? 'tag-green' : 'tag-blue'}`}>
                          {step.source === 'craft' ? '🔨 Craft' : '🛒 Buy'}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: 12 }}>
                      {step.craftCost !== undefined && (
                        <span className="text-muted">Craft: <span style={{ color: 'var(--green)' }}>{formatCoins(step.craftCost)}</span></span>
                      )}
                      {step.buyPrice > 0 && (
                        <span className="text-muted">Buy: <span style={{ color: 'var(--blue)' }}>{formatCoins(step.buyPrice)}</span></span>
                      )}
                      {step.cost > 0 && step.craftCost === undefined && (
                        <span className="text-muted">Cost: <span style={{ color: 'var(--text)' }}>{formatCoins(step.cost)}</span></span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Total Craft Cost</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--gold)' }}>
                {formatCoins(analysis.craftCost)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function CraftChain() {
  const [tab, setTab] = useState('bz-bz');

  return (
    <div className="page">
      <PageHeader
        icon={GitBranch}
        title="Craft Flips"
        description="Find profit by crafting or arbitraging between Bazaar and Auction House."
      />

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: '1px solid var(--border)',
        marginBottom: 20,
      }}>
        {[
          { id: 'bz-bz', label: '🔨 Craft → Sell BZ', desc: 'craft from BZ, sell on BZ' },
          { id: 'bz-ah', label: '⚡ Buy BZ → Sell AH', desc: 'buy BZ cheap, flip on AH' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '12px 20px',
              fontWeight: 700, fontSize: 13,
              background: 'none', border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--gold)' : '2px solid transparent',
              color: tab === t.id ? 'var(--gold)' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.15s',
              marginBottom: -1,
              borderRadius: 0,
            }}
          >
            {t.label}
            <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-dim)', marginTop: 2 }}>{t.desc}</div>
          </button>
        ))}
      </div>

      {tab === 'bz-bz' && <CraftBzTab />}
      {tab === 'bz-ah' && <BzToAhTab />}
    </div>
  );
}
