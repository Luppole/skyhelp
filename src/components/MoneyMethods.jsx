import { useState, useMemo } from 'react';
import { DollarSign, Filter, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from './ui/PageHeader';

const METHODS = [
  { id: 'zombie_t5',      name: 'Zombie Slayer T5',         category: 'slayer',   coins_hr: 3_000_000,  setup: 50_000_000,    req: 'Combat 24',  notes: 'Rev Falchion grind. Consistent coins.',         link: '/slayer',      diff: 'medium' },
  { id: 'enderman_t5',    name: 'Enderman Slayer T5',       category: 'slayer',   coins_hr: 6_000_000,  setup: 200_000_000,   req: 'Combat 24',  notes: 'Atomsplit Katana + Ender Pearl drops.',         link: '/slayer',      diff: 'hard'   },
  { id: 'blaze_t4',       name: 'Blaze Slayer T4',          category: 'slayer',   coins_hr: 2_500_000,  setup: 30_000_000,    req: 'Combat 18',  notes: 'Warden Heart + loot drops.',                   link: '/slayer',      diff: 'medium' },
  { id: 'spider_t4',      name: 'Spider Slayer T4',         category: 'slayer',   coins_hr: 1_500_000,  setup: 15_000_000,    req: 'Combat 12',  notes: 'Last Breath grind. Good for beginners.',       link: '/slayer',      diff: 'easy'   },
  { id: 'dungeon_f7',     name: 'Catacombs F7',             category: 'dungeon',  coins_hr: 8_000_000,  setup: 300_000_000,   req: 'Cata 20+',   notes: 'Necron Handle + rare drops. Top-tier coins.',  link: '/dungeons',    diff: 'hard'   },
  { id: 'dungeon_m5',     name: 'Master Mode M5',           category: 'dungeon',  coins_hr: 10_000_000, setup: 500_000_000,   req: 'Cata 30+',   notes: 'Judgement Core. Best coins in the game.',      link: '/dungeons',    diff: 'hard'   },
  { id: 'dungeon_m3',     name: 'Master Mode M3',           category: 'dungeon',  coins_hr: 5_000_000,  setup: 200_000_000,   req: 'Cata 27+',   notes: 'Necron Handle grind. M3 fast clear.',          link: '/dungeons',    diff: 'hard'   },
  { id: 'dungeon_f6',     name: 'Catacombs F6',             category: 'dungeon',  coins_hr: 4_000_000,  setup: 100_000_000,   req: 'Cata 14+',   notes: 'Livid Dagger. Mid-game dungeon grind.',        link: '/dungeons',    diff: 'medium' },
  { id: 'sugar_cane',     name: 'Sugar Cane Farm',          category: 'farming',  coins_hr: 5_000_000,  setup: 2_000_000,     req: 'Farming 30', notes: 'Auto-farm. Very consistent passive income.',   link: '/farming',     diff: 'easy'   },
  { id: 'pumpkin_farm',   name: 'Pumpkin / Melon Farm',     category: 'farming',  coins_hr: 4_000_000,  setup: 1_500_000,     req: 'Farming 25', notes: 'Reliable farming method. AFK-friendly.',       link: '/farming',     diff: 'easy'   },
  { id: 'wheat_farm',     name: 'Wheat / Carrot / Potato',  category: 'farming',  coins_hr: 3_000_000,  setup: 1_000_000,     req: 'Farming 20', notes: 'Versatile. Good for skill XP + profit.',       link: '/farming',     diff: 'easy'   },
  { id: 'crystal_hollow', name: 'Crystal Hollows Mining',   category: 'mining',   coins_hr: 4_000_000,  setup: 20_000_000,    req: 'Mining 25',  notes: 'Gemstone mining. Powder + coin income.',       link: null,           diff: 'medium' },
  { id: 'mithril',        name: 'Mithril Mining',           category: 'mining',   coins_hr: 2_000_000,  setup: 5_000_000,     req: 'Mining 15',  notes: 'Dwarven Mines. Powder + mithril sales.',       link: null,           diff: 'easy'   },
  { id: 'glacite',        name: 'Glacite Mining',           category: 'mining',   coins_hr: 3_000_000,  setup: 10_000_000,    req: 'Mining 20',  notes: 'Glacite Powder + ore sales.',                  link: null,           diff: 'easy'   },
  { id: 'bazaar_flip',    name: 'Bazaar Flipping',          category: 'market',   coins_hr: 6_000_000,  setup: 5_000_000,     req: 'None',       notes: 'Buy orders + sell orders. Active monitoring.',  link: '/bazaar',      diff: 'easy'   },
  { id: 'ah_flip',        name: 'AH Flipping',              category: 'market',   coins_hr: 8_000_000,  setup: 10_000_000,    req: 'None',       notes: 'Snipe underpriced AH items. High ceiling.',    link: '/sniper',      diff: 'medium' },
  { id: 'craft_flip',     name: 'Craft & Sell',             category: 'market',   coins_hr: 3_000_000,  setup: 2_000_000,     req: 'None',       notes: 'Craft bazaar items and sell for margin.',      link: '/craft-chain', diff: 'easy'   },
  { id: 'zealot_farm',    name: 'Zealot Farming',           category: 'combat',   coins_hr: 2_000_000,  setup: 5_000_000,     req: 'Combat 18',  notes: 'Summoning Eyes + RNG drops from The End.',     link: null,           diff: 'easy'   },
  { id: 'kuudra',         name: 'Kuudra (T1-T4)',           category: 'combat',   coins_hr: 3_500_000,  setup: 50_000_000,    req: 'None',       notes: 'Crimson Isle boss. Attribute gear drops.',     link: null,           diff: 'medium' },
  { id: 'minion_farm',    name: 'Minion Network',           category: 'other',    coins_hr: 1_000_000,  setup: 30_000_000,    req: 'None',       notes: 'Passive income while offline.',                link: '/minions',     diff: 'easy'   },
];

const CATEGORIES = ['all', 'slayer', 'dungeon', 'farming', 'mining', 'market', 'combat', 'other'];

const CAT_COLORS = {
  slayer: '#f472b6', dungeon: '#bc8cff', farming: '#4ade80',
  mining: '#94a3b8', market: '#38bdf8',  combat:  '#fb923c', other: '#fbbf24',
};

const DIFF_COLORS  = { easy: '#3fb950', medium: '#fbbf24', hard: '#f87171' };
const DIFF_LABELS  = { easy: 'Easy',    medium: 'Medium',  hard: 'Hard'    };

function fmtCoins(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}k`;
  return n.toLocaleString();
}

export default function MoneyMethods() {
  const [category, setCategory] = useState('all');
  const [sortBy, setSortBy]     = useState('coins');
  const [maxSetup, setMaxSetup] = useState(1000);

  const filtered = useMemo(() => {
    let list = METHODS;
    if (category !== 'all') list = list.filter(m => m.category === category);
    list = list.filter(m => m.setup <= maxSetup * 1_000_000);
    if (sortBy === 'coins')  list = [...list].sort((a, b) => b.coins_hr - a.coins_hr);
    if (sortBy === 'setup')  list = [...list].sort((a, b) => a.setup - b.setup);
    if (sortBy === 'name')   list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [category, sortBy, maxSetup]);

  const topMethod = filtered[0];

  return (
    <div className="page">
      <PageHeader
        icon={DollarSign}
        title="Money Methods"
        description="Compare every major SkyBlock money-making method by coins/hr, setup cost, and requirements."
      />

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
          {/* Category pills */}
          <div className="field" style={{ flex: '1 1 auto', minWidth: 200 }}>
            <label>Category</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={category === cat ? 'btn-primary btn-xs' : 'btn-secondary btn-xs'}
                  style={{ textTransform: 'capitalize' }}
                >
                  {cat === 'all' ? 'All' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div className="field" style={{ minWidth: 160 }}>
            <label>Sort by</label>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ width: '100%' }}>
              <option value="coins">Coins / Hour</option>
              <option value="setup">Setup Cost (low → high)</option>
              <option value="name">Name</option>
            </select>
          </div>

          {/* Budget */}
          <div className="field" style={{ minWidth: 200 }}>
            <label>Max Setup Cost: <strong style={{ color: 'var(--gold)' }}>{maxSetup >= 1000 ? 'Any' : `${maxSetup}M`}</strong></label>
            <input
              type="range" min={0} max={1000} step={10}
              value={maxSetup}
              onChange={e => setMaxSetup(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </div>

      {/* Count + best method summary */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <span className="text-muted" style={{ fontSize: 13 }}>
          {filtered.length} method{filtered.length !== 1 ? 's' : ''} found
        </span>
        {topMethod && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Best: <strong style={{ color: 'var(--gold)' }}>{topMethod.name}</strong> at ~{fmtCoins(topMethod.coins_hr)}/hr
          </span>
        )}
      </div>

      {filtered.length === 0 && (
        <div className="info-box">No methods match your filters. Try adjusting the budget or category.</div>
      )}

      {/* Method cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 12 }}>
        {filtered.map(m => (
          <div key={m.id} className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{m.name}</span>
              <span style={{
                background: DIFF_COLORS[m.diff] + '22',
                color: DIFF_COLORS[m.diff],
                border: `1px solid ${DIFF_COLORS[m.diff]}44`,
                padding: '2px 8px', borderRadius: 5, fontSize: 10, fontWeight: 700,
                flexShrink: 0,
              }}>
                {DIFF_LABELS[m.diff]}
              </span>
            </div>

            {/* Category tag */}
            <div>
              <span style={{
                background: (CAT_COLORS[m.category] || '#888') + '22',
                color: CAT_COLORS[m.category] || '#888',
                border: `1px solid ${CAT_COLORS[m.category] || '#888'}44`,
                padding: '2px 8px', borderRadius: 5, fontSize: 10, fontWeight: 700,
                textTransform: 'capitalize',
              }}>
                {m.category}
              </span>
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: 20 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Coins / Hour</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--gold)', lineHeight: 1.2 }}>
                  ~{fmtCoins(m.coins_hr)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Setup Cost</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, marginTop: 4 }}>
                  ~{fmtCoins(m.setup)}
                </div>
              </div>
            </div>

            {/* Req + notes */}
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>Requires: </span>{m.req}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{m.notes}</div>

            {/* Link */}
            {m.link && (
              <Link
                to={m.link}
                style={{
                  marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5,
                  color: 'var(--blue)', fontSize: 12, fontWeight: 600, textDecoration: 'none',
                }}
              >
                <TrendingUp size={12} /> Open {m.category === 'market' ? 'tool' : 'calculator'} →
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
