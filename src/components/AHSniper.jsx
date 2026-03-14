import { useCallback } from 'react';
import { Target, RefreshCw, Zap, AlertTriangle } from 'lucide-react';
import { useFetch } from '../hooks/useFetch';
import PageHeader from './ui/PageHeader';
import { SkeletonTable } from './ui/Skeleton';
import { fetchSniperResults, formatCoins } from '../utils/api';
import { rarityClass } from '../utils/skyblock';
import { useUserData } from '../hooks/useUserData';
import ItemIcon from './ui/ItemIcon';

const CATEGORIES = ['all', 'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const REFRESH_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '30s', value: 30_000 },
  { label: '1m',  value: 60_000 },
];

const THRESHOLD_PRESETS = [
  { label: 'Snipe (10%)', value: 10 },
  { label: 'Good (20%)',  value: 20 },
  { label: 'Safe (30%)', value: 30 },
  { label: 'Any (5%)',   value: 5  },
];

export default function AHSniper() {
  const [threshold, setThreshold]   = useUserData('sniper_threshold', 20);
  const [minProfit, setMinProfit]   = useUserData('sniper_min_profit', 100000);
  const [category, setCategory]     = useUserData('sniper_category', 'all');
  const [refreshMs, setRefreshMs]   = useUserData('sniper_refresh_ms', 0);
  const [sortKey, setSortKey]       = useUserData('sniper_sort_key', 'profit');

  const fetcher = useCallback(
    (options = {}) => fetchSniperResults(threshold, minProfit, category, 100, options),
    [threshold, minProfit, category],
  );

  const { data, loading, error, reload } = useFetch(fetcher, [threshold, minProfit, category], {
    refreshInterval: refreshMs,
  });

  const indexing = !!data && data.ready === false;
  const snipes = (data?.snipes ?? []).map(s => ({ ...s, item_id: s.item_id || s.item_name_id || '' }));
  const sorted = [...snipes].sort((a, b) => b[sortKey] - a[sortKey]);

  const hotCount = snipes.filter(s => s.pct_below >= 40).length;

  return (
    <div className="page">
      <PageHeader
        icon={Target}
        title="AH Flip Sniper"
        description="Real-time BIN listings priced below market median. Click fast — these won't last."
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {hotCount > 0 && (
              <span className="tag tag-gold tag--glow-gold">
                <Zap size={11} /> {hotCount} HOT
              </span>
            )}
            <div className="status-badge">
              <span className={`status-dot ${(!data || indexing) ? 'status-dot--yellow' : 'status-dot--green'}`} />
              {!data ? 'Loading…' : indexing ? 'Indexing…' : `${data.snipes?.length ?? 0} snipes`}
            </div>
            <button className="btn-icon" onClick={reload} disabled={loading} title="Refresh">
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
            </button>
          </div>
        }
      />

      {/* Toolbar */}
      <div className="toolbar">
        <div className="field">
          <label>Min % below median — {threshold}%</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {THRESHOLD_PRESETS.map(p => (
              <button key={p.value}
                className={threshold === p.value ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                onClick={() => setThreshold(p.value)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Min Profit (coins)</label>
          <input type="number" value={minProfit} step={50000}
            onChange={e => setMinProfit(+e.target.value)} style={{ width: 130 }} />
        </div>
        <div className="field">
          <label>Rarity</label>
          <select value={category} onChange={e => setCategory(e.target.value)} style={{ width: 130 }}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Sort</label>
          <select value={sortKey} onChange={e => setSortKey(e.target.value)} style={{ width: 130 }}>
            <option value="profit">Profit</option>
            <option value="pct_below">% Below</option>
            <option value="listing_price">Listing Price</option>
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
      </div>

      <div className="info-box" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <AlertTriangle size={14} />
        Prices based on current AH index (refreshed every ~60s). Verify in-game before buying. Index age: {data?.index_age_seconds != null ? `${Math.round(data.index_age_seconds)}s` : '—'}
      </div>

      {error && <div className="error-box">{error}</div>}

      {loading && !data ? (
        <SkeletonTable rows={12} cols={6} />
      ) : indexing && sorted.length === 0 && !loading ? (
        <div className="empty-state">
          <span className="empty-state-icon">Indexing…</span>
          <span>Warming up the Auction House index.</span>
          <span className="text-muted" style={{ fontSize: 12 }}>This can take ~10–30s on first load. Hit refresh or enable auto-refresh.</span>
        </div>
      ) : sorted.length === 0 && !loading ? (
        <div className="empty-state">
          <span className="empty-state-icon">🎯</span>
          <span>No snipes found with current filters.</span>
          <span className="text-muted" style={{ fontSize: 12 }}>Try lowering the threshold or min profit.</span>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>Rarity</th>
                <th>Listed Price</th>
                <th>Market Median</th>
                <th>% Below</th>
                <th>Est. Profit</th>
                <th># Listings</th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 80).map((s, i) => {
                const isHot = s.pct_below >= 40;
                return (
                  <tr key={s.uuid} className={isHot ? 'snipe-row--hot clickable-row' : 'clickable-row'}>
                    <td className="text-muted">{i + 1}</td>
                    <td className="text-bold">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isHot && <span>HOT</span>}
                        <ItemIcon itemId={s.item_id || ''} name={s.name} size={22} kind="ah" />
                        <span>{s.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`tag rarity-tag ${rarityClass(s.tier)}`}>
                        {s.tier}
                      </span>
                    </td>
                    <td>{formatCoins(s.listing_price)}</td>
                    <td className="text-muted">{formatCoins(s.median_price)}</td>
                    <td>
                      <span className={`tag ${s.pct_below >= 40 ? 'tag-gold tag--glow-gold' : s.pct_below >= 25 ? 'tag-green' : 'tag-blue'}`}>
                        -{s.pct_below}%
                      </span>
                    </td>
                    <td>
                      <span className={`tag tag-green ${s.profit >= 1_000_000 ? 'tag--glow-green' : ''}`}>
                        +{formatCoins(s.profit)}
                      </span>
                    </td>
                    <td className="text-muted">{s.listings_count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
