import { useState, useMemo } from 'react';
import { BookOpen, Target, TrendingUp } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import { SKILL_XP_TABLE, SKILL_NAMES, xpToLevel } from '../utils/skyblock';
import { formatCoins } from '../utils/api';
import { useUserData } from '../hooks/useUserData';

const SKILL_ICONS = {
  farming: '🌾', mining: '⛏️', combat: '⚔️', foraging: '🌲', fishing: '🎣',
  enchanting: '✨', alchemy: '⚗️', carpentry: '🪚', runecrafting: '🔮', social: '🤝',
};

const MAX_LEVEL = 60;

// XP sources with approx XP/hour rates
const XP_SOURCES = {
  farming: [
    { name: 'Pumpkin / Melon w/ Replenish', xpPerHour: 500_000 },
    { name: 'Sugar Cane w/ Fortune', xpPerHour: 350_000 },
    { name: 'Mushroom Farm', xpPerHour: 280_000 },
    { name: 'Wheat / Carrot (manual)', xpPerHour: 150_000 },
  ],
  mining: [
    { name: 'Mithril (Dwarven Mines)', xpPerHour: 200_000 },
    { name: 'Ruby Gemstone', xpPerHour: 350_000 },
    { name: 'Powder Mining (powder boost)', xpPerHour: 180_000 },
    { name: 'Regular Cobblestone Minion', xpPerHour: 20_000 },
  ],
  combat: [
    { name: 'Dungeons (F7)', xpPerHour: 600_000 },
    { name: 'Enderman Slayer T4', xpPerHour: 200_000 },
    { name: 'Zealots (The End)', xpPerHour: 250_000 },
    { name: 'Catacombs Grinding (M4)', xpPerHour: 500_000 },
  ],
  foraging: [
    { name: 'Dark Oak w/ Treecapitator', xpPerHour: 300_000 },
    { name: 'Spruce Minion Forest', xpPerHour: 150_000 },
  ],
  fishing: [
    { name: 'Sea Creature Grinding', xpPerHour: 100_000 },
    { name: 'Fishing (AFK)', xpPerHour: 40_000 },
    { name: 'Trophy Fishing (Lava)', xpPerHour: 80_000 },
  ],
  enchanting: [
    { name: 'Enchant + Disenchant Loop', xpPerHour: 250_000 },
    { name: 'Enchanting Table AFK', xpPerHour: 80_000 },
  ],
  alchemy: [
    { name: 'Brewing Speed Potions', xpPerHour: 200_000 },
    { name: 'AFK Brewing', xpPerHour: 50_000 },
  ],
};

// Skill XP booster costs (approximate)
const BOOSTERS = [
  { name: 'Colossal Exp Potion', mult: 1.5, costPerHour: 80_000 },
  { name: 'Exp Share Pet (Lv100)', mult: 1.3, costPerHour: 0 },
  { name: 'Derpy Mayor (active)', mult: 3.0, costPerHour: 0 },
];

const DEFAULT_SKILLS = Object.fromEntries(SKILL_NAMES.slice(0, 7).map(s => [s, { xp: '' }]));

export default function SkillPlanner() {
  const [skills, setSkills] = useUserData('skill_planner_skills', DEFAULT_SKILLS);
  const [targetAvg, setTargetAvg] = useUserData('skill_planner_target', 55);
  const [selectedSource, setSelectedSource] = useState({});
  const [boosterMult, setBoosterMult] = useState(1.0);

  function setSkillXP(skill, value) {
    setSkills(prev => ({ ...(prev ?? DEFAULT_SKILLS), [skill]: { xp: value } }));
  }

  const analysis = useMemo(() => {
    const main = SKILL_NAMES.slice(0, 7);
    const parsed = main.map(skill => {
      const xp = Number(skills[skill]?.xp || 0);
      const info = xpToLevel(xp, SKILL_XP_TABLE);
      return { skill, xp, ...info };
    });

    const currentAvg = parsed.reduce((s, p) => s + p.level, 0) / main.length;

    // XP needed per skill to reach targetAvg
    // We need total levels = targetAvg * count
    // Simplify: distribute target evenly
    const targetLevel = Math.min(targetAvg, MAX_LEVEL);
    const plan = parsed.map(p => {
      const needed = p.level >= targetLevel ? 0 :
        SKILL_XP_TABLE[targetLevel] - p.xp;
      const src = selectedSource[p.skill] ?
        XP_SOURCES[p.skill]?.find(s => s.name === selectedSource[p.skill]) :
        XP_SOURCES[p.skill]?.[0];
      const effectiveRate = src ? (src.xpPerHour * boosterMult) : 50_000;
      const hoursNeeded = needed > 0 ? (needed / effectiveRate) : 0;
      return { ...p, xpNeeded: Math.max(0, needed), hoursNeeded: Math.round(hoursNeeded * 10) / 10, src };
    });

    const totalHours = plan.reduce((s, p) => s + p.hoursNeeded, 0);
    const skills_done = plan.filter(p => p.xpNeeded === 0).length;

    return { parsed, currentAvg: Math.round(currentAvg * 100) / 100, plan, totalHours: Math.round(totalHours * 10) / 10, skills_done };
  }, [skills, targetAvg, selectedSource, boosterMult]);

  return (
    <div className="page">
      <PageHeader
        icon={BookOpen}
        title="Skill Grind Planner"
        description="Calculate XP needed per skill to reach your target skill average."
      />

      {/* Target & boosters */}
      <div className="toolbar">
        <div className="field">
          <label>Target Skill Average — {targetAvg}</label>
          <input type="range" min={30} max={60} value={targetAvg}
            onChange={e => setTargetAvg(+e.target.value)} style={{ width: 200 }} />
        </div>
        <div className="field">
          <label>XP Booster Multiplier</label>
          <select value={boosterMult} onChange={e => setBoosterMult(+e.target.value)} style={{ width: 200 }}>
            <option value={1.0}>No booster (1×)</option>
            {BOOSTERS.map(b => (
              <option key={b.name} value={b.mult}>{b.name} ({b.mult}×)</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginLeft: 'auto' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>Current Average</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--gold)' }}>{analysis.currentAvg}</div>
          </div>
          <div style={{ width: 1, height: 40, background: 'var(--border)' }} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>Est. Hours</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--blue)' }}>{analysis.totalHours}h</div>
          </div>
        </div>
      </div>

      {/* Skills input + plan */}
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Input column */}
        <div className="card" style={{ minWidth: 280, flex: '0 0 280px' }}>
          <div className="card__title">Enter Your XP</div>
          {SKILL_NAMES.slice(0, 7).map(skill => (
            <div key={skill} className="field" style={{ marginBottom: 10 }}>
              <label>{SKILL_ICONS[skill]} {skill.charAt(0).toUpperCase() + skill.slice(1)}</label>
              <input type="number" value={skills[skill]?.xp || ''}
                onChange={e => setSkillXP(skill, e.target.value)}
                placeholder={`e.g. 10000000`} />
            </div>
          ))}
        </div>

        {/* Plan column */}
        <div style={{ flex: 1, minWidth: 300 }}>
          {analysis.plan.map(p => {
            const done = p.xpNeeded === 0;
            const pctToTarget = p.level >= targetAvg ? 100 :
              Math.min(100, (p.xp / (SKILL_XP_TABLE[targetAvg] || 1)) * 100);
            return (
              <div key={p.skill} className={`card ${done ? 'card--glow-green' : ''}`}
                style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{SKILL_ICONS[p.skill]}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        {p.skill.charAt(0).toUpperCase() + p.skill.slice(1)}
                        {done && <span className="tag tag-green" style={{ marginLeft: 6, fontSize: 10 }}>✓ DONE</span>}
                      </div>
                      <div className="text-muted" style={{ fontSize: 12 }}>
                        Level {p.level} → {targetAvg} target
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {!done && (
                      <>
                        <div style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 14 }}>
                          {p.xp > 0 ? `${(p.xpNeeded / 1_000_000).toFixed(2)}M XP` : '—'}
                        </div>
                        <div className="text-muted" style={{ fontSize: 12 }}>~{p.hoursNeeded}h</div>
                      </>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="progress-bar progress-bar--thick" style={{ marginBottom: 8 }}>
                  <div className={`progress-fill ${done ? '' : ''}`}
                    style={{ width: `${pctToTarget}%`, background: done ? 'var(--green)' : undefined }} />
                </div>

                {/* XP source selector */}
                {!done && XP_SOURCES[p.skill] && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                    <label style={{ textTransform: 'none', fontWeight: 400, fontSize: 12, color: 'var(--text-muted)' }}>Source:</label>
                    <select style={{ fontSize: 12, padding: '3px 8px', flex: 1 }}
                      value={selectedSource[p.skill] || XP_SOURCES[p.skill][0].name}
                      onChange={e => setSelectedSource(prev => ({ ...prev, [p.skill]: e.target.value }))}>
                      {XP_SOURCES[p.skill].map(s => (
                        <option key={s.name} value={s.name}>
                          {s.name} ({(s.xpPerHour / 1000).toFixed(0)}K XP/h)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      {analysis.totalHours > 0 && (
        <div className="card card--glow-gold" style={{ marginTop: 18 }}>
          <div className="card__title"><Target size={13} /> Grind Summary</div>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            <div>
              <div className="text-muted" style={{ fontSize: 12 }}>Skills to grind</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--gold)' }}>
                {analysis.plan.length - analysis.skills_done}
              </div>
            </div>
            <div>
              <div className="text-muted" style={{ fontSize: 12 }}>Total hours (est.)</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--blue)' }}>{analysis.totalHours}h</div>
            </div>
            <div>
              <div className="text-muted" style={{ fontSize: 12 }}>Current avg</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>{analysis.currentAvg}</div>
            </div>
            <div>
              <div className="text-muted" style={{ fontSize: 12 }}>Target avg</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--green)' }}>{targetAvg}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
