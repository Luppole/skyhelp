import { useState, useEffect, useCallback, useMemo } from 'react';
import { Sprout, RefreshCw, Save, Cloud, CloudOff, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import { fetchEnchantPrices, formatCoins } from '../utils/api';
import { useFetch } from '../hooks/useFetch';
import DataAge from './ui/DataAge';
import { useSupabaseUser } from '../hooks/useSupabaseUser';
import { useAuthModal } from './AuthProvider';
import { fetchUserData, saveUserData } from '../utils/supabaseStore';

// ── Constants ────────────────────────────────────────────────────────────────

const CROPS = [
  { name: 'Wheat',       key: 'turbo_wheat',     bz: 'TURBO_WHEAT'     },
  { name: 'Carrot',      key: 'turbo_carrot',    bz: 'TURBO_CARROT'    },
  { name: 'Potato',      key: 'turbo_potato',    bz: 'TURBO_POTATO'    },
  { name: 'Pumpkin',     key: 'turbo_pumpkin',   bz: 'TURBO_PUMPKIN'   },
  { name: 'Melon',       key: 'turbo_melon',     bz: 'TURBO_MELON'     },
  { name: 'Mushroom',    key: 'turbo_mushrooms', bz: 'TURBO_MUSHROOMS' },
  { name: 'Cocoa Beans', key: 'turbo_cocoa',     bz: 'TURBO_COCOA'     },
  { name: 'Sugar Cane',  key: 'turbo_cane',      bz: 'TURBO_CANE'      },
  { name: 'Nether Wart', key: 'turbo_warts',     bz: 'TURBO_WARTS'     },
  { name: 'Cactus',      key: 'turbo_cacti',     bz: 'TURBO_CACTI'     },
];

const GLOBAL_ENCHANTS = [
  { label: 'Dedication',  key: 'dedication',  max: 4,  type: 'fortune' },
  { label: 'Harvesting',  key: 'harvesting',  max: 6,  type: 'fortune' },
  { label: 'Green Thumb', key: 'green_thumb', max: 5,  type: 'fortune' },
  { label: 'Sugar Rush',  key: 'sugar_rush',  max: 3,  type: 'bps'     },
  { label: 'Cultivating', key: 'cultivating', max: 10, type: 'pest'    },
];

const DEDICATION_MULT = [0, 0.5, 0.75, 1.0, 2.0];
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

const DEFAULT_SETUP = {
  farmingLevel: 1,
  milestones:   Object.fromEntries(CROPS.map(c => [c.name, 0])),
  enchants:     Object.fromEntries([
    ...CROPS.map(c => [c.key, 0]),
    ...GLOBAL_ENCHANTS.map(e => [e.key, 0]),
  ]),
};

// ── Calculation (pure JS, no backend) ────────────────────────────────────────

function calcBPC(enchants) {
  return enchants.cultivating ?? 0; // +1% Bonus Pest Chance per level
}

function calcSkillFF(level) {
  return Math.min(level, 50) * 4 + Math.max(0, level - 50) * 1;
}

function calcDedicationFF(level, milestoneTier) {
  return DEDICATION_MULT[level] * milestoneTier;
}

function buildUpgrades(setup, prices) {
  const upgrades = [];
  const enchants  = setup.enchants  ?? {};
  const milestones = setup.milestones ?? {};
  const bestMilestone = Math.max(1, ...Object.values(milestones));

  // 1. Turbo enchants (crop-specific, +5 FF per level)
  for (const crop of CROPS) {
    const current = enchants[crop.key] ?? 0;
    for (let lvl = current + 1; lvl <= 5; lvl++) {
      const bzId = `ENCHANTMENT_${crop.bz}_${lvl}`;
      const cost = prices[bzId] ?? 0;
      if (cost <= 0) continue;
      upgrades.push({
        id: `${crop.key}_${lvl}`,
        name: `Turbo-${crop.name} ${ROMAN[lvl]}`,
        category: 'fortune', crop: crop.name,
        fromLevel: lvl - 1, toLevel: lvl,
        ffGain: 5, bpsGain: 0,
        costCoins: Math.round(cost),
        ffPerMillion: 5 / cost * 1_000_000,
        bzItemId: bzId,
        note: '+5 FF (this crop only)',
      });
    }
  }

  // 2. Dedication (scales with best milestone tier)
  const dedCurrent = enchants.dedication ?? 0;
  for (let lvl = dedCurrent + 1; lvl <= 4; lvl++) {
    const bzId = `ENCHANTMENT_DEDICATION_${lvl}`;
    const cost = prices[bzId] ?? 0;
    if (cost <= 0) continue;
    const ffGain = (DEDICATION_MULT[lvl] - DEDICATION_MULT[lvl - 1]) * bestMilestone;
    upgrades.push({
      id: `dedication_${lvl}`,
      name: `Dedication ${ROMAN[lvl]}`,
      category: 'fortune', crop: null,
      fromLevel: lvl - 1, toLevel: lvl,
      ffGain: Math.round(ffGain * 10) / 10, bpsGain: 0,
      costCoins: Math.round(cost),
      ffPerMillion: ffGain > 0 ? ffGain / cost * 1_000_000 : 0,
      bzItemId: bzId,
      note: `+${ffGain.toFixed(1)} FF (best crop @ milestone tier ${bestMilestone})`,
    });
  }

  // 3. Harvesting (+4 FF per level, I–VI)
  const harvCurrent = enchants.harvesting ?? 0;
  for (let lvl = harvCurrent + 1; lvl <= 6; lvl++) {
    const bzId = `ENCHANTMENT_HARVESTING_${lvl}`;
    const cost = prices[bzId] ?? 0;
    if (cost <= 0) continue;
    upgrades.push({
      id: `harvesting_${lvl}`,
      name: `Harvesting ${ROMAN[lvl]}`,
      category: 'fortune', crop: null,
      fromLevel: lvl - 1, toLevel: lvl,
      ffGain: 4, bpsGain: 0,
      costCoins: Math.round(cost),
      ffPerMillion: 4 / cost * 1_000_000,
      bzItemId: bzId, note: '+4 FF (all crops)',
    });
  }

  // 4. Green Thumb (+5 FF per level, I–V)
  const gtCurrent = enchants.green_thumb ?? 0;
  for (let lvl = gtCurrent + 1; lvl <= 5; lvl++) {
    const bzId = `ENCHANTMENT_GREEN_THUMB_${lvl}`;
    const cost = prices[bzId] ?? 0;
    if (cost <= 0) continue;
    upgrades.push({
      id: `green_thumb_${lvl}`,
      name: `Green Thumb ${ROMAN[lvl]}`,
      category: 'fortune', crop: null,
      fromLevel: lvl - 1, toLevel: lvl,
      ffGain: 5, bpsGain: 0,
      costCoins: Math.round(cost),
      ffPerMillion: 5 / cost * 1_000_000,
      bzItemId: bzId, note: '+5 FF (all crops)',
    });
  }

  // 5. Sugar Rush (BPS, I–III)
  const srCurrent = enchants.sugar_rush ?? 0;
  for (let lvl = srCurrent + 1; lvl <= 3; lvl++) {
    const bzId = `ENCHANTMENT_SUGAR_RUSH_${lvl}`;
    const cost = prices[bzId] ?? 0;
    if (cost <= 0) continue;
    upgrades.push({
      id: `sugar_rush_${lvl}`,
      name: `Sugar Rush ${ROMAN[lvl]}`,
      category: 'bps', crop: null,
      fromLevel: lvl - 1, toLevel: lvl,
      ffGain: 0, bpsGain: 0.1, bpcGain: 0,
      costCoins: Math.round(cost),
      ffPerMillion: 0, bpcPerMillion: 0,
      bzItemId: bzId, note: '~+0.1 BPS (Rancher\'s Boots)',
    });
  }

  // 6. Cultivating (Pest Chance, I–X, +1% BPC per level)
  const cultCurrent = enchants.cultivating ?? 0;
  for (let lvl = cultCurrent + 1; lvl <= 10; lvl++) {
    const bzId = `ENCHANTMENT_CULTIVATING_${lvl}`;
    const cost = prices[bzId] ?? 0;
    if (cost <= 0) continue;
    upgrades.push({
      id: `cultivating_${lvl}`,
      name: `Cultivating ${ROMAN[lvl]}`,
      category: 'pest', crop: null,
      fromLevel: lvl - 1, toLevel: lvl,
      ffGain: 0, bpsGain: 0, bpcGain: 1,
      costCoins: Math.round(cost),
      ffPerMillion: 0,
      bpcPerMillion: 1 / cost * 1_000_000,
      bzItemId: bzId, note: '+1% Bonus Pest Chance',
    });
  }

  const fortune = upgrades.filter(u => u.category === 'fortune')
    .sort((a, b) => b.ffPerMillion - a.ffPerMillion);
  const bps  = upgrades.filter(u => u.category === 'bps');
  const pest = upgrades.filter(u => u.category === 'pest')
    .sort((a, b) => b.bpcPerMillion - a.bpcPerMillion);
  return [...fortune, ...bps, ...pest];
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function ScoreBadge({ ffpm }) {
  const [bg, color] =
    ffpm >= 10 ? ['rgba(251,191,36,0.15)',  'var(--gold)']  :
    ffpm >= 5  ? ['rgba(52,211,153,0.12)',   '#34d399']     :
    ffpm >= 2  ? ['rgba(96,165,250,0.12)',   '#60a5fa']     :
                 ['rgba(100,116,139,0.1)',   'var(--text-muted)'];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: bg, color, whiteSpace: 'nowrap' }}>
      {ffpm.toFixed(1)} FF/M
    </span>
  );
}

function BpcBadge({ bpcpm }) {
  const [bg, color] =
    bpcpm >= 5  ? ['rgba(167,139,250,0.15)', '#a78bfa'] :
    bpcpm >= 2  ? ['rgba(96,165,250,0.12)',  '#60a5fa'] :
                  ['rgba(100,116,139,0.1)',  'var(--text-muted)'];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: bg, color, whiteSpace: 'nowrap' }}>
      {bpcpm.toFixed(2)} %/M
    </span>
  );
}

function LevelSelect({ value, max, onChange }) {
  return (
    <select value={value} onChange={e => onChange(Number(e.target.value))} style={{ fontSize: 12, width: '100%' }}>
      <option value={0}>None</option>
      {Array.from({ length: max }, (_, i) => i + 1).map(lvl => (
        <option key={lvl} value={lvl}>{ROMAN[lvl]}</option>
      ))}
    </select>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FarmingUpgrades() {
  const { user } = useSupabaseUser();
  const { openAuth } = useAuthModal();
  const [setup, setSetup]         = useState(DEFAULT_SETUP);
  const [saved, setSaved]         = useState(true);
  const [syncing, setSyncing]     = useState(false);
  const [tab, setTab]             = useState('fortune');
  const [cropFilter, setCropFilter] = useState('All Crops');
  const [showMilestones, setShowMilestones] = useState(true);
  const [showEnchants, setShowEnchants]   = useState(true);

  // Load saved setup from Supabase on sign-in
  useEffect(() => {
    if (!user) return;
    fetchUserData(user.id, 'farming_setup').then(data => {
      if (data) setSetup({ ...DEFAULT_SETUP, ...data });
    });
  }, [user?.id]);

  // Fetch BZ enchant prices (cached 90s)
  const { data: priceData, loading: pricesLoading, reload, lastFetchedAt } = useFetch(
    useCallback((opts = {}) => fetchEnchantPrices(opts), []),
    [],
    { refreshInterval: 120_000 }
  );
  const prices = priceData?.prices ?? {};

  // Computed upgrades
  const upgrades = useMemo(() => buildUpgrades(setup, prices), [setup, prices]);
  const skillFF   = calcSkillFF(setup.farmingLevel);
  const currentBPC = calcBPC(setup.enchants);

  // Setters
  function setFarmingLevel(v) {
    setSetup(s => ({ ...s, farmingLevel: Math.min(60, Math.max(1, v)) }));
    setSaved(false);
  }
  function setMilestone(crop, v) {
    setSetup(s => ({ ...s, milestones: { ...s.milestones, [crop]: Math.min(46, Math.max(0, v)) } }));
    setSaved(false);
  }
  function setEnchant(key, v) {
    setSetup(s => ({ ...s, enchants: { ...s.enchants, [key]: v } }));
    setSaved(false);
  }

  async function saveSetup() {
    if (!user) { openAuth(); return; }
    setSyncing(true);
    await saveUserData(user.id, 'farming_setup', setup);
    setSyncing(false);
    setSaved(true);
  }

  // Filtered upgrades
  const visible = upgrades.filter(u => {
    if (tab === 'fortune' && u.category !== 'fortune') return false;
    if (tab === 'bps'     && u.category !== 'bps')     return false;
    if (tab === 'pest'    && u.category !== 'pest')     return false;
    if (tab === 'fortune' && cropFilter !== 'All Crops' && u.crop && u.crop !== cropFilter) return false;
    if (tab === 'fortune' && cropFilter !== 'All Crops' && !u.crop) return false;
    return true;
  });

  const fortuneCount = upgrades.filter(u => u.category === 'fortune').length;
  const bpsCount     = upgrades.filter(u => u.category === 'bps').length;
  const pestCount    = upgrades.filter(u => u.category === 'pest').length;
  const totalFF      = upgrades.filter(u => u.category === 'fortune').reduce((s, u) => s + u.ffGain, 0);
  const totalCost    = upgrades.reduce((s, u) => s + u.costCoins, 0);
  const availableBPC = upgrades.filter(u => u.category === 'pest').reduce((s, u) => s + u.bpcGain, 0);

  const bestMilestone = Math.max(1, ...Object.values(setup.milestones));
  const currentDedFF  = calcDedicationFF(setup.enchants.dedication ?? 0, bestMilestone);

  return (
    <div className="page">
      <PageHeader
        icon={Sprout}
        title="Farming Optimizer"
        description="Every Fortune & BPS enchant upgrade ranked by FF per million coins. No Hypixel API — your setup saved to your account."
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <DataAge lastFetchedAt={lastFetchedAt} />
            <button className="btn-icon" onClick={reload} disabled={pricesLoading} title="Refresh prices">
              <RefreshCw size={14} className={pricesLoading ? 'spin' : ''} />
            </button>
          </div>
        }
      />

      {/* Sign-in prompt */}
      {!user && (
        <div className="info-box" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CloudOff size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span><strong>Sign in</strong> to save your setup and load it automatically next time.</span>
          </div>
          <button className="btn-primary btn-sm" onClick={openAuth} style={{ flexShrink: 0 }}>Sign in</button>
        </div>
      )}

      <div className="farming-layout" style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 18, alignItems: 'start' }}>

        {/* ── LEFT PANEL: Setup ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Farming level */}
          <div className="card" style={{ padding: '14px 16px' }}>
            <div className="card__title" style={{ marginBottom: 12 }}>Farming Level</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="number" min={1} max={60} value={setup.farmingLevel}
                onChange={e => setFarmingLevel(+e.target.value)}
                style={{ width: 80 }}
              />
              <span className="text-muted" style={{ fontSize: 12 }}>
                = <strong style={{ color: 'var(--text)' }}>{skillFF} FF</strong> from skill
              </span>
            </div>
          </div>

          {/* Crop milestones */}
          <div className="card" style={{ padding: '14px 16px' }}>
            <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: showMilestones ? 12 : 0 }}
              onClick={() => setShowMilestones(s => !s)}>
              <div className="card__title" style={{ margin: 0 }}>
                Crop Milestone Tiers
                <span className="text-muted" style={{ fontSize: 11, fontWeight: 400 }}> (affects Dedication)</span>
              </div>
              {showMilestones ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {showMilestones && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {CROPS.map(c => (
                  <div key={c.name}>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>{c.name}</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="number" min={0} max={46}
                        value={setup.milestones[c.name] ?? 0}
                        onChange={e => setMilestone(c.name, +e.target.value)}
                        style={{ width: 54, fontSize: 12 }}
                      />
                      <span className="text-muted" style={{ fontSize: 10 }}>/ 46</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Enchant levels */}
          <div className="card" style={{ padding: '14px 16px' }}>
            <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: showEnchants ? 12 : 0 }}
              onClick={() => setShowEnchants(s => !s)}>
              <div className="card__title" style={{ margin: 0 }}>Current Enchants</div>
              {showEnchants ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {showEnchants && (
              <>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Turbo (per crop):</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  {CROPS.map(c => (
                    <div key={c.key}>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>{c.name}</label>
                      <LevelSelect value={setup.enchants[c.key] ?? 0} max={5} onChange={v => setEnchant(c.key, v)} />
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Global:</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {GLOBAL_ENCHANTS.map(e => (
                    <div key={e.key}>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
                        {e.label}
                        {e.type === 'bps'  && <span className="tag tag-blue"  style={{ fontSize: 9, marginLeft: 4, padding: '0 5px' }}>BPS</span>}
                        {e.type === 'pest' && <span className="tag tag-purple" style={{ fontSize: 9, marginLeft: 4, padding: '0 5px' }}>BPC</span>}
                      </label>
                      <LevelSelect value={setup.enchants[e.key] ?? 0} max={e.max} onChange={v => setEnchant(e.key, v)} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Save button */}
          <button
            className={saved ? 'btn-secondary' : 'btn-primary'}
            onClick={saveSetup}
            disabled={syncing || (saved && !!user)}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {syncing
              ? <><span className="spinner spinner-sm" /> Saving…</>
              : saved && user
                ? <><Cloud size={13} /> Saved</>
                : <><Save size={13} /> {user ? 'Save to account' : 'Sign in to save'}</>
            }
          </button>
        </div>

        {/* ── RIGHT PANEL: Results ──────────────────────────────────────── */}
        <div>
          {/* Summary tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Farming Level', value: setup.farmingLevel,   sub: `${skillFF} FF from skill` },
              { label: 'Dedication FF',  value: `${currentDedFF.toFixed(0)} FF`, sub: `tier ${bestMilestone} best crop` },
              { label: 'FF Available',   value: `+${totalFF.toFixed(0)}`,  sub: `${fortuneCount} upgrades`, gold: true },
              { label: 'Pest Chance',    value: `${currentBPC}%`,           sub: availableBPC > 0 ? `+${availableBPC}% available` : 'maxed', purple: true },
              { label: 'Total Cost',     value: formatCoins(totalCost),     sub: 'to max all enchants' },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: '10px 12px', textAlign: 'center' }}>
                <div className="text-muted" style={{ fontSize: 10, marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontWeight: 800, fontSize: 17, color: s.gold ? 'var(--gold)' : s.purple ? '#a78bfa' : 'var(--text)' }}>{s.value}</div>
                <div className="text-muted" style={{ fontSize: 10, marginTop: 1 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Tab bar + crop filter */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 14, alignItems: 'flex-end' }}>
            {[
              { id: 'fortune', label: `🌾 Fortune (${fortuneCount})` },
              { id: 'bps',     label: `⚡ BPS (${bpsCount})` },
              { id: 'pest',    label: `🐛 Pest Chance (${pestCount})` },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: '9px 16px', fontWeight: 700, fontSize: 13,
                background: 'none', border: 'none',
                borderBottom: tab === t.id ? '2px solid var(--gold)' : '2px solid transparent',
                color: tab === t.id ? 'var(--gold)' : 'var(--text-muted)',
                cursor: 'pointer', marginBottom: -1,
              }}>
                {t.label}
              </button>
            ))}
            {tab === 'fortune' && (
              <div style={{ marginLeft: 'auto', marginBottom: 4 }}>
                <select value={cropFilter} onChange={e => setCropFilter(e.target.value)} style={{ fontSize: 12, height: 28 }}>
                  <option>All Crops</option>
                  {CROPS.map(c => <option key={c.name}>{c.name}</option>)}
                  <option value="global">Global only</option>
                </select>
              </div>
            )}
          </div>

          {/* Table */}
          {pricesLoading && !priceData ? (
            <div className="spinner" style={{ margin: '40px auto' }} />
          ) : visible.length === 0 ? (
            <div className="empty-state" style={{ marginTop: 30 }}>
              <span className="empty-state-icon">🌾</span>
              <span>{fortuneCount === 0 && pestCount === 0 && bpsCount === 0 ? 'All enchants maxed — nothing left to upgrade!' : 'No upgrades match this filter.'}</span>
            </div>
          ) : (
            <div className="card" style={{ padding: 0 }}>
              <div className="table-wrap" style={{ border: 'none' }}>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Enchant</th>
                      <th>Crop</th>
                      <th>Level</th>
                      {tab === 'fortune' && <th>FF Gain</th>}
                      {tab === 'bps'     && <th>BPS ~Gain</th>}
                      {tab === 'pest'    && <th>BPC Gain</th>}
                      <th>BZ Cost</th>
                      {tab === 'fortune' && <th>FF / M</th>}
                      {tab === 'pest'    && <th>% / M</th>}
                      <th>Note</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((u, i) => (
                      <tr key={u.id}>
                        <td className="text-muted" style={{ fontSize: 11 }}>{i + 1}</td>
                        <td style={{ fontWeight: 700, fontSize: 13 }}>{u.name}</td>
                        <td>
                          {u.crop
                            ? <span className="tag tag-green" style={{ fontSize: 10 }}>{u.crop}</span>
                            : <span className="text-muted" style={{ fontSize: 11 }}>Global</span>}
                        </td>
                        <td className="text-muted" style={{ fontSize: 11 }}>
                          {ROMAN[u.fromLevel] || '—'} → <strong style={{ color: 'var(--text)' }}>{ROMAN[u.toLevel]}</strong>
                        </td>
                        {tab === 'fortune' && (
                          <td><span style={{ color: 'var(--green)', fontWeight: 700 }}>+{u.ffGain} FF</span></td>
                        )}
                        {tab === 'bps' && (
                          <td><span style={{ color: '#60a5fa', fontWeight: 700 }}>+{u.bpsGain} BPS</span></td>
                        )}
                        {tab === 'pest' && (
                          <td><span style={{ color: '#a78bfa', fontWeight: 700 }}>+{u.bpcGain}%</span></td>
                        )}
                        <td><span className="text-gold" style={{ fontWeight: 700 }}>{formatCoins(u.costCoins)}</span></td>
                        {tab === 'fortune' && (
                          <td>{u.ffPerMillion > 0 ? <ScoreBadge ffpm={u.ffPerMillion} /> : <span className="text-muted">—</span>}</td>
                        )}
                        {tab === 'pest' && (
                          <td>{u.bpcPerMillion > 0 ? <BpcBadge bpcpm={u.bpcPerMillion} /> : <span className="text-muted">—</span>}</td>
                        )}
                        <td className="text-muted" style={{ fontSize: 11 }}>{u.note}</td>
                        <td>
                          <a href={`https://sky.coflnet.com/bazaar/${u.bzItemId}`}
                            target="_blank" rel="noopener noreferrer"
                            className="btn-icon btn-sm" title="View on Coflnet">
                            <ExternalLink size={11} />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(tab === 'fortune' || tab === 'pest') && visible.length > 0 && (
                <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  <span className="text-muted" style={{ fontSize: 12 }}>{visible.length} upgrades</span>
                  {tab === 'fortune' && (
                    <span style={{ fontSize: 12 }}>
                      Total FF: <strong style={{ color: 'var(--green)' }}>+{visible.reduce((s, u) => s + u.ffGain, 0).toFixed(0)}</strong>
                    </span>
                  )}
                  {tab === 'pest' && (
                    <span style={{ fontSize: 12 }}>
                      Total BPC: <strong style={{ color: '#a78bfa' }}>+{visible.reduce((s, u) => s + u.bpcGain, 0)}%</strong>
                    </span>
                  )}
                  <span style={{ fontSize: 12 }}>
                    Total cost: <strong className="text-gold">{formatCoins(visible.reduce((s, u) => s + u.costCoins, 0))}</strong>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
