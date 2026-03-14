import { useCallback, useEffect, useMemo, useState } from 'react';
import { Layers, Plus, Trash2, Download, Upload, TrendingUp, Cloud } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import PageHeader from './ui/PageHeader';
import { useFetch } from '../hooks/useFetch';
import { fetchBazaarFlips, fetchPriceBulk, formatCoins } from '../utils/api';
import { supabase, supabaseEnabled } from '../utils/supabase';
import { fetchUserData, saveUserData } from '../utils/supabaseStore';
import { useSupabaseUser } from '../hooks/useSupabaseUser';
import { useAuthModal } from './AuthProvider';

const STORAGE_KEY      = 'sb-portfolio';
const HISTORY_KEY      = 'sb-portfolio-history';
const SNAPSHOT_INTERVAL_MS = 4 * 60 * 60 * 1000; // save at most once per 4 hours

function loadPortfolio() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function savePortfolio(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}
function saveHistory(h) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
}

// Custom tooltip for the history chart
function HistoryTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-3)', border: '1px solid var(--border-bright)',
      borderRadius: 8, padding: '8px 14px', fontSize: 12,
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ color: 'var(--gold)', fontWeight: 800, fontSize: 15 }}>
        {formatCoins(payload[0].value)}
      </div>
    </div>
  );
}

export default function Portfolio() {
  const [items, setItems]       = useState(loadPortfolio);
  const [history, setHistory]   = useState(loadHistory);
  const [form, setForm]         = useState({ name: '', itemId: '', qty: 1, avgCost: '', manualPrice: '' });
  const [importError, setImportError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const { user } = useSupabaseUser();
  const { openAuth } = useAuthModal();

  const fetcher = useCallback((options = {}) => fetchBazaarFlips(0, 0, 500, options), []);
  const { data, loading } = useFetch(fetcher, [], { refreshInterval: 60_000 });

  const manualFetcher = useCallback(
    (options = {}) => {
      const ids = items.map(i => i.itemId).filter(Boolean).map(i => i.toUpperCase());
      if (!ids.length) return Promise.resolve({ prices: {} });
      return fetchPriceBulk(ids, options);
    },
    [items]
  );
  const { data: manualData } = useFetch(manualFetcher, [items], { refreshInterval: 120_000 });

  // Supabase sync — portfolio items
  useEffect(() => {
    let mounted = true;
    async function loadRemote() {
      if (!supabaseEnabled || !supabase || !user) return;
      const { data } = await supabase
        .from('user_portfolios').select('data').eq('user_id', user.id).maybeSingle();
      if (mounted && data?.data) { setItems(data.data); savePortfolio(data.data); }
    }
    loadRemote();
    return () => { mounted = false; };
  }, [user]);

  useEffect(() => {
    async function syncRemote() {
      if (!supabaseEnabled || !supabase || !user) return;
      await supabase.from('user_portfolios').upsert({
        user_id: user.id, data: items, updated_at: new Date().toISOString(),
      });
    }
    syncRemote().catch(() => {});
  }, [items, user]);

  // Supabase sync — history
  useEffect(() => {
    let mounted = true;
    async function loadRemoteHistory() {
      if (!user) return;
      const remote = await fetchUserData(user.id, 'portfolio_history');
      if (mounted && Array.isArray(remote) && remote.length > 0) {
        setHistory(remote);
        saveHistory(remote);
      }
    }
    loadRemoteHistory();
    return () => { mounted = false; };
  }, [user]);

  const priceMap = useMemo(() => {
    const map = {};
    for (const f of data?.flips ?? []) map[f.item_id] = f.buy_price;
    return map;
  }, [data]);

  const enriched = useMemo(() => items.map(item => {
    const live    = item.itemId && priceMap[item.itemId];
    const curated = item.itemId && manualData?.prices?.[item.itemId.toUpperCase()];
    const currentPrice = live || curated || Number(item.manualPrice || 0);
    const source   = live ? 'bazaar' : curated ? 'curated' : item.manualPrice ? 'manual' : 'n/a';
    const totalValue  = currentPrice * item.qty;
    const invested    = Number(item.avgCost || 0) * item.qty;
    const profit      = totalValue - invested;
    return { ...item, currentPrice, totalValue, invested, profit, source };
  }), [items, priceMap, manualData]);

  const totalValue  = enriched.reduce((sum, i) => sum + i.totalValue, 0);
  const totalProfit = enriched.reduce((sum, i) => sum + i.profit, 0);

  // Auto-snapshot: save to history at most every 4 hours when total value is nonzero
  useEffect(() => {
    if (totalValue === 0) return;
    const last = history[history.length - 1];
    const now  = Date.now();
    if (last && now - last.ts < SNAPSHOT_INTERVAL_MS) return;
    const snapshot = {
      ts:    now,
      date:  new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: Math.round(totalValue),
    };
    setHistory(prev => {
      // Keep last 90 snapshots
      const next = [...prev.slice(-89), snapshot];
      saveHistory(next);
      if (user) saveUserData(user.id, 'portfolio_history', next).catch(() => {});
      return next;
    });
  }, [totalValue]);  // intentionally run only when totalValue changes meaningfully

  // Chart data — deduplicate by date label, keep last entry per day
  const chartData = useMemo(() => {
    const byDate = new Map();
    for (const s of history) byDate.set(s.date, s);
    return [...byDate.values()].slice(-30).map(s => ({ date: s.date, value: s.value }));
  }, [history]);

  function addItem(e) {
    e.preventDefault();
    if (!form.name || !form.qty) return;
    const next = [...items, {
      id: Date.now(),
      name: form.name.trim(),
      itemId: form.itemId.trim().toUpperCase(),
      qty: Number(form.qty),
      avgCost: Number(form.avgCost || 0),
      manualPrice: Number(form.manualPrice || 0),
    }];
    setItems(next); savePortfolio(next);
    setForm({ name: '', itemId: '', qty: 1, avgCost: '', manualPrice: '' });
  }

  function removeItem(id) {
    const next = items.filter(i => i.id !== id);
    setItems(next); savePortfolio(next);
  }

  function exportCsv() {
    const header = 'name,itemId,qty,avgCost,manualPrice';
    const rows   = items.map(i => [i.name, i.itemId, i.qty, i.avgCost || 0, i.manualPrice || 0].join(','));
    const blob   = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement('a');
    a.href = url; a.download = 'skyhelper-portfolio.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  function importCsv(file) {
    setImportError('');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const lines  = String(reader.result).split(/\r?\n/).filter(Boolean);
        const [, ...rows] = lines;
        const parsed = rows.map((line, idx) => {
          const [name, itemId, qty, avgCost, manualPrice] = line.split(',');
          if (!name) throw new Error(`Missing name on row ${idx + 2}`);
          return { id: Date.now() + idx, name: name.trim(), itemId: (itemId || '').trim().toUpperCase(), qty: Number(qty || 0), avgCost: Number(avgCost || 0), manualPrice: Number(manualPrice || 0) };
        });
        const next = [...items, ...parsed.filter(p => p.qty > 0)];
        setItems(next); savePortfolio(next);
      } catch (e) { setImportError(e.message || 'Failed to import CSV.'); }
    };
    reader.readAsText(file);
  }

  return (
    <div className="page">
      <PageHeader
        icon={Layers}
        title="Portfolio"
        description="Track holdings, live values, P&L, and net worth history."
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary btn-sm" onClick={exportCsv}><Download size={13} /> Export CSV</button>
            <label className="btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
              <Upload size={13} /> Import CSV
              <input type="file" accept=".csv" style={{ display: 'none' }}
                onChange={e => e.target.files?.[0] && importCsv(e.target.files[0])} />
            </label>
          </div>
        }
      />

      {/* Sign-in prompt */}
      {!user && (
        <div className="info-box" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Cloud size={15} style={{ color: 'var(--blue)', flexShrink: 0 }} />
            <span><strong>Sign in</strong> to sync your portfolio and history across devices.</span>
          </div>
          <button className="btn-primary btn-sm" onClick={openAuth} style={{ flexShrink: 0 }}>Sign in</button>
        </div>
      )}

      {importError && <div className="error-box">{importError}</div>}

      {/* Summary tiles */}
      <div className="dash-tiles">
        <div className="stat-tile stat-tile--gold">
          <div className="stat-tile__header"><span className="stat-tile__label">Total Value</span></div>
          <div className="stat-tile__value">{formatCoins(totalValue)}</div>
          <div className="stat-tile__sub">live estimate</div>
        </div>
        <div className={`stat-tile ${totalProfit >= 0 ? 'stat-tile--green' : 'stat-tile--orange'}`}>
          <div className="stat-tile__header"><span className="stat-tile__label">Total P/L</span></div>
          <div className="stat-tile__value">{totalProfit >= 0 ? '+' : ''}{formatCoins(totalProfit)}</div>
          <div className="stat-tile__sub">vs average cost</div>
        </div>
        {chartData.length >= 2 && (() => {
          const oldest = chartData[0].value;
          const newest = chartData[chartData.length - 1].value;
          const change = newest - oldest;
          return (
            <div className={`stat-tile ${change >= 0 ? 'stat-tile--green' : 'stat-tile--orange'}`}>
              <div className="stat-tile__header"><span className="stat-tile__label">30-Day Change</span></div>
              <div className="stat-tile__value">{change >= 0 ? '+' : ''}{formatCoins(change)}</div>
              <div className="stat-tile__sub">{((change / oldest) * 100).toFixed(1)}% over {chartData.length} snapshots</div>
            </div>
          );
        })()}
      </div>

      {/* History chart */}
      {chartData.length >= 2 && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card__title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={13} /> Net Worth History
            </div>
            <button
              className="btn-ghost btn-sm"
              onClick={() => setShowHistory(s => !s)}
              style={{ fontSize: 11 }}
            >
              {showHistory ? 'Hide' : 'Show'} snapshots
            </button>
          </div>
          <div style={{ height: 200, marginTop: 12 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} />
                <YAxis tickFormatter={v => formatCoins(v)} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} width={72} />
                <Tooltip content={<HistoryTooltip />} />
                <Line
                  type="monotone" dataKey="value" stroke="var(--gold)" strokeWidth={2.5}
                  dot={{ fill: 'var(--gold)', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: 'var(--gold)', strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Raw snapshot table (toggleable) */}
          {showHistory && (
            <div className="table-wrap" style={{ border: 'none', marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Net Worth</th>
                  </tr>
                </thead>
                <tbody>
                  {[...chartData].reverse().map((s, i) => (
                    <tr key={i}>
                      <td className="text-muted">{s.date}</td>
                      <td style={{ color: 'var(--gold)', fontWeight: 700 }}>{formatCoins(s.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add holding */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card__title">Add Holding</div>
        <form onSubmit={addItem} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ minWidth: 200 }}>
            <label>Display Name</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Hyperion" required />
          </div>
          <div className="field" style={{ minWidth: 180 }}>
            <label>Bazaar Item ID (optional)</label>
            <input type="text" value={form.itemId} onChange={e => setForm(f => ({ ...f, itemId: e.target.value }))} placeholder="e.g. ENCHANTED_DIAMOND" />
          </div>
          <div className="field" style={{ width: 110 }}>
            <label>Quantity</label>
            <input type="number" min="1" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} required />
          </div>
          <div className="field" style={{ width: 130 }}>
            <label>Avg Cost</label>
            <input type="number" value={form.avgCost} onChange={e => setForm(f => ({ ...f, avgCost: e.target.value }))} placeholder="coins" />
          </div>
          <div className="field" style={{ width: 150 }}>
            <label>Manual Price</label>
            <input type="number" value={form.manualPrice || ''} onChange={e => setForm(f => ({ ...f, manualPrice: e.target.value }))} placeholder="coins" />
          </div>
          <button className="btn-primary" type="submit"><Plus size={14} /> Add</button>
        </form>
      </div>

      {/* Holdings table */}
      <div className="card">
        <div className="card__title">Holdings</div>
        {loading && !data && <div className="spinner" />}
        {items.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 20 }}>
            <span className="empty-state-icon">*</span>
            <span>No holdings yet</span>
            <span className="text-muted" style={{ fontSize: 12 }}>Add items to track live value</span>
          </div>
        ) : (
          <div className="table-wrap" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Live Price</th>
                  <th>Avg Cost</th>
                  <th>Total Value</th>
                  <th>P/L</th>
                  <th>Source</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {enriched.map(item => (
                  <tr key={item.id}>
                    <td className="text-bold">
                      {item.name}
                      {item.itemId && <div className="text-muted" style={{ fontSize: 10 }}>{item.itemId}</div>}
                    </td>
                    <td className="text-muted">{item.qty.toLocaleString()}</td>
                    <td>{item.currentPrice ? formatCoins(item.currentPrice) : 'N/A'}</td>
                    <td className="text-muted">{item.avgCost ? formatCoins(item.avgCost) : 'N/A'}</td>
                    <td style={{ fontWeight: 700 }}>{formatCoins(item.totalValue)}</td>
                    <td className={item.profit >= 0 ? 'text-green' : 'text-red'} style={{ fontWeight: 700 }}>
                      {item.profit >= 0 ? '+' : ''}{formatCoins(item.profit)}
                    </td>
                    <td className="text-muted" style={{ textTransform: 'uppercase', fontSize: 11 }}>{item.source}</td>
                    <td>
                      <button className="btn-icon btn-sm btn-danger" onClick={() => removeItem(item.id)}><Trash2 size={12} /></button>
                    </td>
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
