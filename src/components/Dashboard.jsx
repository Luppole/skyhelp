import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Gavel, Package, Zap } from 'lucide-react';
import { useFetch } from '../hooks/useFetch';
import { SkeletonLine } from './ui/Skeleton';
import { fetchBazaarSummary, fetchBazaarFlips, fetchAuctionStatus, formatCoins, formatNumber } from '../utils/api';

const REFRESH_MS = 60_000;

export default function Dashboard() {
  const [countdown, setCountdown] = useState(REFRESH_MS / 1000);

  const { data: summary, loading: sumLoading } = useFetch(
    fetchBazaarSummary, [], { refreshInterval: REFRESH_MS }
  );
  const { data: ahStatus } = useFetch(
    fetchAuctionStatus, [], { refreshInterval: 30_000 }
  );
  const { data: flipsData, loading: flipsLoading } = useFetch(
    useCallback((options = {}) => fetchBazaarFlips(1000, 2, 5, options), []),
    [], { refreshInterval: REFRESH_MS }
  );

  // Refresh countdown
  useEffect(() => {
    setCountdown(REFRESH_MS / 1000);
    const id = setInterval(() => setCountdown(c => c <= 1 ? REFRESH_MS / 1000 : c - 1), 1000);
    return () => clearInterval(id);
  }, [summary]);

  const topFlip = summary?.top_flip;
  const top5    = flipsData?.flips ?? [];

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header__left">
          <div>
            <h1 className="page-header__title">Dashboard</h1>
            <p className="page-header__desc">Live Hypixel SkyBlock market overview</p>
          </div>
        </div>
        <div className="page-header__actions">
          <span className="status-badge">
            <span className="status-dot status-dot--green" />
            Refreshes in {countdown}s
          </span>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="dash-tiles">
        <StatTile
          icon={Zap}
          label="Best Flip / Item"
          value={topFlip ? formatCoins(topFlip.profit_per_item) : '—'}
          sub={topFlip?.name ?? 'loading…'}
          accent="gold"
          highlight
          loading={sumLoading}
        />
        <StatTile
          icon={TrendingUp}
          label="Top Margin"
          value={topFlip ? `${topFlip.margin_pct.toFixed(1)}%` : '—'}
          sub={topFlip?.name ?? 'loading…'}
          accent="green"
          loading={sumLoading}
        />
        <StatTile
          icon={Package}
          label="Bazaar Products"
          value={summary ? formatNumber(summary.product_count) : '—'}
          sub="items tracked"
          accent="blue"
          loading={sumLoading}
        />
        <StatTile
          icon={Gavel}
          label="AH Auctions Live"
          value={ahStatus?.ready ? formatNumber(ahStatus.auction_count) : '—'}
          sub={ahStatus?.age_seconds != null ? `index ${ahStatus.age_seconds}s old` : 'indexing…'}
          accent="purple"
          loading={!ahStatus}
        />
      </div>

      {/* Top 5 Opportunities */}
      <div className="card">
        <div className="card__title">Top Opportunities Right Now</div>
        {flipsLoading && !top5.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <SkeletonLine width={24} height={12} />
                <SkeletonLine width="35%" height={12} />
                <SkeletonLine width="15%" height={12} />
                <SkeletonLine width="12%" height={12} />
              </div>
            ))}
          </div>
        ) : (
          <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item</th>
                  <th>Profit / item</th>
                  <th>Margin %</th>
                  <th>Weekly Vol</th>
                </tr>
              </thead>
              <tbody>
                {top5.map((f, i) => (
                  <tr key={f.item_id}>
                    <td className="text-muted">{i + 1}</td>
                    <td className="text-bold">{f.name}</td>
                    <td>
                      <span className="tag tag-green">+{formatCoins(f.profit_per_item)}</span>
                    </td>
                    <td>
                      <span className={`tag ${f.margin_pct >= 5 ? 'tag-green' : 'tag-gold'}`}>
                        {f.margin_pct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="text-muted">{f.weekly_volume.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, sub, accent, loading, highlight }) {
  return (
    <div className={`stat-tile stat-tile--${accent}${highlight ? ' stat-tile--highlight' : ''}`}>
      <div className="stat-tile__header">
        <span className="stat-tile__label">{label}</span>
        <Icon size={15} className="stat-tile__icon" />
      </div>
      {loading
        ? <div className="skeleton" style={{ height: 34, width: '55%', marginTop: 8, borderRadius: 6 }} />
        : <div className="stat-tile__value">{value}</div>
      }
      {sub && <div className="stat-tile__sub">{sub}</div>}
    </div>
  );
}
