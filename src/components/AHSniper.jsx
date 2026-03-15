import { useCallback } from 'react';
import { Target, RefreshCw, Zap, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react';
import { useFetch } from '../hooks/useFetch';
import PageHeader from './ui/PageHeader';
import DataAge from './ui/DataAge';
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
  { label: 'Any (5%)',   value: 5  },
  { label: 'Snipe (10%)', value: 10 },
  { label: 'Good (20%)',  value: 20 },
  { label: 'Safe (30%)', value: 30 },
];

const SORT_COLS = [
  { key: 'profit',        label: 'Est. Profit' },
  { key: 'pct_below',     label: '% Below' },
  { key: 'listing_price', label: 'Listed' },
];

function fmtTime(endMs) {
  if (!endMs) return '—';
  const secs = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
  if (secs <= 0) return 'Ended';
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function SortHeader({ col, sortKey, setSortKey, style, children }) {
  const active = sortKey === col;
  return (
    <th
      onClick={() => setSortKey(col)}
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style }}
      title={`Sort by ${col}`}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        {children}
        {active
          ? <ChevronDown size={11} style={{ color: 'var(--gold)' }} />
          : <ChevronUp size={11} style={{ opacity: 0.3 }} />}
      </span>
    </th>
  );
}

export default function AHSniper() {
  const [threshold, setThreshold] = useUserData('sniper_threshold', 20);
  const [minProfit, setMinProfit] = useUserData('sniper_min_profit', 100000);
  const [category, setCategory]   = useUserData('sniper_category', 'all');
  const [refreshMs, setRefreshMs] = useUserData('sniper_refresh_ms', 0);
  const [sortKey, setSortKey]     = useUserData('sniper_sort_key', 'profit');

  const fetcher = useCallback(
    (options = {}) => fetchSniperResults(threshold, minProfit, category, 100, options),
    [threshold, minProfit, category],
  );

  const { data, loading, error, reload, lastFetchedAt } = useFetch(
    fetcher,
    [threshold, minProfit, category],
    { refreshInterval: refreshMs },
  );

  const indexing  = !!data && data.ready === false;
  const snipes    = data?.snipes ?? [];
  const sorted    = [...snipes].sort((a, b) => b[sortKey] - a[sortKey]);
  const hotCount  = snipes.filter(s => s.pct_below >= 40).length;

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
              {!data ? 'Loading…' : indexing ? 'Indexing…' : `${snipes.length} snipes`}
            </div>
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
          <label>Min Profit</label>
          <input type="number" value={minProfit} step={50000}
            onChange={e => setMinProfit(+e.target.value)} style={{ width: 130 }} />
        </div>
        <div className="field">
          <label>Rarity</label>
          <select value={category} onChange={e => setCategory(e.target.value)} style={{ width: 130 }}>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
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
        Prices based on current AH index (refreshed ~60s). Verify in-game before buying.
        Index age: {data?.index_age_seconds != null ? `${Math.round(data.index_age_seconds)}s` : '—'}
      </div>

      {error && <div className="error-box">{error}</div>}

      {loading && !data ? (
        <SkeletonTable rows={12} cols={7} />
      ) : indexing && sorted.length === 0 && !loading ? (
        <div className="empty-state">
          <span className="empty-state-icon">⏳</span>
          <span>Warming up the Auction House index…</span>
          <span className="text-muted" style={{ fontSize: 12 }}>Takes ~10–30s on first load. Hit refresh or enable auto-refresh.</span>
        </div>
      ) : sorted.length === 0 && !loading ? (
        <div className="empty-state">
          <span className="empty-state-icon">🎯</span>
          <span>No snipes found with current filters.</span>
          <span className="text-muted" style={{ fontSize: 12 }}>Try lowering the threshold or min profit.</span>
        </div>
      ) : (
        <div className="table-wrap">
          <table style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: 36 }} />   {/* # */}
              <col style={{ width: '30%' }} /> {/* Item */}
              <col style={{ width: 100 }} />  {/* Rarity */}
              <col style={{ width: 120 }} />  {/* Listed */}
              <col style={{ width: 120 }} />  {/* Median */}
              <col style={{ width: 90 }} />   {/* % Below */}
              <col style={{ width: 120 }} />  {/* Profit */}
              <col style={{ width: 72 }} />   {/* Time left */}
              <col style={{ width: 64 }} />   {/* Listings */}
            </colgroup>
            <thead>
              <tr>
                <th style={{ textAlign: 'center' }}>#</th>
                <th>Item</th>
                <th>Rarity</th>
                <SortHeader col="listing_price" sortKey={sortKey} setSortKey={setSortKey}
                  style={{ textAlign: 'right' }}>Listed</SortHeader>
                <th style={{ textAlign: 'right', color: 'var(--text-muted)', fontWeight: 400 }}>Median</th>
                <SortHeader col="pct_below" sortKey={sortKey} setSortKey={setSortKey}
                  style={{ textAlign: 'center' }}>% Below</SortHeader>
                <SortHeader col="profit" sortKey={sortKey} setSortKey={setSortKey}
                  style={{ textAlign: 'right' }}>Est. Profit</SortHeader>
                <th style={{ textAlign: 'right' }}>Time Left</th>
                <th style={{ textAlign: 'right' }}>Listings</th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 80).map((s, i) => {
                const isHot = s.pct_below >= 40;
                const timeStr = fmtTime(s.end_time);
                const timeSoon = s.end_time && (s.end_time - Date.now()) < 300_000; // < 5 min
                return (
                  <tr key={s.uuid ?? i} className={isHot ? 'snipe-row--hot clickable-row' : 'clickable-row'}>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                        {isHot && (
                          <span className="tag tag-gold tag--glow-gold" style={{ fontSize: 9, flexShrink: 0 }}>
                            🔥 HOT
                          </span>
                        )}
                        <ItemIcon itemId={s.item_id || ''} name={s.name} size={20} kind="ah" />
                        <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.name}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`tag rarity-tag ${rarityClass(s.tier)}`} style={{ fontSize: 10 }}>
                        {s.tier}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {formatCoins(s.listing_price)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: 12 }}>
                      {formatCoins(s.median_price)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`tag ${isHot ? 'tag-gold tag--glow-gold' : s.pct_below >= 25 ? 'tag-green' : 'tag-blue'}`}
                        style={{ fontSize: 11 }}>
                        -{s.pct_below}%
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={`tag tag-green${s.profit >= 1_000_000 ? ' tag--glow-green' : ''}`}
                        style={{ fontSize: 11 }}>
                        +{formatCoins(s.profit)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 12,
                      color: timeSoon ? '#f97316' : 'var(--text-muted)' }}>
                      {timeStr}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: 12 }}>
                      {s.listings_count}
                    </td>
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
