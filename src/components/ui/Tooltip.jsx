import { useState, useRef } from 'react';

export default function Tooltip({ children, content, placement = 'top' }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  if (!content) return children;

  return (
    <span
      ref={ref}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span style={{
          position: 'absolute',
          [placement === 'top' ? 'bottom' : 'top']: 'calc(100% + 6px)',
          left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-3)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '6px 10px',
          fontSize: 12,
          color: 'var(--text)',
          whiteSpace: 'normal',
          zIndex: 1000,
          pointerEvents: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          animation: 'fade-in 0.12s ease',
          maxWidth: 280,
          textAlign: 'center',
        }}>
          {content}
        </span>
      )}
    </span>
  );
}
