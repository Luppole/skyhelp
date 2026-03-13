import { useState, useMemo } from 'react';
import { Skull, Clock, Coins } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import { FLOORS, CHEST_COSTS, CHEST_LABELS, calcDungeonProfit } from '../data/dungeons';
import { formatCoins } from '../utils/api';

export default function DungeonProfit() {
  const [selectedFloor, setSelectedFloor] = useState('F7');
  const [chestTier, setChestTier]         = useState(3); // 0=wood 1=iron 2=gold 3=diamond
  const [openChest, setOpenChest]         = useState(true);
  const [runTime, setRunTime]             = useState(null); // override run time in minutes

  const floor = FLOORS.find(f => f.id === selectedFloor) || FLOORS[6];
  const avgTimeSec = runTime ? runTime * 60 : floor.avgTimeSec;
  const runsPerHour = Math.round(3600 / avgTimeSec * 10) / 10;

  const result = useMemo(() =>
    calcDungeonProfit({ floor, chestTier, runsPerHour, openChest }),
  [floor, chestTier, runsPerHour, openChest]);

  // Full floor comparison
  const comparison = useMemo(() =>
    FLOORS.map(f => {
      const rph = Math.round(3600 / f.avgTimeSec * 10) / 10;
      const r = calcDungeonProfit({ floor: f, chestTier, runsPerHour: rph, openChest });
      return { ...f, ...r };
    }).sort((a, b) => b.coinsPerHour - a.coinsPerHour),
  [chestTier, openChest]);

  const normalFloors = FLOORS.filter(f => f.mode === 'normal');
  const masterFloors = FLOORS.filter(f => f.mode === 'master');

  return (
    <div className="page">
      <PageHeader
        icon={Skull}
        title="Dungeon Profit Analyzer"
        description="Coins/hour for every dungeon floor. Based on average drop values — your results may vary."
      />

      {/* Floor selector tabs */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 6 }}>Normal Mode</div>
        <div className="btn-group" style={{ flexWrap: 'wrap', marginBottom: 10 }}>
          {normalFloors.map(f => (
            <button key={f.id}
              className={selectedFloor === f.id ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              onClick={() => { setSelectedFloor(f.id); setRunTime(null); }}>
              {f.id}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 6 }}>Master Mode</div>
        <div className="btn-group" style={{ flexWrap: 'wrap' }}>
          {masterFloors.map(f => (
            <button key={f.id}
              className={selectedFloor === f.id ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              onClick={() => { setSelectedFloor(f.id); setRunTime(null); }}>
              {f.id}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Config */}
        <div className="card" style={{ minWidth: 280, flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card__title">Floor: {floor.name}</div>

          <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-3)', borderRadius: 6, padding: '8px 12px' }}>
            💡 {floor.noteworthy}
          </div>

          <label className="checkbox-label">
            <input type="checkbox" checked={openChest} onChange={e => setOpenChest(e.target.checked)} />
            Open chest after run
          </label>

          {openChest && (
            <div className="field">
              <label>Chest Tier</label>
              <div className="btn-group" style={{ flexWrap: 'wrap' }}>
                {CHEST_LABELS.map((label, i) => (
                  <button key={i}
                    className={chestTier === i ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                    onClick={() => setChestTier(i)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="field">
            <label>Your Run Time (min) — or leave blank for avg</label>
            <input type="number" value={runTime ?? ''} min={1}
              onChange={e => setRunTime(e.target.value ? +e.target.value : null)}
              placeholder={`Default: ${Math.round(floor.avgTimeSec / 60)} min`} />
          </div>

          {/* Result stats */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <StatLine label="Avg drop value/run"  value={formatCoins(result.grossPerRun)} />
            {openChest && <StatLine label="Chest cost"        value={`−${formatCoins(result.chestCost)}`} color={result.chestCost > 0 ? 'var(--red)' : 'var(--text-muted)'} />}
            <StatLine label="Net per run"          value={formatCoins(result.netPerRun)} color="var(--gold)" bold />
            <StatLine label="Runs per hour"        value={`×${result.runsPerHour}`} />
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 8 }}>
              <StatLine label="Coins / hour"       value={formatCoins(result.coinsPerHour)} color="var(--green)" bold />
              <StatLine label="Coins / day (8h)"   value={formatCoins(result.coinsPerHour * 8)} color="var(--green)" bold />
            </div>
          </div>
        </div>

        {/* Comparison table */}
        <div style={{ flex: 1, minWidth: 300 }}>
          <div className="card">
            <div className="card__title">All Floors Ranked by Coins/Hour</div>
            <div className="table-wrap" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Floor</th>
                    <th>Mode</th>
                    <th>Avg Drops</th>
                    <th>Runs/hr</th>
                    <th>Coins/hr</th>
                    <th>Cata Req</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((f, i) => (
                    <tr key={f.id}
                      style={{ opacity: f.id === selectedFloor ? 1 : 0.7, cursor: 'pointer' }}
                      onClick={() => { setSelectedFloor(f.id); setRunTime(null); }}>
                      <td className="text-muted">{i + 1}</td>
                      <td>
                        <span className={f.id === selectedFloor ? 'text-gold text-bold' : 'text-bold'}>{f.id}</span>
                      </td>
                      <td>
                        <span className={`tag ${f.mode === 'master' ? 'tag-purple' : 'tag-blue'}`} style={{ fontSize: 10 }}>
                          {f.mode === 'master' ? 'MM' : 'NM'}
                        </span>
                      </td>
                      <td className="text-muted">{formatCoins(f.avgDropValue)}</td>
                      <td className="text-muted">{f.runsPerHour}</td>
                      <td>
                        <span className={`${i === 0 ? 'text-gold' : ''}`} style={{ fontWeight: i < 3 ? 700 : 400 }}>
                          {formatCoins(f.coinsPerHour)}
                        </span>
                      </td>
                      <td className="text-muted">{f.cataReq > 0 ? `C${f.cataReq}` : '—'}</td>
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

function StatLine({ label, value, color, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 2 }}>
      <span className="text-muted">{label}</span>
      <span style={{ color: color || 'var(--text)', fontWeight: bold ? 700 : 400 }}>{value}</span>
    </div>
  );
}
