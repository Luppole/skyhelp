import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

/**
 * Shows "Updated Xs ago" that ticks every second.
 * Pass `lastFetchedAt` (ms timestamp) from useFetch.
 * Renders nothing if lastFetchedAt is null.
 */
export default function DataAge({ lastFetchedAt }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!lastFetchedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [lastFetchedAt]);

  if (!lastFetchedAt) return null;

  const secs = Math.floor((now - lastFetchedAt) / 1000);
  const label =
    secs < 5  ? 'just now' :
    secs < 60 ? `${secs}s ago` :
    `${Math.floor(secs / 60)}m ago`;

  return (
    <span
      className="text-muted"
      style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
      title={new Date(lastFetchedAt).toLocaleTimeString()}
    >
      <Clock size={11} />
      Updated {label}
    </span>
  );
}
