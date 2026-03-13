/** Animated loading placeholders. */

export function SkeletonLine({ width = '100%', height = 14 }) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius: 4 }}
    />
  );
}

export function SkeletonCard({ rows = 4 }) {
  return (
    <div className="card skeleton-card">
      <SkeletonLine width="40%" height={16} />
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <SkeletonLine width="45%" />
            <SkeletonLine width="30%" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 8, cols = 6 }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}><SkeletonLine width={i === 0 ? 24 : 80} height={10} /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c}><SkeletonLine width={c === 0 ? '100%' : `${60 + Math.random() * 30}%`} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
