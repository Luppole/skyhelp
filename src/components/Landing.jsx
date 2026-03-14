import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Sword, TrendingUp, Target, Gavel,
  Cpu, GitBranch, Sparkles, Skull, Swords,
  User, Wallet, Layers, BookOpen,
  Calculator, Hammer, Bell, Vote,
  ArrowRight, Star, Zap, Lock, Heart,
  LayoutDashboard, Shield, Activity,
} from 'lucide-react';
import { useAuthModal } from './AuthProvider';

// ── Feature data ──────────────────────────────────────────────────────────────
const FEATURE_SECTIONS = [
  {
    label: 'Markets',
    color: '#60a5fa',
    glow: 'rgba(96,165,250,0.15)',
    icon: TrendingUp,
    desc: 'Track live market prices, find undervalued listings, and flip for maximum profit.',
    tools: [
      { icon: TrendingUp, name: 'Bazaar Flip Finder', desc: 'Spot instant buy/sell spreads' },
      { icon: Target,     name: 'AH Flip Sniper',    desc: 'Catch listings below median price', badge: 'HOT' },
      { icon: Gavel,      name: 'Auction House',      desc: 'Browse & search live auctions' },
    ],
  },
  {
    label: 'Money Makers',
    color: '#34d399',
    glow: 'rgba(52,211,153,0.15)',
    icon: Zap,
    desc: 'Automated profit calculators that find the highest-ROI activities available right now.',
    tools: [
      { icon: Cpu,       name: 'Minion Calculator', desc: 'Optimize your minion setup' },
      { icon: GitBranch, name: 'Craft Flips',       desc: 'BZ craft chains + BZ→AH arb' },
      { icon: Sparkles,  name: 'Shard Fusion',      desc: 'Fuse attribute shards for 100M+/hr', badge: '💎 PREMIUM' },
      { icon: Skull,     name: 'Dungeon Profit',    desc: 'Best floors for your gear & time' },
      { icon: Swords,    name: 'Slayer Dashboard',  desc: 'Slayer XP & coin efficiency' },
    ],
  },
  {
    label: 'Player Tools',
    color: '#c084fc',
    glow: 'rgba(192,132,252,0.15)',
    icon: User,
    desc: 'Deep insights into your character — wealth, skills, inventory and long-term progress.',
    tools: [
      { icon: User,      name: 'Player Stats',   desc: 'Skills, collections, dungeon stats' },
      { icon: Wallet,    name: 'Net Worth',       desc: 'Full inventory & bank valuation' },
      { icon: Layers,    name: 'Portfolio',       desc: 'Track your investments over time' },
      { icon: BookOpen,  name: 'Skill Planner',  desc: 'Map your path to skill maxing' },
    ],
  },
  {
    label: 'Optimizers',
    color: '#fbbf24',
    glow: 'rgba(251,191,36,0.15)',
    icon: Calculator,
    desc: 'Fine-tune every aspect of your gameplay with our suite of advanced calculators.',
    tools: [
      { icon: Calculator, name: 'Calculators',    desc: 'HOTM, farming speed & more' },
      { icon: Hammer,     name: 'Reforge Optimizer', desc: 'Find the best reforge for your build' },
      { icon: Bell,       name: 'Price Alerts',   desc: 'Get notified when prices move' },
      { icon: Vote,       name: 'Mayor & Events', desc: 'Track active perks & calendars' },
    ],
  },
];

const STATS = [
  { value: '20+',    label: 'Tools' },
  { value: 'Live',   label: 'Hypixel API' },
  { value: 'Free',   label: 'No paywall' },
  { value: '100M+',  label: 'Coins/hr potential' },
];

const PREMIUM_PERKS = [
  { icon: Sparkles, text: 'Shard Fusion Sniper — identify attribute fusion arbitrage opportunities in real time' },
  { icon: Target,   text: 'AH Sniper with advanced filters, lower thresholds, and priority refresh' },
  { icon: Bell,     text: 'Price Alerts — get instant notifications when your target price is hit' },
  { icon: Activity, text: 'Portfolio tracking with historical charts and P&L breakdown' },
];

// ── Animated star field ────────────────────────────────────────────────────────
function StarField() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const stars = Array.from({ length: 120 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.2 + 0.2,
      a: Math.random(),
      speed: Math.random() * 0.0004 + 0.0001,
      phase: Math.random() * Math.PI * 2,
    }));

    const draw = (t) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of stars) {
        const alpha = s.a * 0.6 * (0.5 + 0.5 * Math.sin(t * s.speed * 1000 + s.phase));
        ctx.beginPath();
        ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(232,240,255,${alpha})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);
  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />;
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionTitle({ tag, title, sub }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 52 }}>
      {tag && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)',
          borderRadius: 20, padding: '4px 14px', marginBottom: 16,
          fontSize: 11, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase',
          color: '#fbbf24',
        }}>
          <Star size={10} fill="#fbbf24" /> {tag}
        </div>
      )}
      <h2 style={{
        fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 900,
        letterSpacing: '-0.5px', marginBottom: 12,
        background: 'linear-gradient(135deg, #e8f0ff, #6b85b0)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
      }}>{title}</h2>
      {sub && <p style={{ color: '#6b85b0', fontSize: 16, maxWidth: 560, margin: '0 auto', lineHeight: 1.7 }}>{sub}</p>}
    </div>
  );
}

// ── Feature card ───────────────────────────────────────────────────────────────
function FeatureCard({ section }) {
  const SectionIcon = section.icon;
  return (
    <div style={{
      background: 'rgba(13,21,37,0.8)',
      border: '1px solid #1e2d47',
      borderRadius: 16,
      padding: '28px 28px 24px',
      display: 'flex', flexDirection: 'column', gap: 20,
      backdropFilter: 'blur(12px)',
      transition: 'border-color 0.2s, box-shadow 0.2s',
      position: 'relative', overflow: 'hidden',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.borderColor = section.color + '55';
      e.currentTarget.style.boxShadow = `0 0 40px ${section.glow}`;
    }}
    onMouseLeave={e => {
      e.currentTarget.style.borderColor = '#1e2d47';
      e.currentTarget.style.boxShadow = 'none';
    }}
    >
      {/* Top accent line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${section.color}, transparent)`,
        opacity: 0.6,
      }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: section.glow,
          border: `1px solid ${section.color}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: section.color, flexShrink: 0,
        }}>
          <SectionIcon size={18} />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#e8f0ff' }}>{section.label}</div>
          <div style={{ fontSize: 12, color: '#6b85b0', marginTop: 1 }}>{section.desc}</div>
        </div>
      </div>

      {/* Tool list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {section.tools.map(tool => {
          const TIcon = tool.icon;
          return (
            <div key={tool.name} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 8,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.04)',
            }}>
              <TIcon size={13} style={{ color: section.color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#e8f0ff' }}>{tool.name}</span>
                <span style={{ fontSize: 11, color: '#6b85b0', marginLeft: 8 }}>{tool.desc}</span>
              </div>
              {tool.badge && (
                <span style={{
                  fontSize: 8, fontWeight: 800, letterSpacing: '0.3px',
                  background: tool.badge.includes('💎') ? 'rgba(251,191,36,0.15)' : 'rgba(248,113,113,0.15)',
                  color: tool.badge.includes('💎') ? '#fbbf24' : '#f87171',
                  border: `1px solid ${tool.badge.includes('💎') ? 'rgba(251,191,36,0.35)' : 'rgba(248,113,113,0.35)'}`,
                  padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap',
                }}>
                  {tool.badge}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function Landing() {
  const { openAuth } = useAuthModal();

  return (
    <div style={{ minHeight: '100vh', color: '#e8f0ff', overflowX: 'hidden' }}>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section style={{
        position: 'relative', minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '80px 24px 60px',
        background: 'radial-gradient(ellipse 100% 70% at 50% 0%, rgba(251,191,36,0.06) 0%, transparent 60%), radial-gradient(ellipse 80% 60% at 20% 100%, rgba(96,165,250,0.05) 0%, transparent 60%)',
      }}>
        <StarField />

        {/* Nav bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 32px',
          borderBottom: '1px solid rgba(30,45,71,0.6)',
          backdropFilter: 'blur(12px)',
          zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 900, fontSize: 17 }}>
            <Sword size={20} style={{ color: '#fbbf24', filter: 'drop-shadow(0 0 6px rgba(251,191,36,0.5))' }} />
            <span style={{
              background: 'linear-gradient(135deg, #fbbf24, #fb923c, #fbbf24)',
              backgroundSize: '200% 100%',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              animation: 'text-shimmer 4s ease-in-out infinite',
            }}>SkyHelper</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={openAuth}
              style={{
                padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: 'transparent', border: '1px solid #2e4570', color: '#e8f0ff',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#fbbf24'; e.currentTarget.style.color = '#fbbf24'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#2e4570'; e.currentTarget.style.color = '#e8f0ff'; }}
            >
              Sign in
            </button>
            <Link to="/" style={{
              padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#000',
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
              transition: 'opacity 0.15s',
            }}>
              Open App <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* Hero content */}
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 800 }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
            borderRadius: 24, padding: '6px 16px', marginBottom: 28,
            fontSize: 12, fontWeight: 700, color: '#fbbf24', letterSpacing: '0.5px',
          }}>
            <Zap size={11} fill="#fbbf24" />
            Live Hypixel SkyBlock Tools — Free
          </div>

          {/* Title */}
          <h1 style={{
            fontSize: 'clamp(42px, 8vw, 88px)',
            fontWeight: 900, lineHeight: 1.05, letterSpacing: '-2px',
            marginBottom: 24,
          }}>
            <span style={{
              background: 'linear-gradient(135deg, #e8f0ff 0%, #a8c0e8 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              display: 'block',
            }}>
              Dominate
            </span>
            <span style={{
              background: 'linear-gradient(135deg, #fbbf24 0%, #fb923c 50%, #fbbf24 100%)',
              backgroundSize: '200% 100%',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              animation: 'text-shimmer 4s ease-in-out infinite',
              display: 'block',
            }}>
              SkyBlock
            </span>
          </h1>

          <p style={{
            fontSize: 'clamp(15px, 2vw, 20px)', color: '#6b85b0', lineHeight: 1.7, marginBottom: 40,
            maxWidth: 580, margin: '0 auto 40px',
          }}>
            The ultimate toolkit for Hypixel SkyBlock players. Track live markets, find
            profit opportunities, optimize your gear — all in one place.
          </p>

          {/* CTA buttons */}
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 64 }}>
            <Link to="/" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '14px 32px', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: 'pointer',
              background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#000',
              textDecoration: 'none', boxShadow: '0 0 32px rgba(251,191,36,0.35)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 0 48px rgba(251,191,36,0.5)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 0 32px rgba(251,191,36,0.35)'; }}
            >
              <LayoutDashboard size={16} /> Open Dashboard
            </Link>
            <button onClick={openAuth} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '14px 32px', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer',
              background: 'rgba(255,255,255,0.05)', border: '1px solid #2e4570', color: '#e8f0ff',
              backdropFilter: 'blur(8px)', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.borderColor = '#60a5fa'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = '#2e4570'; }}
            >
              <User size={16} /> Create Free Account
            </button>
          </div>

          {/* Stats row */}
          <div style={{
            display: 'flex', gap: 0, justifyContent: 'center', flexWrap: 'wrap',
            borderRadius: 16, overflow: 'hidden',
            border: '1px solid #1e2d47',
            background: 'rgba(13,21,37,0.8)', backdropFilter: 'blur(12px)',
            width: 'fit-content', margin: '0 auto',
          }}>
            {STATS.map((s, i) => (
              <div key={s.label} style={{
                padding: '18px 32px', textAlign: 'center',
                borderRight: i < STATS.length - 1 ? '1px solid #1e2d47' : 'none',
              }}>
                <div style={{ fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 900, color: '#fbbf24', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#6b85b0', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll hint */}
        <div style={{
          position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          color: '#3a506e', fontSize: 11, fontWeight: 600, letterSpacing: '0.5px',
          animation: 'bounce-y 2s ease-in-out infinite',
        }}>
          <span>SCROLL</span>
          <ArrowRight size={12} style={{ transform: 'rotate(90deg)' }} />
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────────── */}
      <section style={{ padding: 'clamp(60px, 8vw, 100px) clamp(20px, 5vw, 80px)' }}>
        <SectionTitle
          tag="Everything in one place"
          title="20+ tools, zero guesswork"
          sub="Every tool you need to maximize your coins, skills, and gear — all powered by live data from the Hypixel API."
        />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 20, maxWidth: 1200, margin: '0 auto',
        }}>
          {FEATURE_SECTIONS.map(s => <FeatureCard key={s.label} section={s} />)}
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────────── */}
      <section style={{
        padding: 'clamp(60px, 8vw, 100px) clamp(20px, 5vw, 80px)',
        background: 'rgba(13,21,37,0.5)',
        borderTop: '1px solid #1e2d47', borderBottom: '1px solid #1e2d47',
      }}>
        <SectionTitle
          tag="How it works"
          title="Profit in 3 simple steps"
        />
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 24, maxWidth: 900, margin: '0 auto',
        }}>
          {[
            { n: '01', icon: LayoutDashboard, color: '#60a5fa', title: 'Open any tool', desc: 'Jump straight to the Dashboard or pick a tool from the sidebar — no setup required.' },
            { n: '02', icon: Activity,        color: '#34d399', title: 'Get live data',  desc: 'Every page pulls fresh data from the Hypixel API and AH index, updated every 60 seconds.' },
            { n: '03', icon: Zap,             color: '#fbbf24', title: 'Act fast',       desc: 'Opportunities are highlighted in real time. Filter, sort, and execute before others do.' },
          ].map(step => {
            const StepIcon = step.icon;
            return (
              <div key={step.n} style={{
                padding: '32px 28px', borderRadius: 16,
                background: 'rgba(13,21,37,0.8)', border: '1px solid #1e2d47',
                backdropFilter: 'blur(8px)', position: 'relative', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', top: 16, right: 20,
                  fontSize: 48, fontWeight: 900, color: 'rgba(255,255,255,0.03)', lineHeight: 1,
                  fontFamily: 'monospace',
                }}>
                  {step.n}
                </div>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, marginBottom: 16,
                  background: step.color + '18',
                  border: `1px solid ${step.color}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: step.color,
                }}>
                  <StepIcon size={20} />
                </div>
                <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>{step.title}</div>
                <div style={{ color: '#6b85b0', fontSize: 13, lineHeight: 1.6 }}>{step.desc}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── PREMIUM ──────────────────────────────────────────────────────────── */}
      <section style={{ padding: 'clamp(60px, 8vw, 100px) clamp(20px, 5vw, 80px)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{
            borderRadius: 20,
            background: 'linear-gradient(135deg, rgba(251,191,36,0.07) 0%, rgba(192,132,252,0.05) 50%, rgba(96,165,250,0.04) 100%)',
            border: '1px solid rgba(251,191,36,0.2)',
            padding: 'clamp(32px, 5vw, 56px)',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Background glow blobs */}
            <div style={{ position: 'absolute', top: -60, right: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(251,191,36,0.05)', filter: 'blur(40px)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -40, left: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(192,132,252,0.06)', filter: 'blur(40px)', pointerEvents: 'none' }} />

            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 20,
                background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)',
                borderRadius: 20, padding: '5px 14px',
                fontSize: 11, fontWeight: 800, color: '#fbbf24', letterSpacing: '0.8px', textTransform: 'uppercase',
              }}>
                <Lock size={10} /> Premium Features
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 32, alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: 'clamp(22px, 3.5vw, 34px)', fontWeight: 900, marginBottom: 12, lineHeight: 1.2, letterSpacing: '-0.3px' }}>
                    Unlock the edge that others don't have
                  </h2>
                  <p style={{ color: '#6b85b0', fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
                    Most tools are free forever. Premium unlocks the most powerful features —
                    the ones that can flip your hourly income from millions to hundreds of millions.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {PREMIUM_PERKS.map(perk => {
                      const PIcon = perk.icon;
                      return (
                        <div key={perk.text} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 8, flexShrink: 0, marginTop: 1,
                            background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fbbf24',
                          }}>
                            <PIcon size={13} />
                          </div>
                          <span style={{ fontSize: 13, color: '#a8c0e8', lineHeight: 1.5 }}>{perk.text}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Support card */}
                <div style={{
                  background: 'rgba(6,11,20,0.7)', border: '1px solid rgba(251,191,36,0.15)',
                  borderRadius: 16, padding: '28px 24px', textAlign: 'center',
                  backdropFilter: 'blur(8px)',
                }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>☕</div>
                  <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>Support SkyHelper</div>
                  <p style={{ color: '#6b85b0', fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
                    SkyHelper is free to use. If it helps you make coins, consider supporting
                    development with a Ko-fi donation — it keeps the servers running and new tools coming.
                  </p>
                  <a
                    href="https://ko-fi.com/S6S71VTRIW"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      padding: '12px 28px', borderRadius: 10, fontSize: 14, fontWeight: 800,
                      background: 'linear-gradient(135deg, #fbbf24, #fb923c)', color: '#000',
                      textDecoration: 'none', boxShadow: '0 0 24px rgba(251,191,36,0.3)',
                      transition: 'transform 0.15s, box-shadow 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 0 36px rgba(251,191,36,0.5)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 0 24px rgba(251,191,36,0.3)'; }}
                  >
                    <Heart size={14} fill="currentColor" /> Support on Ko-fi
                  </a>
                  <div style={{ marginTop: 12, fontSize: 11, color: '#3a506e' }}>
                    Any amount helps — thank you! 🙏
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST STRIP ──────────────────────────────────────────────────────── */}
      <section style={{
        padding: '40px clamp(20px, 5vw, 80px)',
        borderTop: '1px solid #1e2d47',
        borderBottom: '1px solid #1e2d47',
        background: 'rgba(13,21,37,0.4)',
      }}>
        <div style={{
          display: 'flex', gap: 40, flexWrap: 'wrap', justifyContent: 'center',
          maxWidth: 900, margin: '0 auto',
        }}>
          {[
            { icon: Shield, text: 'No login required for most features' },
            { icon: Zap,    text: 'Data refreshed every 60 seconds' },
            { icon: Star,   text: 'Covers all major money-making methods' },
            { icon: Heart,  text: 'Built by a SkyBlock player, for players' },
          ].map(item => {
            const IIcon = item.icon;
            return (
              <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#6b85b0', fontSize: 13 }}>
                <IIcon size={14} style={{ color: '#fbbf24', flexShrink: 0 }} />
                {item.text}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────────────── */}
      <section style={{
        padding: 'clamp(60px, 8vw, 100px) clamp(20px, 5vw, 80px)',
        textAlign: 'center',
        background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(251,191,36,0.05) 0%, transparent 60%)',
      }}>
        <h2 style={{
          fontSize: 'clamp(28px, 5vw, 52px)', fontWeight: 900, letterSpacing: '-1px', marginBottom: 16,
          background: 'linear-gradient(135deg, #e8f0ff, #fbbf24)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>
          Ready to make more coins?
        </h2>
        <p style={{ color: '#6b85b0', fontSize: 16, marginBottom: 36 }}>
          Jump in — no account needed to start.
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '14px 36px', borderRadius: 12, fontSize: 15, fontWeight: 800,
            background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#000',
            textDecoration: 'none', boxShadow: '0 0 32px rgba(251,191,36,0.35)',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 0 48px rgba(251,191,36,0.5)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 0 32px rgba(251,191,36,0.35)'; }}
          >
            <LayoutDashboard size={16} /> Open Dashboard
          </Link>
          <button onClick={openAuth} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '14px 28px', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer',
            background: 'rgba(255,255,255,0.04)', border: '1px solid #2e4570', color: '#e8f0ff',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = '#60a5fa'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = '#2e4570'; }}
          >
            <User size={16} /> Sign Up Free
          </button>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer style={{
        padding: '28px clamp(20px, 5vw, 80px)',
        borderTop: '1px solid #1e2d47',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
          <Sword size={15} style={{ color: '#fbbf24' }} />
          <span style={{ color: '#6b85b0' }}>SkyHelper</span>
          <span style={{ color: '#3a506e', fontSize: 11, marginLeft: 4 }}>v4.1</span>
        </div>
        <div style={{ fontSize: 12, color: '#3a506e' }}>
          Not affiliated with Hypixel. SkyBlock data via public Hypixel API.
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#3a506e' }}>
          <Link to="/" style={{ color: '#6b85b0', textDecoration: 'none' }}>Dashboard</Link>
          <Link to="/getting-started" style={{ color: '#6b85b0', textDecoration: 'none' }}>Getting Started</Link>
          <a href="https://ko-fi.com/S6S71VTRIW" target="_blank" rel="noreferrer" style={{ color: '#fbbf24', textDecoration: 'none' }}>Support ☕</a>
        </div>
      </footer>
    </div>
  );
}
