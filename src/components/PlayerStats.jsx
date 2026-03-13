import { useState } from 'react';
import { User, RefreshCw } from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip,
} from 'recharts';
import { SkeletonCard } from './ui/Skeleton';
import PageHeader from './ui/PageHeader';
import { fetchPlayer, fetchProfileStats, formatCoins } from '../utils/api';
import { useUserData } from '../hooks/useUserData';

const SKILL_ICONS = {
  farming: '🌾', mining: '⛏️', combat: '⚔️', foraging: '🌲', fishing: '🎣',
  enchanting: '✨', alchemy: '⚗️', carpentry: '🪚', runecrafting: '🔮', social: '🤝',
};
const SLAYER_ICONS = {
  zombie: '🧟', spider: '🕷️', wolf: '🐺', enderman: '👾', blaze: '🔥', vampire: '🧛',
};
// Only the 7 "main" skills for the radar (exclude social/runecrafting/carpentry)
const RADAR_SKILLS = ['farming', 'mining', 'combat', 'foraging', 'fishing', 'enchanting', 'alchemy'];

export default function PlayerStats() {
  const [username, setUsername]         = useUserData('player_username', '');
  const [data, setData]                 = useState(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [selectedProfile, setSelected]  = useState(null);
  const [profileStats, setProfileStats] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  async function lookup() {
    if (!username.trim()) return;
    setLoading(true); setError(''); setData(null); setProfileStats(null);
    try {
      const result = await fetchPlayer(username.trim());
      setData(result);
      setProfileStats(result.active_profile?.stats ?? null);
      setSelected(result.active_profile?.profile_id ?? null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function switchProfile(profileId) {
    setSelected(profileId); setProfileLoading(true);
    try {
      const result = await fetchProfileStats(username, profileId);
      if (result.error) {
        setError(result.error);
        setProfileStats(null);
      } else {
        setProfileStats(result.stats);
      }
    } catch (e) { setError(e.message); }
    finally { setProfileLoading(false); }
  }

  const stats = profileStats;
  const radarData = stats ? RADAR_SKILLS.map(skill => ({
    skill: skill.charAt(0).toUpperCase() + skill.slice(1),
    level: stats.skills?.[skill]?.level ?? 0,
    fullMark: Math.max(60, ...RADAR_SKILLS.map(s => stats.skills?.[s]?.level ?? 0)),
  })) : [];

  return (
    <div className="page">
      <PageHeader icon={User} title="Player Stats"
        description="Look up skills, slayers, dungeons, and collections for any player." />

      <div className="toolbar">
        <div className="field">
          <label>Minecraft Username</label>
          <input type="text" placeholder="e.g. Technoblade" value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && lookup()}
            style={{ width: 220 }} />
        </div>
        <button className="btn-primary" onClick={lookup} disabled={loading || !username}>
          {loading ? <><RefreshCw size={14} className="spin" /> Looking up…</> : 'Lookup'}
        </button>
      </div>

      {error && <div className="error-box">{error}</div>}
      {loading && <div className="stat-grid">{[4,6,4,4].map((r,i)=><SkeletonCard key={i} rows={r}/>)}</div>}

      {data && !loading && (
        <div className="player-layout">
          {/* Profile selector */}
          {data.profiles?.length > 0 && (
            <div className="card">
              <div className="card__title">Profiles</div>
              <div className="btn-group" style={{ flexWrap: 'wrap' }}>
                {data.profiles.map(p => (
                  <button key={p.profile_id}
                    className={selectedProfile === p.profile_id ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                    onClick={() => switchProfile(p.profile_id)} disabled={profileLoading}>
                    {p.cute_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {profileLoading && <div className="stat-grid">{[4,6,4,4].map((r,i)=><SkeletonCard key={i} rows={r}/>)}</div>}

          {stats && !profileLoading && (
            <div className="stat-grid">
              {/* Overview */}
              <div className="card">
                <div className="card__title">Overview</div>
                <StatRow label="Skill Average" value={stats.skill_average} gold />
                <StatRow label="Purse"         value={`${formatCoins(stats.purse)} coins`} />
                <StatRow label="Fairy Souls"   value={`${stats.fairy_souls} collected`} />
                <StatRow label="Deaths"        value={stats.deaths?.toLocaleString()} />
              </div>

              {/* Radar chart — spans full width */}
              <div className="card" style={{ gridColumn: '1 / -1' }}>
                <div className="card__title">Skill Radar</div>
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                    <PolarGrid stroke="var(--border)" />
                    <PolarAngleAxis dataKey="skill" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                    <Tooltip
                      formatter={(v) => [v, 'Level']}
                      contentStyle={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6 }}
                    />
                    <Radar name="Level" dataKey="level"
                      stroke="var(--gold)" fill="var(--gold)" fillOpacity={0.18} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Skills */}
              <div className="card">
                <div className="card__title">Skills</div>
                {Object.entries(stats.skills ?? {}).map(([skill, s]) => (
                  <div key={skill} className="skill-row">
                    <div className="skill-row__header">
                      <span>{SKILL_ICONS[skill] ?? '•'} {skill.charAt(0).toUpperCase() + skill.slice(1)}</span>
                      <span className="skill-row__level">Lvl {s.level}</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${s.progress}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Slayers */}
              <div className="card">
                <div className="card__title">Slayers</div>
                {Object.entries(stats.slayers ?? {}).map(([name, s]) => (
                  <StatRow key={name}
                    label={`${SLAYER_ICONS[name] ?? ''} ${name.charAt(0).toUpperCase() + name.slice(1)}`}
                    value={`Lvl ${s.level} · ${s.xp.toLocaleString()} XP`} />
                ))}
              </div>

              {/* Dungeons */}
              {stats.catacombs && (
                <div className="card">
                  <div className="card__title">Dungeons</div>
                  <StatRow label="Catacombs" value={`Lvl ${stats.catacombs.level}`} gold />
                  <div className="progress-bar" style={{ margin: '6px 0 12px' }}>
                    <div className="progress-fill" style={{ width: `${stats.catacombs.progress}%` }} />
                  </div>
                  {Object.entries(stats.catacombs.classes ?? {}).map(([cls, c]) => (
                    <StatRow key={cls}
                      label={cls.charAt(0).toUpperCase() + cls.slice(1)}
                      value={`Lvl ${c.level}`} />
                  ))}
                </div>
              )}

              {/* Collections */}
              {stats.collections?.length > 0 && (
                <div className="card">
                  <div className="card__title">Top Collections</div>
                  {stats.collections.map(c => (
                    <StatRow key={c.id} label={c.name} value={c.count.toLocaleString()} />
                  ))}
                </div>
              )}
            </div>
          )}

          {!stats && !profileLoading && (
            <div className="info-box">
              Profile stats are unavailable for this profile. Try another profile or refresh.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value, gold }) {
  return (
    <div className="stat-row">
      <span className="stat-row__label">{label}</span>
      <span className={gold ? 'stat-row__value--gold' : 'stat-row__value'}>{value}</span>
    </div>
  );
}
