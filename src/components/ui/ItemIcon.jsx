import { useState } from 'react';
import { getAhIconUrl, getItemIconUrl } from '../../utils/items';

export default function ItemIcon({ itemId, name, size = 24, kind = 'bazaar' }) {
  const [failed, setFailed] = useState(false);
  const url = kind === 'ah' ? getAhIconUrl(itemId) : getItemIconUrl(itemId);
  const fallback = (name || itemId || '?').slice(0, 1).toUpperCase();

  if (!url || failed) {
    return (
      <div style={{
        width: size,
        height: size,
        borderRadius: 6,
        background: 'var(--bg-4)',
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        color: 'var(--text-muted)',
      }}>
        {fallback}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={name || itemId}
      width={size}
      height={size}
      style={{ borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-4)' }}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}
