import { useCallback } from 'react';
import { Vote, Zap, Calendar } from 'lucide-react';
import { useFetch } from '../hooks/useFetch';
import PageHeader from './ui/PageHeader';
import { fetchMayor } from '../utils/api';

export default function MayorTracker() {
  const fetcher = useCallback((options = {}) => fetchMayor(options), []);
  const { data, loading, error } = useFetch(fetcher, [], { refreshInterval: 120_000 });

  const mayor    = data?.mayor;
  const election = data?.election;
  const events   = data?.events ?? [];

  return (
    <div className="page">
      <PageHeader
        icon={Vote}
        title="Mayor & Events"
        description="Current SkyBlock mayor, active perks, election candidates, and seasonal events."
      />

      {error && <div className="error-box">{error}</div>}

      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 160 }} />)}
        </div>
      )}

      {data && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
            {/* Current Mayor */}
            <div className="mayor-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: 4 }}>
                    Current Mayor — Year {mayor?.year}
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 900, color: 'var(--gold)', lineHeight: 1 }}>
                    {mayor?.name}
                  </div>
                </div>
                <span style={{ fontSize: 40 }}>👑</span>
              </div>

              {mayor?.minister && (
                <div style={{ marginBottom: 12 }}>
                  <span className="tag tag-blue">Minister: {mayor.minister.name} — {mayor.minister.perk}</span>
                </div>
              )}

              {/* Strategy tip */}
              {mayor?.tip && (
                <div style={{
                  background: 'rgba(245,197,24,0.08)', border: '1px solid rgba(245,197,24,0.2)',
                  borderRadius: 6, padding: '10px 14px', marginBottom: 14,
                  fontSize: 13, color: 'var(--text)',
                }}>
                  <Zap size={13} style={{ color: 'var(--gold)', marginRight: 6 }} />
                  {mayor.tip}
                </div>
              )}

              {/* Perks */}
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 8 }}>
                Active Perks
              </div>
              {(mayor?.perks ?? []).map((perk, i) => (
                <div key={i} className="mayor-perk">
                  <div className="mayor-perk__name">{perk.name}</div>
                  <div className="mayor-perk__desc">{perk.description}</div>
                </div>
              ))}
            </div>

            {/* Election candidates */}
            <div className="card">
              <div className="card__title">
                <Vote size={13} /> Election Year {election?.year} — Candidates
              </div>
              {(election?.candidates ?? []).map((c, i) => (
                <div key={c.name} className="candidate-row">
                  <div className="candidate-row__header">
                    <span className={`candidate-row__name ${i === 0 ? 'text-gold' : ''}`}>
                      {i === 0 && '👑 '}{c.name}
                    </span>
                    <span className="candidate-row__pct">
                      {c.vote_pct}% ({(c.votes / 1000).toFixed(0)}K)
                    </span>
                  </div>
                  <div className="vote-bar">
                    <div className={`vote-fill ${i === 0 ? 'vote-fill--lead' : ''}`}
                      style={{ width: `${c.vote_pct}%` }} />
                  </div>
                  {c.perks?.length > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      {c.perks.map(p => p.name).join(' · ')}
                    </div>
                  )}
                </div>
              ))}
              {(!election?.candidates || election.candidates.length === 0) && (
                <div className="text-muted" style={{ fontSize: 13 }}>Election data not available yet.</div>
              )}
            </div>
          </div>

          {/* Events calendar */}
          <div className="card">
            <div className="card__title">
              <Calendar size={13} /> Recurring SkyBlock Events
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
              {events.map((ev, i) => (
                <div key={i} style={{
                  background: 'var(--bg-3)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '12px 14px',
                  transition: 'border-color 0.15s, transform 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-bright)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = ''; }}
                >
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{ev.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{ev.name}</div>
                  <div className="text-muted" style={{ fontSize: 12 }}>{ev.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* What to do NOW */}
          <div className="card card--glow-gold">
            <div className="card__title"><Zap size={13} /> What To Do RIGHT NOW</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              {getMayorTasks(mayor?.name).map((task, i) => (
                <div key={i} style={{
                  background: 'rgba(245,197,24,0.06)', border: '1px solid rgba(245,197,24,0.15)',
                  borderRadius: 8, padding: '12px 14px',
                }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{task.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--gold)', marginBottom: 3 }}>{task.title}</div>
                  <div className="text-muted" style={{ fontSize: 12 }}>{task.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getMayorTasks(mayorName) {
  const tasks = {
    Diana: [
      { icon: '🦁', title: 'Hunt Mythological Creatures', desc: 'Use Rod of Mythological Ritual in the Hub. High chance for Griffin pet.' },
      { icon: '⚗️', title: 'Sell Inquisitor Drops', desc: 'Inquisitors drop Midas, SA upgrades — prices spike during Diana.' },
      { icon: '💰', title: 'Buy Cheap Perle Items', desc: 'Buy items that tank in price before Diana ends.' },
    ],
    Derpy: [
      { icon: '📚', title: 'Grind ALL Skills', desc: 'Skills give 3x XP during Derpy. Best time of the year!' },
      { icon: '🏃', title: 'Prioritize Slowest Skills', desc: 'Focus Carpentry, Runecrafting, Alchemy first.' },
      { icon: '🎁', title: 'Save XP Potions', desc: 'Stack with 3x for up to 4.5x XP (Derpy × Potion).' },
    ],
    Technoblade: [
      { icon: '🧟', title: 'Grind All Slayers', desc: '+20% slayer XP this month. Push T4s for max XP.' },
      { icon: '💎', title: 'Farm Slayer Drops', desc: 'More kills = more rare drops. Stock up on Overflux, Talisman.' },
    ],
    Paul: [
      { icon: '⚔️', title: 'Grind Combat XP', desc: '+35% Combat XP. Push Combat 50+ in dungeons.' },
      { icon: '🏰', title: 'Dungeon Spam', desc: 'Dungeons count for Paul bonus. Run F7/M6 for max value.' },
    ],
    Cole: [
      { icon: '⛏️', title: 'Grind Mining XP', desc: '+20% Mining XP. Best time to push for Gemstone Mining.' },
      { icon: '💎', title: 'Farm Mithril/Gemstone', desc: 'Higher mining XP = faster powder gains in Crystal Hollows.' },
    ],
    Marina: [
      { icon: '🎣', title: 'Grind Fishing XP', desc: '+20% Fishing XP. Best time to push Trophy Fishing.' },
      { icon: '🐟', title: 'Sea Creature Hunting', desc: 'More fishing = more sea creatures = better drops.' },
    ],
  };
  return tasks[mayorName] || [
    { icon: '💹', title: 'Watch Bazaar Flips', desc: 'No special mayor bonuses — focus on passive income.' },
    { icon: '🏛️', title: 'Dungeons Grind', desc: 'Always good. Push Catacombs level for better drops.' },
    { icon: '🌾', title: 'Farm Skill XP', desc: 'Keep grinding skills toward your target average.' },
  ];
}
