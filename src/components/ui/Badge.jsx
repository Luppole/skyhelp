const VARIANTS = {
  gold:    { bg: 'rgba(245,197,24,0.15)',  color: 'var(--gold)',   border: 'rgba(245,197,24,0.3)' },
  green:   { bg: 'rgba(63,185,80,0.15)',   color: 'var(--green)',  border: 'rgba(63,185,80,0.3)' },
  red:     { bg: 'rgba(248,81,73,0.15)',   color: 'var(--red)',    border: 'rgba(248,81,73,0.3)' },
  blue:    { bg: 'rgba(88,166,255,0.15)',  color: 'var(--blue)',   border: 'rgba(88,166,255,0.3)' },
  purple:  { bg: 'rgba(188,140,255,0.15)', color: 'var(--purple)', border: 'rgba(188,140,255,0.3)' },
  muted:   { bg: 'rgba(139,148,158,0.12)', color: 'var(--text-muted)', border: 'rgba(139,148,158,0.2)' },
};

export default function Badge({ children, variant = 'muted', size = 'sm', pulse = false }) {
  const s = VARIANTS[variant] || VARIANTS.muted;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: size === 'sm' ? '2px 8px' : '4px 12px',
      borderRadius: 20,
      background: s.bg,
      color: s.color,
      border: `1px solid ${s.border}`,
      fontSize: size === 'sm' ? 11 : 13,
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {pulse && (
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: s.color,
          animation: 'pulse-dot 1.5s ease-in-out infinite',
        }} />
      )}
      {children}
    </span>
  );
}
