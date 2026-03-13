import { useState, useEffect, useCallback } from 'react';
import { Cpu, RefreshCw } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import { MINIONS, FUELS, STORAGES, TIER_DELAYS, MINION_CATEGORIES, calcMinionProfit } from '../data/minions';
import { formatCoins } from '../utils/api';

export default function MinionCalc() {
  const [category, setCategory]   = useState('All');
  const [minionId, setMinionId]   = useState(MINIONS[0].id);
  const [tier, setTier]           = useState(12);
  const [fuelId, setFuelId]       = useState('none');
  const [itemPrice, setItemPrice] = useState('');
  const [autoPrice, setAutoPrice] = useState(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [compareMode, setCompareMode] = useState(false);

  const minion = MINIONS.find(m => m.id === minionId) || MINIONS[0];
  const fuel   = FUELS.find(f => f.id === fuelId) || FUELS[0];
  const filteredMinions = category === 'All' ? MINIONS : MINIONS.filter(m => m.category === category);

  const price = itemPrice !== '' ? Number(itemPrice) : (autoPrice ?? 0);
  const result = price > 0 ? calcMinionProfit(minion, tier, fuel, price) : null;

  // Auto-fetch bazaar price for the minion's output item
  const fetchBazaarPrice = useCallback(async () => {
    if (!minion.bazaarId) return;
    setLoadingPrice(true);
    try {
      const r = await fetch(`/api/bazaar/flips?min_volume=0&min_margin=0&limit=500`);
      const data = await r.json();
      const match = data.flips?.find(f => f.item_id === minion.bazaarId);
      if (match) setAutoPrice(match.sell_price);
    } catch {}
    finally { setLoadingPrice(false); }
  }, [minion.bazaarId]);

  useEffect(() => {
    setItemPrice('');
    setAutoPrice(null);
    fetchBazaarPrice();
  }, [minionId, fetchBazaarPrice]);

  // Build comparison data across all tiers
  const tierComparison = Array.from({ length: 12 }, (_, i) => {
    const t = i + 1;
    const r = price > 0 ? calcMinionProfit(minion, t, fuel, price) : null;
    return { tier: t, delay: TIER_DELAYS[i], ...r };
  });

  // Upgrade ROI
  const currentTierResult = price > 0 ? calcMinionProfit(minion, tier, fuel, price) : null;
  const nextTierResult    = tier < 12 && price > 0 ? calcMinionProfit(minion, tier + 1, fuel, price) : null;
  const dailyGain = nextTierResult && currentTierResult
    ? nextTierResult.netPerDay - currentTierResult.netPerDay : 0;

  return (
    <div className="page">
      <PageHeader
        icon={Cpu}
        title="Minion Profit Calculator"
        description="Calculate coins/hour for any minion with any fuel and storage setup."
        actions={
          <button className="btn-secondary btn-sm" onClick={fetchBazaarPrice} disabled={loadingPrice}>
            <RefreshCw size={13} className={loadingPrice ? 'spin' : ''} /> Refresh Prices
          </button>
        }
      />

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Config panel */}
        <div className="card" style={{ minWidth: 300, flex: '0 0 300px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card__title">Configuration</div>

          <div className="field">
            <label>Category</label>
            <div className="tab-pills" style={{ marginBottom: 0 }}>
              {MINION_CATEGORIES.map(c => (
                <button key={c}
                  className={`tab-pill ${category === c ? 'tab-pill--active' : ''}`}
                  onClick={() => { setCategory(c); setMinionId(filteredMinions[0]?.id ?? MINIONS[0].id); }}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Minion Type</label>
            <select value={minionId} onChange={e => setMinionId(e.target.value)}>
              {filteredMinions.map(m => (
                <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Tier — T{tier}</label>
            <input type="range" min={1} max={12} value={tier}
              onChange={e => setTier(+e.target.value)} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)' }}>
              <span>T1</span><span>T12</span>
            </div>
          </div>

          <div className="field">
            <label>Fuel Type</label>
            <select value={fuelId} onChange={e => setFuelId(e.target.value)}>
              {FUELS.map(f => (
                <option key={f.id} value={f.id}>
                  {f.label} ({f.speedMult}× speed, {f.costPerDay > 0 ? formatCoins(f.costPerDay) + '/day' : 'free'})
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>
              Item Price (coins/ea)
              {autoPrice && itemPrice === '' && (
                <span className="tag tag-blue" style={{ marginLeft: 6, fontSize: 10 }}>Live: {formatCoins(autoPrice)}</span>
              )}
            </label>
            <input type="number" value={itemPrice}
              onChange={e => setItemPrice(e.target.value)}
              placeholder={autoPrice ? `Auto: ${autoPrice.toFixed(1)}` : 'Enter price…'} />
          </div>

          {result && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <StatLine label="Actions/hour"   value={result.actionsPerHour.toLocaleString()} />
              <StatLine label="Items/hour"     value={result.itemsPerHour.toLocaleString()} />
              <StatLine label="Delay/action"   value={`${result.effectiveDelay}s`} />
              <StatLine label="Fuel cost/day"  value={fuel.costPerDay > 0 ? `−${formatCoins(fuel.costPerDay)}` : 'Free'} color={fuel.costPerDay > 0 ? 'var(--red)' : 'var(--green)'} />
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 8 }}>
                <StatLine label="Coins/hour"   value={formatCoins(result.coinsPerHour)} color="var(--gold)" bold />
                <StatLine label="Coins/day"    value={formatCoins(result.coinsPerDay)} color="var(--gold)" bold />
                <StatLine label="Net/day (fuel deducted)" value={formatCoins(result.netPerDay)} color={result.netPerDay > 0 ? 'var(--green)' : 'var(--red)'} bold />
              </div>
            </div>
          )}
        </div>

        {/* Right side */}
        <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Upgrade ROI */}
          {dailyGain > 0 && (
            <div className="card card--glow-gold">
              <div className="card__title">Upgrade to T{tier + 1}</div>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <div>
                  <div className="text-muted" style={{ fontSize: 12 }}>Daily gain</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--green)' }}>+{formatCoins(dailyGain)}</div>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: 12 }}>Monthly gain</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gold)' }}>{formatCoins(dailyGain * 30)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Tier comparison table */}
          {price > 0 && (
            <div className="card">
              <div className="card__title">All Tiers — {minion.name}</div>
              <div className="table-wrap" style={{ border: 'none' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Tier</th>
                      <th>Delay</th>
                      <th>Items/hr</th>
                      <th>Coins/hr</th>
                      <th>Net/day</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tierComparison.map(row => (
                      <tr key={row.tier} style={{ opacity: row.tier === tier ? 1 : 0.65 }}>
                        <td>
                          <span className={row.tier === tier ? 'tag tag-gold' : 'text-muted'}>
                            T{row.tier}
                          </span>
                        </td>
                        <td className="text-muted">{row.delay}s</td>
                        <td>{row.itemsPerHour?.toLocaleString() ?? '—'}</td>
                        <td style={{ color: 'var(--gold)', fontWeight: row.tier === tier ? 700 : 400 }}>
                          {row.coinsPerHour ? formatCoins(row.coinsPerHour) : '—'}
                        </td>
                        <td style={{ color: row.netPerDay > 0 ? 'var(--green)' : 'var(--red)', fontWeight: row.tier === tier ? 700 : 400 }}>
                          {row.netPerDay ? formatCoins(row.netPerDay) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatLine({ label, value, color, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 2 }}>
      <span className="text-muted">{label}</span>
      <span style={{ color: color || 'var(--text)', fontWeight: bold ? 700 : 400 }}>{value}</span>
    </div>
  );
}
