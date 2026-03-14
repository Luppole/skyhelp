import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, TrendingUp, Star } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useFetch } from '../hooks/useFetch';
import { SkeletonTable } from './ui/Skeleton';
import ItemIcon from './ui/ItemIcon';
import PageHeader from './ui/PageHeader';
import DataAge from './ui/DataAge';
import BazaarDrawer from './BazaarDrawer';
import { fetchBazaarFlips, formatCoins, formatNumber } from '../utils/api';
import { useSupabaseUser } from '../hooks/useSupabaseUser';
import { fetchUserData, saveUserData } from '../utils/supabaseStore';
import { useUserData } from '../hooks/useUserData';

const REFRESH_OPTIONS = [
  { label: 'Off', value: 0        },
  { label: '30s', value: 30_000   },
  { label: '1m',  value: 60_000   },
  { label: '2m',  value: 120_000  },
];
const SORT_OPTIONS = [
  { value: 'profit_per_item',             label: 'Profit / item'  },
  { value: 'margin_pct',                  label: 'Margin %'       },
  { value: 'weekly_volume',               label: 'Weekly volume'  },
  { value: 'profit_per_million_invested', label: 'Profit / 1M'   },
];

function loadWatchlist() {
  try { return JSON.parse(localStorage.getItem('bz-watchlist') ?? '[]'); }
  catch { return []; }
}

function loadPresets() {
  try { return JSON.parse(localStorage.getItem('bz-presets') ?? '[]'); }
  catch { return []; }
}
function savePresets(presets) {
  localStorage.setItem('bz-presets', JSON.stringify(presets));
}

export default function Bazaar() {
  const [search, setSearch]         = useUserData('bazaar_search', '');
  const [minVolume, setMinVolume]   = useUserData('bazaar_min_volume', 1000);
  const [minMargin, setMinMargin]   = useUserData('bazaar_min_margin', 2);
  const [sortKey, setSortKey]       = useUserData('bazaar_sort_key', 'profit_per_item');
  const [refreshMs, setRefreshMs]   = useUserData('bazaar_refresh_ms', 0);
  const [watchlistOnly, setWLOnly]  = useUserData('bazaar_watchlist_only', false);
  const [watchlist, setWatchlist]   = useState(loadWatchlist);
  const [drawerItem, setDrawerItem] = useState(null);
  const [presets, setPresets]       = useState(loadPresets);
  const [presetName, setPresetName] = useState('');
  const { user } = useSupabaseUser();

  const fetcher = useCallback(
    (options = {}) => fetchBazaarFlips(minVolume, minMargin, 200, options),
    [minVolume, minMargin],
  );
  const { data, loading, error, reload, lastFetchedAt } = useFetch(fetcher, [minVolume, minMargin], {
    refreshInterval: refreshMs,
  });

  function toggleWatch(itemId) {
    setWatchlist(prev => {
      const next = prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId];
      localStorage.setItem('bz-watchlist', JSON.stringify(next));
      return next;
    });
  }

  useEffect(() => {
    let mounted = true;
    async function loadRemote() {
      if (!user) return;
      const remoteWatch = await fetchUserData(user.id, 'bazaar_watchlist');
      const remotePresets = await fetchUserData(user.id, 'bazaar_presets');
      if (mounted && Array.isArray(remoteWatch)) setWatchlist(remoteWatch);
      if (mounted && Array.isArray(remotePresets)) setPresets(remotePresets);
    }
    loadRemote();
    return () => { mounted = false; };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    saveUserData(user.id, 'bazaar_watchlist', watchlist).catch(() => {});
  }, [watchlist, user]);

  useEffect(() => {
    if (!user) return;
    saveUserData(user.id, 'bazaar_presets', presets).catch(() => {});
  }, [presets, user]);

  function savePreset() {
    if (!presetName.trim()) return;
    const next = [
      ...presets.filter(p => p.name !== presetName.trim()),
      {
        name: presetName.trim(),
        search,
        minVolume,
        minMargin,
        sortKey,
        watchlistOnly,
      },
    ];
    setPresets(next);
    savePresets(next);
    setPresetName('');
  }

  function applyPreset(p) {
    setSearch(p.search ?? '');
    setMinVolume(p.minVolume ?? 1000);
    setMinMargin(p.minMargin ?? 2);
    setSortKey(p.sortKey ?? 'profit_per_item');
    setWLOnly(!!p.watchlistOnly);
  }

  function deletePreset(name) {
    const next = presets.filter(p => p.name !== name);
    setPresets(next);
    savePresets(next);
  }

  const flips = data?.flips ?? [];
  const filtered = flips
    .filter(f => !watchlistOnly || watchlist.includes(f.item_id))
    .filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b[sortKey] - a[sortKey]);

  const chartData = filtered.slice(0, 10).map(f => ({
    name: f.name.split(' ').slice(-1)[0],
    profit: f.profit_per_item,
  }));

  return (
    <div className="page">
      <PageHeader
        icon={TrendingUp}
        title="Bazaar Flip Finder"
        description="Buy order → sell order. 1.25% tax applied. Click any row to see price history."
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <DataAge lastFetchedAt={lastFetchedAt} />
            <button className="btn-icon" onClick={reload} disabled={loading} title="Refresh">
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
            </button>
          </div>
        }
      />

      {/* Toolbar */}
      <div className="toolbar">
        <div className="field">
          <label>Search</label>
          <input type="text" placeholder="e.g. Enchanted Cobblestone" value={search}
            onChange={e => setSearch(e.target.value)} style={{ width: 220 }} />
        </div>
        <div className="field">
          <label>Min weekly vol</label>
          <input type="number" value={minVolume} onChange={e => setMinVolume(+e.target.value)} style={{ width: 110 }} />
        </div>
        <div className="field">
          <label>Min margin %</label>
          <input type="number" step="0.5" value={minMargin} onChange={e => setMinMargin(+e.target.value)} style={{ width: 90 }} />
        </div>
        <div className="field">
          <label>Sort by</label>
          <select value={sortKey} onChange={e => setSortKey(e.target.value)}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Auto-refresh</label>
          <div className="btn-group">
            {REFRESH_OPTIONS.map(o => (
              <button key={o.value}
                className={refreshMs === o.value ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                onClick={() => setRefreshMs(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <label className="checkbox-label" style={{ paddingBottom: 2 }}>
          <input type="checkbox" checked={watchlistOnly} onChange={e => setWLOnly(e.target.checked)} />
          <Star size={13} color="var(--gold)" fill={watchlistOnly ? 'var(--gold)' : 'none'} />
          Watchlist only
        </label>
        <div className="field" style={{ minWidth: 200 }}>
          <label>Saved Presets</label>
          <select onChange={e => {
            const p = presets.find(x => x.name === e.target.value);
            if (p) applyPreset(p);
          }}>
            <option value="">Select preset…</option>
            {presets.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
        </div>
        <div className="field" style={{ minWidth: 180 }}>
          <label>Save Preset</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={presetName}
              onChange={e => setPresetName(e.target.value)}
              placeholder="e.g. High Margin"
            />
            <button type="button" className="btn-secondary btn-sm" onClick={savePreset}>Save</button>
          </div>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      {/* Bar chart — top 10 */}
      {(loading || filtered.length > 0) && !error && (
        <div className="card chart-card">
          <div className="card__title">Top 10 Flips — Profit / Item</div>
          {loading && !data ? (
            <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="spinner" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis tickFormatter={v => formatCoins(v)} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} width={48} />
                <Tooltip
                  formatter={(v) => [formatCoins(v), 'Profit/item']}
                  contentStyle={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6 }}
                  labelStyle={{ color: 'var(--text)' }}
                />
                <Bar dataKey="profit" radius={[3, 3, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={`hsl(${45 - i * 3}, 90%, ${62 - i * 2}%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Table */}
      {loading && !data ? (
        <SkeletonTable rows={10} cols={8} />
      ) : (
        !error && filtered.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36 }}><Star size={11} /></th>
                  <th>#</th>
                  <th>Item</th>
                  <th>Buy Price</th>
                  <th>Sell Price</th>
                  <th>Profit / item</th>
                  <th>Margin %</th>
                  <th>Weekly Vol</th>
                  <th>Profit / 1M</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((f, i) => (
                  <tr key={f.item_id} className="clickable-row" onClick={() => setDrawerItem(f)}>
                    <td onClick={e => { e.stopPropagation(); toggleWatch(f.item_id); }} style={{ padding: '0 6px' }}>
                      <button className="btn-icon btn-sm" style={{ padding: '4px 6px', border: 'none', background: 'none' }}>
                        <Star size={12}
                          fill={watchlist.includes(f.item_id) ? 'var(--gold)' : 'none'}
                          color="var(--gold)" />
                      </button>
                    </td>
                    <td className="text-muted">{i + 1}</td>
                    <td className="text-bold">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ItemIcon itemId={f.item_id} name={f.name} size={22} />
                        <span>{f.name}</span>
                      </div>
                    </td>
                    <td>{formatCoins(f.sell_price)}</td>
                    <td>{formatCoins(f.buy_price)}</td>
                    <td>
                      <span className={`tag ${f.profit_per_item > 0 ? 'tag-green' : 'tag-red'}`}>
                        {f.profit_per_item > 0 ? '+' : ''}{formatCoins(f.profit_per_item)}
                      </span>
                    </td>
                    <td>
                      <span className={`tag ${f.margin_pct >= 5 ? 'tag-green' : f.margin_pct >= 2 ? 'tag-gold' : 'tag-red'}`}>
                        {f.margin_pct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="text-muted">{formatNumber(f.weekly_volume)}</td>
                    <td className="text-muted">{formatCoins(f.profit_per_million_invested)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {!loading && filtered.length === 0 && !error && data && (
        <p className="empty-state">
          {watchlistOnly && watchlist.length === 0
            ? 'Your watchlist is empty. Star items in the table to add them.'
            : 'No flips found with current filters.'}
        </p>
      )}

      {presets.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="card__title">Manage Presets</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {presets.map(p => (
              <div key={p.name} className="tag tag-blue" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  className="btn-icon btn-sm"
                  onClick={() => applyPreset(p)}
                  title="Apply preset"
                  style={{ background: 'none' }}
                >
                  #{p.name}
                </button>
                <button
                  className="btn-icon btn-sm btn-danger"
                  onClick={() => deletePreset(p.name)}
                  title="Delete preset"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <BazaarDrawer
        item={drawerItem}
        onClose={() => setDrawerItem(null)}
        watchlist={watchlist}
        onToggleWatch={toggleWatch}
      />
    </div>
  );
}
