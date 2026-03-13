import { useEffect, useMemo, useState } from 'react';
import { X, Star } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { fetchBazaarHistory, fetchBazaarHistoryLong, formatCoins } from '../utils/api';
import ItemIcon from './ui/ItemIcon';

export default function BazaarDrawer({ item, onClose, watchlist, onToggleWatch }) {
  const [history, setHistory]     = useState(null);
  const [histLoading, setLoading] = useState(false);
  const [range, setRange] = useState('12h');
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    if (!item) return;
    const controller = new AbortController();
    setLoading(true);
    setHistory(null);
    const fetcher = range === '12h'
      ? fetchBazaarHistory(item.item_id, { signal: controller.signal })
      : fetchBazaarHistoryLong(item.item_id, range === '7d' ? '7d' : '30d', { signal: controller.signal });

    fetcher
      .then(d => {
        setHistory(d?.history ?? []);
        setMetrics(d?.metrics ?? null);
      })
      .catch(() => {
        setHistory([]);
        setMetrics(null);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [item?.item_id, range]);

  const { chartData } = useMemo(() => {
    const raw = history ?? [];
    const step = Math.max(1, Math.floor(raw.length / 80));
    const format = range === '12h'
      ? (t) => new Date(t * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : (t) => new Date(t * 1000).toLocaleDateString();
    return {
      stepLabel: step,
      chartData: raw.filter((_, i) => i % step === 0).map(h => ({
        time: format(h.t),
        'Buy Order': h.buy,
        'Sell Order': h.sell,
      })),
    };
  }, [history, range]);

  if (!item) return null;

  const isWatched = watchlist.includes(item.item_id);

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer">
        {/* Header */}
        <div className="drawer__header">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <ItemIcon itemId={item.item_id} name={item.name} size={34} />
            <div>
              <div className="drawer__title">{item.name}</div>
              <span className="text-muted" style={{ fontSize: 11, fontFamily: 'monospace' }}>
                {item.item_id}
              </span>
            </div>
          </div>
          <div className="drawer__actions">
            <button
              className={`btn-icon${isWatched ? ' btn-icon--active' : ''}`}
              onClick={() => onToggleWatch(item.item_id)}
              title={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
            >
              <Star size={14} fill={isWatched ? 'var(--gold)' : 'none'} color="var(--gold)" />
            </button>
            <button className="btn-icon" onClick={onClose} title="Close">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="card drawer__stats">
          <div className="card__title">Current Prices</div>
          <div className="stat-row">
            <span className="stat-row__label">Buy Order (what you pay)</span>
            <span className="stat-row__value">{formatCoins(item.sell_price)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-row__label">Sell Order (what you get)</span>
            <span className="stat-row__value">{formatCoins(item.buy_price)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-row__label">Profit / item (after tax)</span>
            <span className="stat-row__value--gold">+{formatCoins(item.profit_per_item)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-row__label">Margin</span>
            <span className={item.margin_pct >= 5 ? 'stat-row__value--gold' : 'stat-row__value'}>
              {item.margin_pct.toFixed(2)}%
            </span>
          </div>
          <div className="stat-row">
            <span className="stat-row__label">Weekly volume</span>
            <span className="stat-row__value">{item.weekly_volume.toLocaleString()}</span>
          </div>
        </div>

        {/* Price history chart */}
        <div className="card">
          <div className="card__title">
            Price History
            {history && (
              <span className="text-muted" style={{ fontWeight: 400, marginLeft: 6, textTransform: 'none', letterSpacing: 0 }}>
                - range {range}
              </span>
            )}
          </div>
          <div className="tab-pills" style={{ marginTop: 10 }}>
            {['12h', '7d', '30d'].map(r => (
              <button
                key={r}
                className={`tab-pill${range === r ? ' tab-pill--active' : ''}`}
                onClick={() => setRange(r)}
              >
                {r}
              </button>
            ))}
          </div>

          {metrics && (
            <div className="stat-grid" style={{ marginTop: 6 }}>
              <div className="card" style={{ padding: 12 }}>
                <div className="stat-row">
                  <span className="stat-row__label">Volatility</span>
                  <span className="stat-row__value--gold">{metrics.volatility_pct}%</span>
                </div>
                <div className="stat-row">
                  <span className="stat-row__label">Change</span>
                  <span className={metrics.change_pct >= 0 ? 'stat-row__value--gold' : 'stat-row__value'}>
                    {metrics.change_pct >= 0 ? '+' : ''}{metrics.change_pct}%
                  </span>
                </div>
              </div>
              <div className="card" style={{ padding: 12 }}>
                <div className="stat-row">
                  <span className="stat-row__label">Min</span>
                  <span className="stat-row__value">{formatCoins(metrics.min)}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-row__label">Max</span>
                  <span className="stat-row__value">{formatCoins(metrics.max)}</span>
                </div>
              </div>
              <div className="card" style={{ padding: 12 }}>
                <div className="stat-row">
                  <span className="stat-row__label">Average</span>
                  <span className="stat-row__value">{formatCoins(metrics.avg)}</span>
                </div>
              </div>
            </div>
          )}
          {histLoading && (
            <div className="skeleton" style={{ height: 180, borderRadius: 6 }} />
          )}
          {!histLoading && chartData.length < 2 && (
            <p className="text-muted" style={{ fontSize: 13, padding: '20px 0' }}>
              Not enough data yet - check back after a few minutes.
            </p>
          )}
          {!histLoading && chartData.length >= 2 && (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gBuy" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--blue)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--blue)" stopOpacity={0}   />
                  </linearGradient>
                  <linearGradient id="gSell" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--gold)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--gold)" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="time" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis
                  tickFormatter={v => formatCoins(v)}
                  tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                  width={54}
                />
                <Tooltip
                  formatter={(v, name) => [formatCoins(v), name]}
                  contentStyle={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                  labelStyle={{ color: 'var(--text-muted)' }}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-muted)', paddingTop: 4 }} />
                <Area type="monotone" dataKey="Buy Order"  stroke="var(--blue)" fill="url(#gBuy)"  strokeWidth={1.5} dot={false} />
                <Area type="monotone" dataKey="Sell Order" stroke="var(--gold)" fill="url(#gSell)" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </aside>
    </>
  );
}
