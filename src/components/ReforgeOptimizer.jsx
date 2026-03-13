import { useState, useMemo } from 'react';
import { Hammer, Star, Info } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import { REFORGES, STONE_COSTS, ITEM_TYPES, STAT_GOALS, getBestReforges } from '../data/reforges';
import { formatCoins } from '../utils/api';
import TooltipUI from './ui/Tooltip';

const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export default function ReforgeOptimizer() {
  const [itemType, setItemType]   = useState('armor');
  const [rarity, setRarity]       = useState('legendary');
  const [goal, setGoal]           = useState('crit_damage');
  const [pieces, setPieces]       = useState(4);

  const results = useMemo(() => getBestReforges(itemType, rarity, goal), [itemType, rarity, goal]);
  const best = results[0];
  const stoneCost = best?.stone ? (STONE_COSTS[best.stone] || 0) : 0;
  const totalStoneCost = stoneCost * (itemType === 'armor' ? pieces : 1);

  function renderStats(stats) {
    if (!stats) return null;
    const s = stats[rarity] || stats.legendary || {};
    const items = Object.entries(s).filter(([,v]) => v !== 0);
    if (!items.length) return <span className="text-muted">—</span>;
    return (
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {items.map(([stat, val]) => (
          <span key={stat} className={`tag ${val > 0 ? 'tag-gold' : 'tag-red'}`} style={{ fontSize: 11 }}>
            {val > 0 ? '+' : ''}{val} {STAT_LABELS[stat] || stat}
          </span>
        ))}
      </div>
    );
  }

  const pieceCount = itemType === 'armor' ? pieces : 1;

  return (
    <div className="page">
      <PageHeader
        icon={Hammer}
        title="Reforge Optimizer"
        description="Find the best reforge for your gear and stat goal. All calculations per piece."
      />

      {/* Config */}
      <div className="toolbar">
        <div className="field">
          <label>Item Type</label>
          <div className="btn-group">
            {ITEM_TYPES.map(t => (
              <button key={t.id}
                className={itemType === t.id ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                onClick={() => setItemType(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Rarity</label>
          <div className="btn-group">
            {RARITIES.map(r => (
              <button key={r}
                className={rarity === r ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                onClick={() => setRarity(r)}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Stat Goal</label>
          <select value={goal} onChange={e => setGoal(e.target.value)} style={{ width: 200 }}>
            {STAT_GOALS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
          </select>
        </div>
        {(itemType === 'armor') && (
          <div className="field">
            <label>Armor Pieces — {pieces}</label>
            <input type="range" min={1} max={4} value={pieces}
              onChange={e => setPieces(+e.target.value)} style={{ width: 100 }} />
          </div>
        )}
      </div>

      {/* Best reforge highlight */}
      {best && (
        <div className="card card--glow-gold" style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, marginBottom: 4 }}>
                <Star size={11} style={{ marginRight: 4 }} />Best for {STAT_GOALS.find(g => g.id === goal)?.label}
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--gold)' }}>{best.name}</div>
              {best.stone && (
                <div className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>
                  Requires: <span className="text-bold">{best.stone}</span>
                </div>
              )}
              <div style={{ marginTop: 8 }}>{renderStats(best)}</div>
              {best.note && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  💡 {best.note}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>Score</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: 'var(--gold)', lineHeight: 1 }}>{best.score}</div>
              {totalStoneCost > 0 && (
                <>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Stone cost ({pieceCount}×)</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--red)' }}>{formatCoins(totalStoneCost)}</div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full ranking */}
      <div className="card">
        <div className="card__title">
          Full Reforge Ranking — {ITEM_TYPES.find(t => t.id === itemType)?.label}, {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
          <TooltipUI content="Score = weighted stat sum based on your selected goal. Higher = better for that goal.">
            <Info size={12} style={{ color: 'var(--text-muted)', marginLeft: 4, cursor: 'help' }} />
          </TooltipUI>
        </div>
        <div className="table-wrap" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Reforge</th>
                <th>Stone Required</th>
                <th>Stats ({rarity})</th>
                <th>Score</th>
                <th>Stone Cost ({pieceCount}pc)</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={r.id}>
                  <td className="text-muted">{i + 1}</td>
                  <td>
                    <span className="text-bold">{r.name}</span>
                    {i === 0 && <span className="tag tag-gold" style={{ marginLeft: 6, fontSize: 10 }}>BEST</span>}
                  </td>
                  <td className="text-muted" style={{ fontSize: 12 }}>
                    {r.stone ? (
                      <TooltipUI content={`~${formatCoins(STONE_COSTS[r.stone] || 0)} each`}>
                        <span style={{ textDecoration: 'underline dotted', cursor: 'help' }}>{r.stone}</span>
                      </TooltipUI>
                    ) : <span className="tag tag-green" style={{ fontSize: 10 }}>Free (Anvil)</span>}
                  </td>
                  <td>{renderStats(r)}</td>
                  <td>
                    <span className={i === 0 ? 'text-gold text-bold' : 'text-muted'} style={{ fontSize: i === 0 ? 15 : 13 }}>
                      {r.score}
                    </span>
                  </td>
                  <td className="text-muted">
                    {r.stone && STONE_COSTS[r.stone]
                      ? formatCoins(STONE_COSTS[r.stone] * pieceCount)
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const STAT_LABELS = {
  str: 'STR', critDmg: 'CD', critChance: 'CC', def: 'DEF',
  hp: 'HP', int: 'INT', speed: 'SPD', atkSpeed: 'AS',
};
