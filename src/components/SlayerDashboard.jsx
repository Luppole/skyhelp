import { useState, useMemo } from 'react';
import { Swords, TrendingUp } from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';
import PageHeader from './ui/PageHeader';
import { SLAYERS, calcSlayerProfit } from '../data/slayers';
import { formatCoins } from '../utils/api';

export default function SlayerDashboard() {
  const [selected, setSelected]   = useState('zombie');
  const [tierIndex, setTierIndex] = useState(3);

  const slayer = SLAYERS.find(s => s.id === selected) || SLAYERS[0];
  const tier   = slayer.tiers[tierIndex] || slayer.tiers[slayer.tiers.length - 1];
  const profit = calcSlayerProfit(slayer, tierIndex);

  // Comparison: best tier for each slayer (coins/hour)
  const slayerComparison = useMemo(() =>
    SLAYERS.map(s => {
      const best = s.tiers.reduce((b, _, i) => {
        const r = calcSlayerProfit(s, i);
        return r && r.coinsPerHour > (b?.coinsPerHour ?? 0) ? { tier: i, ...r } : b;
      }, null);
      return { ...s, best };
    }).sort((a, b) => (b.best?.coinsPerHour ?? 0) - (a.best?.coinsPerHour ?? 0)),
  []);

  // Radar chart data: efficiency scores
  const radarData = SLAYERS.map(s => {
    const best = calcSlayerProfit(s, s.tiers.length - 1);
    return {
      slayer: s.name.split(' ')[0],
      coins: best ? Math.round(best.coinsPerHour / 1000) : 0,
      xp: best ? Math.round(best.xpPerHour / 100) : 0,
      roi: best ? best.roi : 0,
    };
  });

  return (
    <div className="page">
      <PageHeader
        icon={Swords}
        title="Slayer Efficiency Dashboard"
        description="Coins/hour, XP/hour and ROI for every slayer boss at every tier."
      />

      {/* Slayer selector */}
      <div className="btn-group" style={{ flexWrap: 'wrap', marginBottom: 18 }}>
        {SLAYERS.map(s => (
          <button key={s.id}
            className={selected === s.id ? 'btn-primary' : 'btn-secondary'}
            onClick={() => { setSelected(s.id); setTierIndex(Math.min(tierIndex, s.tiers.length - 1)); }}>
            {s.icon} {s.name.split(' ')[0]}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Left: selected slayer detail */}
        <div style={{ flex: '0 0 300px', minWidth: 280, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Slayer card */}
          <div className="card" style={{
            borderColor: slayer.color.replace('var(', '').replace(')', ''),
            background: `linear-gradient(135deg, ${slayer.color}10, var(--bg-2))`,
          }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 36 }}>{slayer.icon}</span>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{slayer.name}</div>
                <div className="text-muted" style={{ fontSize: 12 }}>
                  Tier {tierIndex + 1} of {slayer.tiers.length}
                </div>
              </div>
            </div>

            {/* Tier selector */}
            <div className="btn-group" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
              {slayer.tiers.map((_, i) => (
                <button key={i}
                  className={tierIndex === i ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                  onClick={() => setTierIndex(i)}>
                  T{i + 1}
                </button>
              ))}
            </div>

            {/* Tier stats */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <StatLine label="Boss HP"         value={tier.hp} />
              <StatLine label="XP per kill"     value={tier.xp.toLocaleString()} />
              <StatLine label="Avg kill cost"   value={formatCoins(tier.costCoins)} color="var(--red)" />
              <StatLine label="Avg drop value"  value={formatCoins(tier.avgDropValue)} color="var(--gold)" />
              <StatLine label="Avg kill time"   value={`~${tier.avgTimeSec}s`} />
            </div>

            {profit && (
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Metric label="Profit/run" value={formatCoins(profit.profit)} positive={profit.profit > 0} />
                  <Metric label="Runs/hr"    value={profit.runsPerHour} />
                  <Metric label="Coins/hr"   value={formatCoins(profit.coinsPerHour)} positive={profit.coinsPerHour > 0} large />
                  <Metric label="XP/hr"      value={profit.xpPerHour.toLocaleString()} color="var(--blue)" large />
                </div>
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>ROI</div>
                  <div className={`profit-large profit-large--${profit.roi > 0 ? 'positive' : 'negative'}`} style={{ fontSize: 22 }}>
                    {profit.roi > 0 ? '+' : ''}{profit.roi}%
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Drops */}
          <div className="card">
            <div className="card__title">Notable Drops (T{tierIndex + 1})</div>
            {tier.drops.map((d, i) => (
              <div key={i} style={{ fontSize: 13, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                {i === tier.drops.length - 1
                  ? <span className="text-muted">{d}</span>
                  : <span>{d}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Right: comparison + radar */}
        <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Radar chart */}
          <div className="card">
            <div className="card__title"><TrendingUp size={13} /> Slayer Efficiency Radar (Best Tier)</div>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="slayer" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip
                  formatter={(v, name) => [name === 'coins' ? `${v}K/hr` : name === 'xp' ? `${v * 100}/hr` : `${v}%`, name]}
                  contentStyle={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6 }}
                />
                <Radar name="coins" dataKey="coins" stroke="var(--gold)" fill="var(--gold)" fillOpacity={0.15} strokeWidth={2} />
                <Radar name="xp"    dataKey="xp"    stroke="var(--blue)" fill="var(--blue)" fillOpacity={0.1}  strokeWidth={1.5} />
              </RadarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--gold)' }}>■ Coins (K/hr)</span>
              <span style={{ fontSize: 12, color: 'var(--blue)' }}>■ XP (×100/hr)</span>
            </div>
          </div>

          {/* Comparison table */}
          <div className="card">
            <div className="card__title">Best Tier Comparison</div>
            <div className="table-wrap" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Slayer</th>
                    <th>Best Tier</th>
                    <th>Coins/hr</th>
                    <th>XP/hr</th>
                    <th>ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {slayerComparison.map((s, i) => (
                    <tr key={s.id} style={{ cursor: 'pointer', opacity: s.id === selected ? 1 : 0.75 }}
                      onClick={() => { setSelected(s.id); setTierIndex(s.best?.tier ?? 3); }}>
                      <td className="text-muted">{i + 1}</td>
                      <td>
                        <span style={{ marginRight: 6 }}>{s.icon}</span>
                        <span className={s.id === selected ? 'text-gold text-bold' : 'text-bold'}>
                          {s.name.split(' ')[0]}
                        </span>
                      </td>
                      <td className="text-muted">T{(s.best?.tier ?? 0) + 1}</td>
                      <td style={{ fontWeight: i < 3 ? 700 : 400, color: i === 0 ? 'var(--gold)' : 'var(--text)' }}>
                        {s.best ? formatCoins(s.best.coinsPerHour) : '—'}
                      </td>
                      <td className="text-muted">{s.best ? s.best.xpPerHour.toLocaleString() : '—'}</td>
                      <td>
                        <span className={`tag ${s.best?.roi > 100 ? 'tag-green' : s.best?.roi > 50 ? 'tag-gold' : 'tag-red'}`}>
                          {s.best ? `${s.best.roi}%` : '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatLine({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 2 }}>
      <span className="text-muted">{label}</span>
      <span style={{ color: color || 'var(--text)' }}>{value}</span>
    </div>
  );
}

function Metric({ label, value, positive, color, large }) {
  return (
    <div style={{ background: 'var(--bg-3)', borderRadius: 6, padding: '8px 10px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: large ? 15 : 13, fontWeight: 700, color: color || (positive === true ? 'var(--green)' : positive === false ? 'var(--red)' : 'var(--text)') }}>
        {value}
      </div>
    </div>
  );
}
