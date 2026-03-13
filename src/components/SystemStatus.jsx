import { useCallback } from 'react';
import { Activity, Server, Database, Clock } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import { useFetch } from '../hooks/useFetch';
import { fetchHealth, fetchStatus, formatNumber } from '../utils/api';

function formatUptime(seconds) {
  if (seconds == null) return 'N/A';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

export default function SystemStatus() {
  const healthFetcher = useCallback((options = {}) => fetchHealth(options), []);
  const statusFetcher = useCallback((options = {}) => fetchStatus(options), []);

  const { data: health, loading: healthLoading, error: healthError } = useFetch(
    healthFetcher,
    [],
    { refreshInterval: 30_000 }
  );
  const { data: status, loading: statusLoading, error: statusError } = useFetch(
    statusFetcher,
    [],
    { refreshInterval: 60_000 }
  );

  const loading = healthLoading || statusLoading;
  const error = healthError || statusError;

  return (
    <div className="page">
      <PageHeader
        icon={Activity}
        title="System Status"
        description="Live health, cache, and index freshness for the SkyHelper backend."
      />

      {error && <div className="error-box">{error}</div>}

      {loading && !health && !status && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 90 }} />)}
        </div>
      )}

      {(health || status) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <StatusCard
            icon={Server}
            label="API Health"
            value={health?.status ?? 'N/A'}
            sub={`Uptime ${formatUptime(health?.uptime_seconds)}`}
            accent="green"
          />
          <StatusCard
            icon={Database}
            label="AH Index"
            value={status?.ah_index?.ready ? 'Ready' : 'Loading'}
            sub={`${formatNumber(status?.ah_index?.auctions ?? 0)} auctions`}
            accent={status?.ah_index?.ready ? 'gold' : 'blue'}
          />
          <StatusCard
            icon={Clock}
            label="Index Age"
            value={status?.ah_index?.last_update ? `${Math.round((Date.now() / 1000) - status.ah_index.last_update)}s` : 'N/A'}
            sub="time since last refresh"
            accent="purple"
          />
          <StatusCard
            icon={Database}
            label="Price History"
            value={formatNumber(status?.price_history?.tracked_items ?? 0)}
            sub={`short ${formatNumber(status?.price_history?.tracked_items ?? 0)} / long ${formatNumber(status?.price_history?.tracked_items_long ?? 0)}`}
            accent="cyan"
          />
          <StatusCard
            icon={Database}
            label="Cache"
            value={status?.cache?.redis_enabled ? 'Redis' : 'Memory'}
            sub={`${formatNumber(status?.cache?.entries ?? 0)} entries`}
            accent={status?.cache?.redis_enabled ? 'green' : 'blue'}
          />
        </div>
      )}

      {status && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="card__title">Cache Overview</div>
          <div className="table-wrap" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {(status.cache?.keys ?? []).map(key => (
                  <tr key={key}>
                    <td className="text-bold">{key}</td>
                    <td className="text-muted">{key.includes(':') ? key.split(':')[0] : 'general'}</td>
                  </tr>
                ))}
                {(!status.cache?.keys || status.cache.keys.length === 0) && (
                  <tr>
                    <td className="text-muted" colSpan={2}>No cache keys yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className={`stat-tile stat-tile--${accent}`}>
      <div className="stat-tile__header">
        <span className="stat-tile__label">{label}</span>
        <Icon size={15} className="stat-tile__icon" />
      </div>
      <div className="stat-tile__value">{value}</div>
      {sub && <div className="stat-tile__sub">{sub}</div>}
    </div>
  );
}
