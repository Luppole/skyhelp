import { useState, useMemo, useEffect } from 'react';
import { Dice6, Target, Clock, TrendingDown, Zap, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import PageHeader from './ui/PageHeader';

const PRESETS = [
  { id: 'livid_dagger',     name: 'Livid Dagger',               source: 'Catacombs F6',       base: 0.2,   mfScales: true  },
  { id: 'shadow_assassin',  name: 'Shadow Assassin Chestplate', source: 'Catacombs F5',       base: 0.5,   mfScales: true  },
  { id: 'spirit_leap',      name: 'Spirit Leap',                source: 'Catacombs F4',       base: 2.0,   mfScales: true  },
  { id: 'bonzo_staff',      name: "Bonzo's Staff",              source: 'Catacombs F1',       base: 4.0,   mfScales: true  },
  { id: 'necron_handle',    name: "Necron's Handle",            source: 'Catacombs F7 / M3',  base: 0.3,   mfScales: true  },
  { id: 'hyperion',         name: 'Hyperion / Scylla / Valkyrie', source: 'Master Mode F7',   base: 0.05,  mfScales: true  },
  { id: 'judgement_core',   name: 'Judgement Core',             source: 'Master M5',          base: 0.8,   mfScales: true  },
  { id: 'dark_claymore',    name: 'Dark Claymore',              source: 'Catacombs F7',       base: 0.5,   mfScales: true  },
  { id: 'revenant_falchion',name: 'Revenant Falchion',          source: 'Zombie Slayer T5',   base: 1.0,   mfScales: false },
  { id: 'warden_heart',     name: 'Warden Heart',               source: 'Inferno Demon T5',   base: 0.5,   mfScales: true  },
  { id: 'atomsplit_katana', name: 'Atomsplit Katana',           source: 'Enderman Slayer T5', base: 0.3,   mfScales: false },
  { id: 'last_breath',      name: 'Last Breath',                source: 'Spider Slayer T5',   base: 1.5,   mfScales: false },
  { id: 'summoning_eye',    name: 'Summoning Eye',              source: 'Zealot (The End)',   base: 0.238, mfScales: false },
  { id: 'weird_tuba',       name: 'Weird Tuba',                 source: 'Special Zealot',     base: 10.0,  mfScales: false },
  { id: 'superior_frag',    name: 'Superior Dragon Fragment',   source: 'Superior Dragon',    base: 15.0,  mfScales: true  },
  { id: 'custom',           name: '✏️ Custom Item',             source: 'Your item',           base: 1.0,   mfScales: true  },
];

function effectiveChance(basePercent, magicFind, petBonus, mfScales) {
  if (!mfScales) return Math.min(basePercent, 100) / 100;
  const mfMult = 1 + (magicFind + petBonus) / 100;
  return Math.min(basePercent * mfMult, 100) / 100;
}

function killsForProb(p, q) {
  if (p <= 0) return Infinity;
  if (p >= 1) return 1;
  return Math.ceil(Math.log(1 - q) / Math.log(1 - p));
}

function probInKills(p, n) {
  if (p <= 0) return 0;
  return 1 - Math.pow(1 - p, n);
}

function fmt(n) {
  if (!isFinite(n) || n > 1e9) return '∞';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return Math.round(n).toLocaleString();
}

function fmtTime(hours) {
  if (!isFinite(hours) || hours > 1e6) return '∞';
  if (hours >= 24) return `${(hours / 24).toFixed(1)} days`;
  if (hours >= 1) return `${hours.toFixed(1)} hrs`;
  return `${Math.round(hours * 60)} min`;
}

function clamp(val, min, max) {
  return Math.min(Math.max(Number(val) || min, min), max);
}

export default function RNGCalculator() {
  const [presetId, setPresetId]       = useState('warden_heart');
  const [baseChance, setBaseChance]   = useState(0.5);
  const [magicFind, setMagicFind]     = useState(300);
  const [petBonus, setPetBonus]       = useState(0);
  const [killsPerHour, setKph]        = useState(100);
  const [dryKills, setDryKills]       = useState('');

  const preset = PRESETS.find(p => p.id === presetId) || PRESETS[0];

  // Sync base chance when preset changes
  useEffect(() => {
    setBaseChance(preset.base);
  }, [presetId]);

  const { p, expected, milestones, chartData, dryResult } = useMemo(() => {
    const p = effectiveChance(
      clamp(baseChance, 0.001, 100),
      clamp(magicFind, 0, 900),
      clamp(petBonus, 0, 200),
      preset.mfScales,
    );
    const expected = p > 0 ? Math.round(1 / p) : Infinity;

    const milestones = [0.25, 0.50, 0.75, 0.90, 0.95, 0.99].map(q => {
      const kills = killsForProb(p, q);
      return { label: `${Math.round(q * 100)}%`, kills, time: kills / clamp(killsPerHour, 1, 10000) };
    });

    // Chart: 12 data points from 0 to 5× expected
    const maxKills = Math.min(expected * 5, 5_000_000);
    const step     = Math.ceil(maxKills / 12);
    const chartData = Array.from({ length: 12 }, (_, i) => {
      const k = step * (i + 1);
      return { kills: fmt(k), rawKills: k, prob: Math.round(probInKills(p, k) * 1000) / 10 };
    });

    let dryResult = null;
    const dk = parseInt(dryKills);
    if (dk > 0) {
      const probGot = probInKills(p, dk);
      const probDry = 1 - probGot;
      const pct     = Math.round(probDry * 1000) / 10;
      dryResult = { kills: dk, pct, probGot: Math.round(probGot * 1000) / 10 };
    }

    return { p, expected, milestones, chartData, dryResult };
  }, [baseChance, magicFind, petBonus, killsPerHour, dryKills, preset]);

  const dropsPerDay = (p * clamp(killsPerHour, 1, 10000) * 24).toFixed(3);

  function dryMessage(pct) {
    if (pct > 99)  return { text: "Extreme bad luck — you're in the 1%. RNG gods, please 🙏", color: 'var(--red)', bold: true };
    if (pct > 90)  return { text: "You're drier than 90%+ of players. The drop is overdue!", color: 'var(--red)' };
    if (pct > 75)  return { text: "You're drier than most players. Hang in there!", color: '#fb923c' };
    if (pct > 50)  return { text: "A bit unlucky, but not unusual. Keep grinding!", color: 'var(--gold)' };
    return              { text: "You're within the expected range. Keep grinding!", color: 'var(--green)' };
  }

  return (
    <div className="page">
      <PageHeader
        icon={Dice6}
        title="RNG Drop Calculator"
        description="Calculate expected kills, time to drop, and find out how lucky (or unlucky) you really are."
      />

      {/* ── Inputs ─────────────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card__title">⚙️ Settings</div>

        {/* Item selector */}
        <div className="field" style={{ marginBottom: 14 }}>
          <label>Item</label>
          <select value={presetId} onChange={e => setPresetId(e.target.value)} style={{ width: '100%', maxWidth: 360 }}>
            {PRESETS.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
            Source: <strong>{preset.source}</strong>
            {!preset.mfScales && (
              <span style={{ marginLeft: 10, color: '#fb923c' }}>
                <AlertTriangle size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                Magic Find does not affect this drop
              </span>
            )}
          </div>
        </div>

        {/* 4-input grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14 }}>
          <div className="field">
            <label>Base Drop Chance (%)</label>
            <input
              type="number" min="0.001" max="100" step="0.001"
              value={baseChance}
              onChange={e => setBaseChance(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label>Magic Find</label>
            <input
              type="number" min="0" max="900"
              value={magicFind}
              onChange={e => setMagicFind(e.target.value)}
              disabled={!preset.mfScales}
              style={{ width: '100%', opacity: preset.mfScales ? 1 : 0.4 }}
            />
          </div>
          <div className="field">
            <label>Pet MF Bonus</label>
            <input
              type="number" min="0" max="200"
              value={petBonus}
              onChange={e => setPetBonus(e.target.value)}
              disabled={!preset.mfScales}
              style={{ width: '100%', opacity: preset.mfScales ? 1 : 0.4 }}
            />
          </div>
          <div className="field">
            <label>Kills / Hour</label>
            <input
              type="number" min="1" max="10000"
              value={killsPerHour}
              onChange={e => setKph(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </div>

      {/* ── Result tiles ───────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div className="stat-tile stat-tile--gold">
          <div className="stat-tile__header">
            <span className="stat-tile__label">Effective Chance</span>
            <Target size={15} className="stat-tile__icon" />
          </div>
          <div className="stat-tile__value">{(p * 100).toFixed(4)}%</div>
          <div className="stat-tile__sub">after Magic Find</div>
        </div>
        <div className="stat-tile stat-tile--blue">
          <div className="stat-tile__header">
            <span className="stat-tile__label">Expected Kills</span>
            <Dice6 size={15} className="stat-tile__icon" />
          </div>
          <div className="stat-tile__value">{fmt(expected)}</div>
          <div className="stat-tile__sub">median: {fmt(milestones[1].kills)}</div>
        </div>
        <div className="stat-tile stat-tile--purple">
          <div className="stat-tile__header">
            <span className="stat-tile__label">Expected Time</span>
            <Clock size={15} className="stat-tile__icon" />
          </div>
          <div className="stat-tile__value">{fmtTime(expected / clamp(killsPerHour, 1, 10000))}</div>
          <div className="stat-tile__sub">at {clamp(killsPerHour, 1, 10000).toLocaleString()} kills/hr</div>
        </div>
        <div className="stat-tile stat-tile--green">
          <div className="stat-tile__header">
            <span className="stat-tile__label">Expected Drops/Day</span>
            <Zap size={15} className="stat-tile__icon" />
          </div>
          <div className="stat-tile__value">{dropsPerDay}</div>
          <div className="stat-tile__sub">drops per day</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Milestone table */}
        <div className="card">
          <div className="card__title">📊 Kill Count Milestones</div>
          <div className="table-wrap" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Probability</th>
                  <th style={{ textAlign: 'right' }}>Kills Needed</th>
                  <th style={{ textAlign: 'right' }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {milestones.map(m => (
                  <tr key={m.label} style={{ background: m.label === '50%' ? 'rgba(251,191,36,0.06)' : undefined }}>
                    <td>
                      <span style={{ fontWeight: m.label === '50%' ? 700 : 400, color: m.label === '50%' ? 'var(--gold)' : undefined }}>
                        {m.label === '50%' ? '50% (median)' : m.label}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(m.kills)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: 12 }}>
                      {fmtTime(m.time)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dry streak checker */}
        <div className="card">
          <div className="card__title">🧊 How Dry Are You?</div>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Kills without a drop</label>
            <input
              type="number" min="0" placeholder="e.g. 500"
              value={dryKills}
              onChange={e => setDryKills(e.target.value)}
              style={{ width: '100%', maxWidth: 220 }}
            />
          </div>
          {dryResult && (() => {
            const msg = dryMessage(dryResult.pct);
            return (
              <div style={{
                background: 'var(--bg-3)', borderRadius: 8, padding: 16,
                border: `1px solid ${msg.color}40`,
              }}>
                <div style={{ marginBottom: 8, fontSize: 13 }}>
                  You've gone <strong>{dryResult.kills.toLocaleString()}</strong> kills without a drop.
                </div>
                <div style={{ marginBottom: 10, fontSize: 13 }}>
                  Only <strong style={{ color: 'var(--gold)' }}>{dryResult.probGot}%</strong> of players got it by now.
                  You're drier than <strong style={{ color: msg.color }}>{dryResult.pct}%</strong> of players.
                </div>
                <div style={{
                  padding: '8px 12px', borderRadius: 6, background: `${msg.color}18`,
                  color: msg.color, fontWeight: msg.bold ? 700 : 500, fontSize: 13,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  {dryResult.pct > 75 && <AlertTriangle size={14} />}
                  {msg.text}
                </div>
                {/* Progress bar showing percentile */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                    <span>Lucky</span><span>Dry streak</span>
                  </div>
                  <div className="progress-bar progress-bar--thick">
                    <div className="progress-fill" style={{ width: `${Math.min(dryResult.pct, 100)}%`, background: msg.color }} />
                  </div>
                </div>
              </div>
            );
          })()}
          {!dryResult && (
            <div className="text-muted" style={{ fontSize: 13, paddingTop: 8 }}>
              Enter your kill count above to see how unlucky you are.
            </div>
          )}
        </div>
      </div>

      {/* Probability chart */}
      <div className="card">
        <div className="card__title">📈 Cumulative Drop Probability</div>
        <div className="text-muted" style={{ fontSize: 12, marginBottom: 14 }}>
          Probability of getting at least one drop after each kill count.
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <XAxis dataKey="kills" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <Tooltip
              formatter={(v) => [`${v}%`, 'Probability']}
              contentStyle={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6 }}
            />
            <ReferenceLine y={50} stroke="var(--gold)" strokeDasharray="4 2" label={{ value: '50%', fill: 'var(--gold)', fontSize: 11 }} />
            <Bar dataKey="prob" fill="#fbbf24" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
