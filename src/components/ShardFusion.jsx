import { useState, useCallback } from 'react';
import { Sparkles, RefreshCw, Lock } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import DataAge from './ui/DataAge';
import { useFetch } from '../hooks/useFetch';
import { formatCoins } from '../utils/api';
import TooltipUI from './ui/Tooltip';

const STAR_LEVELS = ['', '✦', '✦✦', '✦✦✦', '✦✦✦✦', '✦✦✦✦✦', '✦✦✦✦✦✦', '✦✦✦✦✦✦✦', '✦✦✦✦✦✦✦✦', '✦✦✦✦✦✦✦✦✦', '✦✦✦✦✦✦✦✦✦✦'];

function RoiTag({ roi }) {
  if (roi >= 200) return <span className="tag tag-gold" style={{ fontSize: 10 }}>{roi}% ROI 🔥</span>;
  if (roi >= 100) return <span className="tag tag-green" style={{ fontSize: 10 }}>{roi}% ROI</span>;
  if (roi >= 50)  return <span className="tag tag-blue" style={{ fontSize: 10 }}>{roi}% ROI</span>;
  return <span className="tag" style={{ fontSize: 10, background: 'rgba(107,133,176,0.1)', color: 'var(--text-muted)', border: '1px solid var(--border-bright)' }}>{roi}% ROI</span>;
}

export default function ShardFusion() {
  const [minProfit, setMinProfit] = useState(200_000);
  const [search, setSearch] = useState('');

  const fetcher = useCallback(
    () => fetch(`/api/auctions/shards?min_profit=${minProfit}&limit=80`).then(r => r.json()),
    [minProfit]
  );
  const { data, loading, error, reload, lastFetchedAt } = useFetch(fetcher, [minProfit]);

  const opportunities = (data?.opportunities ?? []).filter(o =>
    !search || o.attribute.toLowerCase().includes(search.toLowerCase())
  );

  const totalProfit = opportunities.reduce((s, o) => s + o.profit * Math.min(o.available_pairs, 5), 0);

  return (
    <div className="page">
      <PageHeader
        icon={Sparkles}
        title="Shard Fusion Sniper"
        description="Buy two level-N attribute shards, fuse them into level-(N+1), sell for profit. Updated live from the AH index."
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="tag tag-gold" style={{ fontSize: 11, fontWeight: 800 }}>
              <Lock size={10} /> PREMIUM
            </span>
            <DataAge lastFetchedAt={lastFetchedAt} />
            <button className="btn-icon" onClick={reload} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
            </button>
          </div>
        }
      />

      {/* How it works */}
      <div className="card" style={{ marginBottom: 18, background: 'linear-gradient(135deg, rgba(251,191,36,0.05), rgba(192,132,252,0.03))' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 24, flexShrink: 0 }}>⚗️</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4, color: 'var(--text)' }}>How Attribute Shard Fusion Works</div>
            <div className="text-muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
              Combine <strong>2× level-N shards</strong> of the same attribute to get <strong>1× level-(N+1)</strong> shard.
              This sniper finds cases where buying 2 cheap shards + fusing is cheaper than buying the fused result directly on the AH.
              People make <span style={{ color: 'var(--gold)', fontWeight: 700 }}>100M+/hr</span> with the right attributes.
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18, alignItems: 'flex-end' }}>
        <div className="field" style={{ margin: 0, minWidth: 180 }}>
          <label>Min Profit</label>
          <select value={minProfit} onChange={e => setMinProfit(+e.target.value)}>
            <option value={0}>Any profit</option>
            <option value={100_000}>100K+</option>
            <option value={200_000}>200K+</option>
            <option value={500_000}>500K+</option>
            <option value={1_000_000}>1M+</option>
            <option value={5_000_000}>5M+</option>
          </select>
        </div>
        <div className="field" style={{ margin: 0, minWidth: 200 }}>
          <label>Search Attribute</label>
          <input
            type="text"
            placeholder="e.g. Warrior, Blazing…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="text-muted" style={{ fontSize: 12, marginBottom: 2 }}>
          {data?.total_shard_auctions?.toLocaleString() ?? '—'} shard listings ·{' '}
          {data?.attributes_found ?? '—'} attributes ·{' '}
          {data?.index_age_seconds != null ? `${Math.round(data.index_age_seconds)}s old` : ''}
        </div>
      </div>

      {/* Summary tiles */}
      {opportunities.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 18 }}>
          {[
            { label: 'Opportunities', value: opportunities.length, color: 'var(--blue)' },
            { label: 'Best Profit', value: formatCoins(opportunities[0]?.profit ?? 0), color: 'var(--gold)' },
            { label: 'Best ROI', value: `${opportunities[0]?.roi_pct ?? 0}%`, color: 'var(--green)' },
            { label: 'Est. Total (5×ea)', value: formatCoins(totalProfit), color: 'var(--purple)' },
          ].map(t => (
            <div key={t.label} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--text-muted)', marginBottom: 6 }}>{t.label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: t.color }}>{t.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Error / loading */}
      {error && <div className="error-box">{error.message ?? String(error)}</div>}
      {loading && <div className="spinner" />}
      {!loading && !error && data && !data.ready && (
        <div className="info-box">AH index is warming up — try again in a few seconds.</div>
      )}

      {/* Table */}
      {!loading && opportunities.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Attribute</th>
                  <th>Fusion</th>
                  <th>
                    <TooltipUI content="Sum of the two cheapest shards you need to buy">
                      <span style={{ cursor: 'help', textDecoration: 'underline dotted' }}>Fusion Cost</span>
                    </TooltipUI>
                  </th>
                  <th>
                    <TooltipUI content="Median AH price for the fused result">
                      <span style={{ cursor: 'help', textDecoration: 'underline dotted' }}>AH Sell Price</span>
                    </TooltipUI>
                  </th>
                  <th>Profit</th>
                  <th>ROI</th>
                  <th>
                    <TooltipUI content="How many fusions you can do right now with available listings">
                      <span style={{ cursor: 'help', textDecoration: 'underline dotted' }}>Pairs Avail.</span>
                    </TooltipUI>
                  </th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((o, i) => (
                  <tr key={`${o.attribute}-${o.from_level}`} style={i === 0 ? { background: 'rgba(251,191,36,0.03)' } : {}}>
                    <td className="text-muted" style={{ fontSize: 12 }}>{i + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="text-bold" style={{ fontSize: 13 }}>{o.attribute}</span>
                        {i === 0 && <span className="tag tag-gold" style={{ fontSize: 9 }}>BEST</span>}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Lv {o.from_level}</span>
                        <span style={{ color: 'var(--gold)', fontSize: 11 }}>{STAR_LEVELS[o.from_level]}</span>
                        <span style={{ color: 'var(--text-dim)' }}>×2 →</span>
                        <span style={{ color: 'var(--text)' }}>Lv {o.to_level}</span>
                        <span style={{ color: 'var(--gold)', fontSize: 11 }}>{STAR_LEVELS[o.to_level]}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>
                        <span style={{ color: 'var(--blue)', fontWeight: 700 }}>{formatCoins(o.fusion_cost)}</span>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                          {formatCoins(o.shard_1_price)} + {formatCoins(o.shard_2_price)}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>
                        <span style={{ fontWeight: 700 }}>{formatCoins(o.sell_price)}</span>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                          min: {formatCoins(o.sell_min)} · {o.sell_listings} listed
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{
                        fontSize: i < 3 ? 16 : 14,
                        fontWeight: 800,
                        color: o.profit >= 1_000_000 ? 'var(--gold)' : 'var(--green)',
                        textShadow: o.profit >= 5_000_000 ? '0 0 12px rgba(251,191,36,0.5)' : 'none',
                      }}>
                        +{formatCoins(o.profit)}
                      </span>
                    </td>
                    <td><RoiTag roi={o.roi_pct} /></td>
                    <td>
                      <span style={{ fontSize: 13, fontWeight: 700, color: o.available_pairs >= 5 ? 'var(--green)' : o.available_pairs >= 2 ? 'var(--gold)' : 'var(--red)' }}>
                        {o.available_pairs}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !error && opportunities.length === 0 && data?.ready && (
        <div className="empty-state">
          <span className="empty-state-icon">🔮</span>
          <span>No fusion opportunities found. Try lowering min profit or wait for AH to refresh.</span>
        </div>
      )}
    </div>
  );
}
