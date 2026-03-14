import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Sword, TrendingUp, Target, Gavel,
  Cpu, GitBranch, Sparkles, Skull, Swords,
  User, Wallet, Layers, BookOpen,
  Calculator, Hammer, Bell, Vote,
  ArrowRight, Zap, Lock, Heart,
  LayoutDashboard, Shield, Activity,
  ChevronRight, Star, Trophy, Flame,
} from 'lucide-react';
import { useAuthModal } from './AuthProvider';

/* ─── Ticker data ─────────────────────────────────────────────────────────── */
const TICKER = [
  { name: 'Hyperion',          price: '285.4M', up: true  },
  { name: 'Livid Dagger ✦✦✦✦', price: '43.1M',  up: true  },
  { name: 'Storm Chestplate',  price: '12.8M',  up: false },
  { name: 'Necron Blade',      price: '198.5M', up: true  },
  { name: 'Warden Heart',      price: '8.2M',   up: false },
  { name: 'Midas Staff',       price: '500.0M', up: true  },
  { name: 'Glacite Armor Set', price: '24.6M',  up: true  },
  { name: 'Spirit Leap',       price: '1.3M',   up: false },
  { name: 'Emerald Blade',     price: '9.8M',   up: true  },
  { name: 'Bonzo Staff',       price: '2.1M',   up: false },
  { name: 'Dark Claymore',     price: '64.0M',  up: true  },
  { name: 'Aspect of the End', price: '780K',   up: false },
];

/* ─── Feature sections ────────────────────────────────────────────────────── */
const FEATURES = [
  {
    id: 'markets',
    label: 'Markets',
    gradient: 'linear-gradient(135deg, #60a5fa, #22d3ee)',
    glow: 'rgba(96,165,250,0.2)',
    border: 'rgba(96,165,250,0.25)',
    bg: 'rgba(96,165,250,0.06)',
    icon: TrendingUp,
    headline: 'Find flips before anyone else',
    body: 'Real-time Bazaar spreads, live AH index with 600K+ listings, and a dedicated sniper that catches listings priced 20%+ below market before they vanish.',
    tools: [
      { icon: TrendingUp, name: 'Bazaar Flip Finder', tag: null },
      { icon: Target,     name: 'AH Flip Sniper',    tag: 'HOT 🔥' },
      { icon: Gavel,      name: 'Auction House',      tag: null },
    ],
  },
  {
    id: 'moneymakers',
    label: 'Money Makers',
    gradient: 'linear-gradient(135deg, #34d399, #06b6d4)',
    glow: 'rgba(52,211,153,0.2)',
    border: 'rgba(52,211,153,0.25)',
    bg: 'rgba(52,211,153,0.06)',
    icon: Zap,
    headline: 'Unlock 100M+ coin methods',
    body: 'From minion optimisation to attribute shard fusion — every high-income method in one place with up-to-the-minute profitability calculations.',
    tools: [
      { icon: Cpu,       name: 'Minion Calculator', tag: null },
      { icon: GitBranch, name: 'Craft Flips',       tag: null },
      { icon: Sparkles,  name: 'Shard Fusion',      tag: '💎 PREMIUM' },
      { icon: Skull,     name: 'Dungeon Profit',    tag: null },
      { icon: Swords,    name: 'Slayer Dashboard',  tag: null },
    ],
  },
  {
    id: 'playertools',
    label: 'Player Tools',
    gradient: 'linear-gradient(135deg, #c084fc, #f472b6)',
    glow: 'rgba(192,132,252,0.2)',
    border: 'rgba(192,132,252,0.25)',
    bg: 'rgba(192,132,252,0.06)',
    icon: User,
    headline: 'Know your empire inside out',
    body: 'Full net worth valuation, skill planner, portfolio tracker and detailed player stats — everything you need to see where you are and where you\'re headed.',
    tools: [
      { icon: User,     name: 'Player Stats',   tag: null },
      { icon: Wallet,   name: 'Net Worth',      tag: null },
      { icon: Layers,   name: 'Portfolio',      tag: null },
      { icon: BookOpen, name: 'Skill Planner',  tag: null },
    ],
  },
  {
    id: 'optimizers',
    label: 'Optimizers',
    gradient: 'linear-gradient(135deg, #fbbf24, #fb923c)',
    glow: 'rgba(251,191,36,0.2)',
    border: 'rgba(251,191,36,0.25)',
    bg: 'rgba(251,191,36,0.06)',
    icon: Calculator,
    headline: 'Squeeze every last coin',
    body: 'Reforge optimizer, HOTM calculators, price alerts and a full Mayor & Events tracker — the fine-tuning layer that separates good players from great ones.',
    tools: [
      { icon: Calculator, name: 'Calculators',    tag: null },
      { icon: Hammer,     name: 'Reforge',        tag: null },
      { icon: Bell,       name: 'Price Alerts',   tag: null },
      { icon: Vote,       name: 'Mayor & Events', tag: null },
    ],
  },
];

/* ─── Fake snipe rows shown in the live preview ───────────────────────────── */
const PREVIEW_SNIPES = [
  { name: 'Livid Dagger ✦✦✦✦',      list: '32.1M',  med: '43.8M',  profit: '+11.7M', pct: '26.7%', tier: 'LEGENDARY' },
  { name: 'Shadow Fury',             list: '41.0M',  med: '54.2M',  profit: '+13.2M', pct: '24.4%', tier: 'LEGENDARY' },
  { name: 'Hyperion [Recomb]',       list: '249M',   med: '310M',   profit: '+61M',   pct: '19.7%', tier: 'LEGENDARY' },
  { name: 'Necron Helmet ✦✦✦',       list: '18.5M',  med: '24.1M',  profit: '+5.6M',  pct: '23.2%', tier: 'EPIC' },
  { name: 'Warden Helmet',           list: '6.9M',   med: '8.8M',   profit: '+1.9M',  pct: '21.6%', tier: 'LEGENDARY' },
];

const TIER_COLOR = {
  LEGENDARY: '#fbbf24',
  EPIC: '#c084fc',
  RARE: '#60a5fa',
};

/* ─── Animated counter hook ───────────────────────────────────────────────── */
function useCountUp(target, duration = 1800, start = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime = null;
    const step = (ts) => {
      if (!startTime) startTime = ts;
      const p = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(eased * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [start, target, duration]);
  return val;
}

/* ─── Scroll-fade-in wrapper ──────────────────────────────────────────────── */
function FadeIn({ children, delay = 0, style = {} }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(28px)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ─── Animated blob background ───────────────────────────────────────────── */
function BlobBg() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {/* Gold blob top-left */}
      <div style={{
        position: 'absolute', top: '-10%', left: '-5%',
        width: '55vw', height: '55vw', maxWidth: 700, maxHeight: 700,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(251,191,36,0.12) 0%, transparent 70%)',
        animation: 'blob-drift-1 18s ease-in-out infinite alternate',
        filter: 'blur(60px)',
      }} />
      {/* Cyan blob bottom-right */}
      <div style={{
        position: 'absolute', bottom: '-15%', right: '-5%',
        width: '60vw', height: '60vw', maxWidth: 800, maxHeight: 800,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(34,211,238,0.1) 0%, transparent 70%)',
        animation: 'blob-drift-2 22s ease-in-out infinite alternate',
        filter: 'blur(70px)',
      }} />
      {/* Purple blob center */}
      <div style={{
        position: 'absolute', top: '30%', right: '15%',
        width: '40vw', height: '40vw', maxWidth: 600, maxHeight: 600,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(192,132,252,0.09) 0%, transparent 70%)',
        animation: 'blob-drift-3 15s ease-in-out infinite alternate',
        filter: 'blur(60px)',
      }} />
      {/* Grid overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
        maskImage: 'radial-gradient(ellipse 80% 70% at 50% 40%, black 30%, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 40%, black 30%, transparent 80%)',
      }} />
    </div>
  );
}

/* ─── Scrolling ticker ────────────────────────────────────────────────────── */
function Ticker() {
  const doubled = [...TICKER, ...TICKER];
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(6,11,20,0.6)',
      backdropFilter: 'blur(8px)',
      padding: '10px 0',
    }}>
      {/* Fade masks */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 80, background: 'linear-gradient(90deg, #060b14, transparent)', zIndex: 2, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 80, background: 'linear-gradient(-90deg, #060b14, transparent)', zIndex: 2, pointerEvents: 'none' }} />
      <div style={{ display: 'flex', gap: 0, animation: 'ticker-scroll 30s linear infinite', whiteSpace: 'nowrap' }}>
        {doubled.map((item, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0 28px', fontSize: 12, fontWeight: 600 }}>
            <span style={{ color: '#6b85b0' }}>{item.name}</span>
            <span style={{ color: item.up ? '#34d399' : '#f87171', fontWeight: 800, fontFamily: 'monospace' }}>{item.price}</span>
            <span style={{ color: item.up ? '#34d39966' : '#f8717166', fontSize: 10 }}>{item.up ? '▲' : '▼'}</span>
            <span style={{ color: '#1e2d47', margin: '0 4px' }}>•</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Gradient button ─────────────────────────────────────────────────────── */
function GlowButton({ children, gradient, shadow, onClick, as: As = 'button', ...rest }) {
  const [hovered, setHovered] = useState(false);
  const baseStyle = {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '14px 32px', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: 'pointer',
    border: 'none', textDecoration: 'none',
    background: gradient,
    color: '#000',
    boxShadow: hovered ? shadow.replace('0.35', '0.6') : shadow,
    transform: hovered ? 'translateY(-2px) scale(1.02)' : 'none',
    transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
  };
  return (
    <As style={baseStyle} onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...rest}
    >
      {children}
    </As>
  );
}

function GhostButton({ children, onClick, as: As = 'button', ...rest }) {
  const [hovered, setHovered] = useState(false);
  return (
    <As
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '14px 28px', borderRadius: 12, fontSize: 15, fontWeight: 700,
        background: hovered ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${hovered ? '#60a5fa' : 'rgba(255,255,255,0.12)'}`,
        color: '#e8f0ff', cursor: 'pointer', textDecoration: 'none',
        transition: 'all 0.2s',
        backdropFilter: 'blur(8px)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...rest}
    >
      {children}
    </As>
  );
}

/* ─── Feature card ────────────────────────────────────────────────────────── */
function FeatureCard({ f, idx }) {
  const [hovered, setHovered] = useState(false);
  const FIcon = f.icon;
  return (
    <FadeIn delay={idx * 80}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          borderRadius: 20, overflow: 'hidden',
          border: `1px solid ${hovered ? f.border : 'rgba(255,255,255,0.06)'}`,
          background: 'rgba(13,21,37,0.85)',
          backdropFilter: 'blur(16px)',
          boxShadow: hovered ? `0 0 60px ${f.glow}, 0 20px 60px rgba(0,0,0,0.4)` : '0 4px 24px rgba(0,0,0,0.3)',
          transform: hovered ? 'translateY(-6px)' : 'none',
          transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Gradient header band */}
        <div style={{
          padding: '28px 28px 24px',
          background: f.bg,
          borderBottom: `1px solid ${f.border}`,
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Big background icon */}
          <div style={{
            position: 'absolute', right: -10, top: -10,
            opacity: 0.06, transform: 'rotate(-15deg)',
          }}>
            <FIcon size={120} />
          </div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Icon pill */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(0,0,0,0.3)', borderRadius: 24, padding: '6px 14px 6px 8px',
              marginBottom: 16, border: `1px solid ${f.border}`,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: f.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#000', flexShrink: 0,
              }}>
                <FIcon size={14} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.5px', color: '#e8f0ff', textTransform: 'uppercase' }}>{f.label}</span>
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 900, marginBottom: 8, lineHeight: 1.2, color: '#e8f0ff' }}>{f.headline}</h3>
            <p style={{ fontSize: 13, color: '#6b85b0', lineHeight: 1.65 }}>{f.body}</p>
          </div>
        </div>

        {/* Tools list */}
        <div style={{ padding: '20px 28px 24px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {f.tools.map(tool => {
            const TIcon = tool.icon;
            const isPremium = tool.tag?.includes('PREMIUM');
            const isHot = tool.tag?.includes('HOT');
            return (
              <div key={tool.name} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 10,
                background: isPremium ? 'rgba(251,191,36,0.04)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isPremium ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.04)'}`,
              }}>
                <TIcon size={13} style={{ color: isPremium ? '#fbbf24' : '#6b85b0', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#c8d8f0' }}>{tool.name}</span>
                {tool.tag && (
                  <span style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.4px',
                    padding: '2px 7px', borderRadius: 4,
                    background: isPremium ? 'rgba(251,191,36,0.15)' : isHot ? 'rgba(248,113,113,0.15)' : 'rgba(52,211,153,0.12)',
                    color: isPremium ? '#fbbf24' : isHot ? '#f87171' : '#34d399',
                    border: `1px solid ${isPremium ? 'rgba(251,191,36,0.3)' : isHot ? 'rgba(248,113,113,0.3)' : 'rgba(52,211,153,0.3)'}`,
                  }}>{tool.tag}</span>
                )}
              </div>
            );
          })}
          <Link
            to="/dashboard"
            style={{
              marginTop: 8, display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 13, fontWeight: 700, color: '#6b85b0', textDecoration: 'none',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#e8f0ff'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#6b85b0'; }}
          >
            Explore {f.label} tools <ChevronRight size={13} />
          </Link>
        </div>
      </div>
    </FadeIn>
  );
}

/* ─── Live preview section ────────────────────────────────────────────────── */
function LivePreview() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive(a => (a + 1) % PREVIEW_SNIPES.length), 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <FadeIn>
      <div style={{
        borderRadius: 20, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(13,21,37,0.9)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 40px 120px rgba(0,0,0,0.6), 0 0 80px rgba(96,165,250,0.06)',
      }}>
        {/* Window chrome */}
        <div style={{
          padding: '12px 18px', background: 'rgba(9,16,30,0.8)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {['#f87171','#fbbf24','#34d399'].map(c => (
              <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.7 }} />
            ))}
          </div>
          <div style={{
            flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 6,
            padding: '4px 12px', fontSize: 11, color: '#3a506e', fontFamily: 'monospace',
            border: '1px solid rgba(255,255,255,0.05)',
          }}>
            skyhelper.gg/sniper
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#34d399' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', animation: 'pulse-dot 2s ease-in-out infinite' }} />
            LIVE
          </div>
        </div>

        {/* Page header mockup */}
        <div style={{
          padding: '20px 24px 16px',
          background: 'linear-gradient(135deg, rgba(248,113,113,0.05), rgba(251,191,36,0.03))',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171' }}>
              <Target size={16} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>AH Flip Sniper</div>
              <div style={{ fontSize: 11, color: '#6b85b0' }}>Listings priced 20%+ below median — refresh every 60s</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <div style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', fontSize: 11, fontWeight: 700, color: '#34d399' }}>
                {PREVIEW_SNIPES.length} snipes found
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.3)' }}>
                {['#', 'Item', 'Listing', 'Median', 'Profit', '% Below'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#3a506e', letterSpacing: '0.7px', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PREVIEW_SNIPES.map((row, i) => (
                <tr key={row.name} style={{
                  background: i === active ? 'rgba(251,191,36,0.04)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                  borderLeft: i === active ? '2px solid #fbbf24' : '2px solid transparent',
                  transition: 'all 0.4s',
                }}>
                  <td style={{ padding: '12px 16px', color: '#3a506e', fontSize: 11 }}>{i + 1}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 700, color: TIER_COLOR[row.tier] ?? '#e8f0ff' }}>{row.name}</div>
                    <div style={{ fontSize: 10, color: '#3a506e', marginTop: 2 }}>{row.tier}</div>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#60a5fa', fontWeight: 700, fontFamily: 'monospace' }}>{row.list}</td>
                  <td style={{ padding: '12px 16px', color: '#6b85b0', fontFamily: 'monospace' }}>{row.med}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ color: '#34d399', fontWeight: 800, fontFamily: 'monospace', fontSize: 14 }}>{row.profit}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 800,
                      background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)',
                    }}>{row.pct}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer bar */}
        <div style={{
          padding: '10px 18px', background: 'rgba(0,0,0,0.3)',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#3a506e',
        }}>
          <Activity size={11} style={{ color: '#34d399' }} />
          <span>AH index updated <span style={{ color: '#6b85b0' }}>12 seconds ago</span></span>
          <span style={{ marginLeft: 'auto', color: '#6b85b0' }}>600K+ live listings indexed</span>
        </div>
      </div>
    </FadeIn>
  );
}

/* ─── Stats counter row ───────────────────────────────────────────────────── */
function StatsRow() {
  const [started, setStarted] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setStarted(true); obs.disconnect(); } }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const tools  = useCountUp(20,  1400, started);
  const coins  = useCountUp(100, 1600, started);
  const items  = useCountUp(600, 1800, started);

  return (
    <div ref={ref} style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
      gap: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 16, overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.07)',
      marginTop: 64,
    }}>
      {[
        { val: `${tools}+`,    label: 'Tools',                 color: '#fbbf24' },
        { val: `${coins}M+`,   label: 'Coins/hr potential',    color: '#34d399' },
        { val: `${items}K+`,   label: 'AH listings indexed',   color: '#60a5fa' },
        { val: 'Free',         label: 'No hidden paywall',     color: '#c084fc' },
      ].map((s, i) => (
        <div key={s.label} style={{
          padding: '24px 28px', background: 'rgba(13,21,37,0.85)', textAlign: 'center',
          backdropFilter: 'blur(12px)',
        }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: s.color, lineHeight: 1, letterSpacing: '-1px' }}>{s.val}</div>
          <div style={{ fontSize: 11, color: '#6b85b0', marginTop: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────────────────────── */
export default function Landing() {
  const { openAuth } = useAuthModal();

  return (
    <div style={{ minHeight: '100vh', color: '#e8f0ff', overflowX: 'hidden', background: '#060b14' }}>

      {/* ── CSS animations (injected once) ── */}
      <style>{`
        @keyframes blob-drift-1 { 0%{transform:translate(0,0) scale(1)} 100%{transform:translate(4%,6%) scale(1.08)} }
        @keyframes blob-drift-2 { 0%{transform:translate(0,0) scale(1)} 100%{transform:translate(-5%,-4%) scale(1.1)} }
        @keyframes blob-drift-3 { 0%{transform:translate(0,0) scale(1)} 100%{transform:translate(3%,-7%) scale(0.95)} }
        @keyframes ticker-scroll { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes pulse-dot     { 0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(52,211,153,0.4)} 50%{opacity:0.7;box-shadow:0 0 0 6px transparent} }
        @keyframes hero-float    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes shimmer-bg    { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        @keyframes scroll-hint   { 0%,100%{opacity:0.4;transform:translateX(-50%) translateY(0)} 50%{opacity:0.9;transform:translateX(-50%) translateY(8px)} }
        @keyframes border-glow   { 0%,100%{opacity:0.5} 50%{opacity:1} }
      `}</style>

      {/* ── TOP NAV ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 clamp(20px, 4vw, 56px)',
        height: 64,
        background: 'rgba(6,11,20,0.7)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 900, fontSize: 18 }}>
          <Sword size={20} style={{ color: '#fbbf24', filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.7))' }} />
          <span style={{
            background: 'linear-gradient(135deg, #fbbf24, #fb923c, #fbbf24)',
            backgroundSize: '200%',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            animation: 'shimmer-bg 4s ease-in-out infinite',
          }}>SkyHelper</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={openAuth}
            style={{
              padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#a8c0e8',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#fbbf24'; e.currentTarget.style.color = '#fbbf24'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#a8c0e8'; }}
          >
            Sign in
          </button>
          <Link to="/dashboard" style={{
            padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: 'pointer',
            background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#000',
            textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
            boxShadow: '0 0 20px rgba(251,191,36,0.3)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 32px rgba(251,191,36,0.55)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 0 20px rgba(251,191,36,0.3)'; e.currentTarget.style.transform = 'none'; }}
          >
            Open App <ArrowRight size={13} />
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        position: 'relative', minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(100px, 12vw, 160px) clamp(20px, 5vw, 80px) 0',
        textAlign: 'center',
      }}>
        <BlobBg />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 880, width: '100%' }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 28,
            background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
            borderRadius: 24, padding: '7px 18px',
            fontSize: 12, fontWeight: 700, color: '#fbbf24', letterSpacing: '0.5px',
          }}>
            <Flame size={12} fill="#fbbf24" /> The #1 Hypixel SkyBlock toolkit — free
          </div>

          {/* Main title */}
          <h1 style={{ fontSize: 'clamp(48px, 9vw, 100px)', fontWeight: 900, lineHeight: 0.95, letterSpacing: '-3px', marginBottom: 28 }}>
            <span style={{ display: 'block', color: '#e8f0ff' }}>Make more</span>
            <span style={{
              display: 'block',
              background: 'linear-gradient(135deg, #fbbf24 0%, #fb923c 30%, #f472b6 60%, #c084fc 85%, #60a5fa 100%)',
              backgroundSize: '200%',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              animation: 'shimmer-bg 6s ease-in-out infinite',
            }}>coins.</span>
          </h1>

          <p style={{
            fontSize: 'clamp(16px, 2.2vw, 21px)', color: '#6b85b0', lineHeight: 1.65, marginBottom: 40,
            maxWidth: 600, margin: '0 auto 40px',
          }}>
            20+ live tools for flipping, crafting, sniping and optimizing — all powered
            by real-time Hypixel API data. No setup required.
          </p>

          {/* CTA row */}
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
            <GlowButton
              as={Link}
              to="/dashboard"
              gradient="linear-gradient(135deg, #fbbf24, #f59e0b)"
              shadow="0 0 40px rgba(251,191,36,0.4), 0 8px 24px rgba(0,0,0,0.4)"
            >
              <LayoutDashboard size={16} /> Open Dashboard
            </GlowButton>
            <GhostButton as="button" onClick={openAuth}>
              <User size={16} /> Create Free Account
            </GhostButton>
          </div>

          <p style={{ fontSize: 12, color: '#3a506e' }}>No credit card · No download · Just open and use</p>

          {/* Stats */}
          <StatsRow />
        </div>

        {/* Scroll hint */}
        <div style={{
          position: 'absolute', bottom: 28, left: '50%',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
          color: '#3a506e', fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase',
          animation: 'scroll-hint 2.5s ease-in-out infinite',
        }}>
          <span>Scroll</span>
          <ArrowRight size={11} style={{ transform: 'rotate(90deg)' }} />
        </div>
      </section>

      {/* ── TICKER ── */}
      <Ticker />

      {/* ── LIVE PREVIEW ── */}
      <section style={{
        padding: 'clamp(70px, 9vw, 110px) clamp(20px, 5vw, 80px)',
        background: 'linear-gradient(180deg, transparent, rgba(13,21,37,0.4), transparent)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: 44 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14,
                background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)',
                borderRadius: 20, padding: '5px 14px',
                fontSize: 11, fontWeight: 800, color: '#34d399', letterSpacing: '0.7px', textTransform: 'uppercase',
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', animation: 'pulse-dot 2s ease-in-out infinite' }} />
                Live preview
              </div>
              <h2 style={{ fontSize: 'clamp(26px, 4vw, 44px)', fontWeight: 900, letterSpacing: '-1px', marginBottom: 10, color: '#e8f0ff' }}>
                See it in action
              </h2>
              <p style={{ color: '#6b85b0', fontSize: 15, maxWidth: 500, margin: '0 auto' }}>
                This is what the AH Sniper looks like — finding underpriced listings in real time so you can buy low and resell for profit.
              </p>
            </div>
          </FadeIn>
          <LivePreview />
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ padding: 'clamp(60px, 8vw, 100px) clamp(20px, 5vw, 80px)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <FadeIn style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14,
              background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
              borderRadius: 20, padding: '5px 14px',
              fontSize: 11, fontWeight: 800, color: '#fbbf24', letterSpacing: '0.7px', textTransform: 'uppercase',
            }}>
              <Star size={10} fill="#fbbf24" /> Everything in one place
            </div>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 44px)', fontWeight: 900, letterSpacing: '-1px', marginBottom: 12, color: '#e8f0ff' }}>
              Every tool you need to dominate
            </h2>
            <p style={{ color: '#6b85b0', fontSize: 15, maxWidth: 540, margin: '0 auto' }}>
              From beginner-friendly market tools to advanced premium strategies —
              SkyHelper has a tool for every play style and skill level.
            </p>
          </FadeIn>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 20,
          }}>
            {FEATURES.map((f, i) => <FeatureCard key={f.id} f={f} idx={i} />)}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{
        padding: 'clamp(60px, 8vw, 100px) clamp(20px, 5vw, 80px)',
        background: 'rgba(13,21,37,0.5)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <FadeIn style={{ textAlign: 'center', marginBottom: 52 }}>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 44px)', fontWeight: 900, letterSpacing: '-1px', marginBottom: 12, color: '#e8f0ff' }}>
              From zero to profit in 60 seconds
            </h2>
            <p style={{ color: '#6b85b0', fontSize: 15 }}>No accounts, no installs. Just open and go.</p>
          </FadeIn>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 2, borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
            {[
              { n: '1', icon: LayoutDashboard, color: '#60a5fa', grad: 'linear-gradient(135deg,#60a5fa,#22d3ee)', title: 'Open any tool', desc: 'Pick a tool from the sidebar — no account or setup needed to start using it.' },
              { n: '2', icon: Activity,        color: '#34d399', grad: 'linear-gradient(135deg,#34d399,#06b6d4)', title: 'Get live data',  desc: 'Every page fetches from the Hypixel API in real time. AH index refreshes every 60 seconds.' },
              { n: '3', icon: Zap,             color: '#fbbf24', grad: 'linear-gradient(135deg,#fbbf24,#fb923c)', title: 'Act fast',       desc: 'Opportunities are ranked by profit. Filter, sort and execute before the market moves.' },
              { n: '4', icon: Trophy,          color: '#c084fc', grad: 'linear-gradient(135deg,#c084fc,#f472b6)', title: 'Level up',       desc: 'Track your progress, plan your skills and grow your net worth with the player tools.' },
            ].map(step => {
              const SIcon = step.icon;
              return (
                <FadeIn key={step.n} delay={+step.n * 80}>
                  <div style={{
                    padding: '36px 32px',
                    background: 'rgba(13,21,37,0.9)', backdropFilter: 'blur(8px)',
                    position: 'relative', overflow: 'hidden', height: '100%',
                  }}>
                    <div style={{
                      position: 'absolute', top: 12, right: 16,
                      fontSize: 64, fontWeight: 900, color: 'rgba(255,255,255,0.025)', lineHeight: 1, fontFamily: 'monospace',
                    }}>{step.n}</div>
                    <div style={{
                      width: 48, height: 48, borderRadius: 13, marginBottom: 20,
                      background: step.grad, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#000', boxShadow: `0 0 24px ${step.color}55`,
                    }}>
                      <SIcon size={22} />
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 8, color: '#e8f0ff' }}>{step.title}</div>
                    <div style={{ color: '#6b85b0', fontSize: 13, lineHeight: 1.65 }}>{step.desc}</div>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── PREMIUM ── */}
      <section style={{ padding: 'clamp(60px, 8vw, 100px) clamp(20px, 5vw, 80px)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <FadeIn>
            <div style={{
              borderRadius: 24, overflow: 'hidden',
              border: '1px solid rgba(251,191,36,0.2)',
              background: 'rgba(13,21,37,0.9)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 0 80px rgba(251,191,36,0.08), 0 40px 100px rgba(0,0,0,0.5)',
              position: 'relative',
            }}>
              {/* Animated top border */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                background: 'linear-gradient(90deg, transparent, #fbbf24, #fb923c, #f472b6, #c084fc, transparent)',
                animation: 'border-glow 3s ease-in-out infinite',
              }} />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 0 }}>
                {/* Left: premium feature list */}
                <div style={{
                  padding: 'clamp(36px, 5vw, 56px)',
                  borderRight: '1px solid rgba(255,255,255,0.05)',
                }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 20,
                    background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)',
                    borderRadius: 20, padding: '5px 14px',
                    fontSize: 11, fontWeight: 800, color: '#fbbf24', letterSpacing: '0.7px', textTransform: 'uppercase',
                  }}>
                    <Lock size={10} /> Premium
                  </div>
                  <h2 style={{ fontSize: 'clamp(22px, 3.5vw, 36px)', fontWeight: 900, marginBottom: 12, lineHeight: 1.15, letterSpacing: '-0.5px' }}>
                    The edge that
                    <br />
                    <span style={{
                      background: 'linear-gradient(135deg, #fbbf24, #fb923c)',
                      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                    }}>pays for itself</span>
                  </h2>
                  <p style={{ color: '#6b85b0', fontSize: 14, lineHeight: 1.7, marginBottom: 32 }}>
                    Most of SkyHelper is free forever. Premium unlocks the highest-ROI tools — the ones that can flip your hourly income from millions to hundreds of millions.
                  </p>
                  {[
                    { icon: Sparkles, color: '#fbbf24', text: 'Shard Fusion Sniper — live attribute fusion arbitrage. People make 100M+/hr.' },
                    { icon: Target,   color: '#f87171', text: 'AH Sniper premium mode — deeper filters, lower thresholds, priority refresh.' },
                    { icon: Bell,     color: '#60a5fa', text: 'Price Alerts — pushed to you the moment your target price is hit.' },
                    { icon: Layers,   color: '#c084fc', text: 'Portfolio history — full P&L charts and investment tracking over time.' },
                  ].map(p => {
                    const PIcon = p.icon;
                    return (
                      <div key={p.text} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                          background: p.color + '15', border: `1px solid ${p.color}30`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: p.color, marginTop: 1,
                        }}>
                          <PIcon size={13} />
                        </div>
                        <p style={{ fontSize: 13, color: '#a8c0e8', lineHeight: 1.55, margin: 0 }}>{p.text}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Right: Ko-fi support card */}
                <div style={{
                  padding: 'clamp(36px, 5vw, 56px)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                  background: 'linear-gradient(135deg, rgba(251,191,36,0.03), rgba(192,132,252,0.03))',
                }}>
                  <div style={{
                    fontSize: 64, marginBottom: 20,
                    filter: 'drop-shadow(0 0 20px rgba(251,191,36,0.4))',
                    animation: 'hero-float 4s ease-in-out infinite',
                  }}>☕</div>
                  <h3 style={{ fontSize: 24, fontWeight: 900, marginBottom: 10 }}>Support SkyHelper</h3>
                  <p style={{ color: '#6b85b0', fontSize: 13, lineHeight: 1.7, marginBottom: 28, maxWidth: 300 }}>
                    SkyHelper is built by one person and free for everyone. If it's making you coins,
                    a Ko-fi keeps the servers alive and new tools shipping.
                  </p>
                  <a
                    href="https://ko-fi.com/S6S71VTRIW"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 9,
                      padding: '14px 32px', borderRadius: 12, fontSize: 15, fontWeight: 800,
                      background: 'linear-gradient(135deg, #fbbf24, #fb923c)', color: '#000',
                      textDecoration: 'none', boxShadow: '0 0 32px rgba(251,191,36,0.35)',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 0 48px rgba(251,191,36,0.6)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 0 32px rgba(251,191,36,0.35)'; }}
                  >
                    <Heart size={15} fill="currentColor" /> Support on Ko-fi
                  </a>
                  <div style={{ marginTop: 16, fontSize: 12, color: '#3a506e' }}>Any amount is hugely appreciated 🙏</div>

                  {/* Coin emojis floating */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 24, fontSize: 20 }}>
                    {['🪙','💰','🪙','💰','🪙'].map((e, i) => (
                      <span key={i} style={{ animation: `hero-float ${2.5 + i * 0.3}s ease-in-out ${i * 0.2}s infinite`, display: 'inline-block' }}>{e}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── TRUST STRIP ── */}
      <section style={{
        padding: '32px clamp(20px, 5vw, 80px)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(9,16,30,0.6)',
      }}>
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 1000, margin: '0 auto' }}>
          {[
            { icon: Shield,   c: '#60a5fa', text: 'No login required for most features' },
            { icon: Zap,      c: '#34d399', text: 'AH index updated every 60 seconds' },
            { icon: Star,     c: '#fbbf24', text: 'Covers all major SkyBlock money methods' },
            { icon: Heart,    c: '#f472b6', text: 'Built by a player, for players' },
          ].map(item => {
            const IIcon = item.icon;
            return (
              <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#6b85b0', fontSize: 13 }}>
                <IIcon size={14} style={{ color: item.c, flexShrink: 0 }} />
                {item.text}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{
        padding: 'clamp(80px, 10vw, 120px) clamp(20px, 5vw, 80px)',
        textAlign: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', bottom: '-20%', left: '50%', transform: 'translateX(-50%)', width: '70vw', height: '40vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(251,191,36,0.07) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        </div>
        <FadeIn style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{
            fontSize: 'clamp(32px, 6vw, 64px)', fontWeight: 900, letterSpacing: '-2px', marginBottom: 16,
            background: 'linear-gradient(135deg, #e8f0ff 0%, #fbbf24 50%, #fb923c 100%)',
            backgroundSize: '200%',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            animation: 'shimmer-bg 5s ease-in-out infinite',
          }}>
            Ready to make your first flip?
          </h2>
          <p style={{ color: '#6b85b0', fontSize: 17, marginBottom: 40 }}>
            Jump in — no account needed. The markets are live right now.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <GlowButton
              as={Link}
              to="/dashboard"
              gradient="linear-gradient(135deg, #fbbf24, #f59e0b)"
              shadow="0 0 40px rgba(251,191,36,0.4), 0 8px 24px rgba(0,0,0,0.4)"
            >
              <LayoutDashboard size={16} /> Open Dashboard
            </GlowButton>
            <GhostButton as="button" onClick={openAuth}>
              <User size={16} /> Sign Up Free
            </GhostButton>
          </div>
        </FadeIn>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        padding: '24px clamp(20px, 4vw, 56px)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        background: 'rgba(6,11,20,0.8)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
          <Sword size={15} style={{ color: '#fbbf24' }} />
          <span style={{ color: '#6b85b0' }}>SkyHelper</span>
          <span style={{ color: '#3a506e', fontSize: 11, marginLeft: 4 }}>v4.1</span>
        </div>
        <div style={{ fontSize: 11, color: '#3a506e', textAlign: 'center' }}>
          Not affiliated with Hypixel. Data via public Hypixel API.
        </div>
        <div style={{ display: 'flex', gap: 20, fontSize: 12 }}>
          <Link to="/dashboard"       style={{ color: '#6b85b0', textDecoration: 'none' }}>Dashboard</Link>
          <Link to="/getting-started" style={{ color: '#6b85b0', textDecoration: 'none' }}>Getting Started</Link>
          <a href="https://ko-fi.com/S6S71VTRIW" target="_blank" rel="noreferrer" style={{ color: '#fbbf24', textDecoration: 'none' }}>Support ☕</a>
        </div>
      </footer>
    </div>
  );
}
