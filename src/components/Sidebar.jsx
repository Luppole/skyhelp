import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Sword } from 'lucide-react';
import { NAV_SECTIONS } from './navConfig';
import { useSupabaseUser } from '../hooks/useSupabaseUser';
import { useAuthModal } from './AuthProvider';

export default function Sidebar() {
  const [filter, setFilter] = useState('');
  const { user } = useSupabaseUser();
  const { openAuth } = useAuthModal();
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return NAV_SECTIONS;
    return NAV_SECTIONS
      .map(section => ({
        ...section,
        items: section.items.filter(i => i.label.toLowerCase().includes(q)),
      }))
      .filter(section => section.items.length > 0);
  }, [filter]);

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <Sword size={18} className="sidebar__brand-icon" />
        SkyHelper
      </div>

      <div style={{ padding: '10px 14px 4px' }}>
        <input
          type="text"
          placeholder="Filter tools..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ width: '100%' }}
        />
      </div>

      <nav className="sidebar__nav">
        {filtered.map(section => (
          <div key={section.label}>
            <div className="sidebar__section">{section.label}</div>
            {section.items.map(({ to, label, Icon, badge }) => (
              <NavLink
                key={to}
                to={to}
                end
                className={({ isActive }) =>
                  `sidebar__link${isActive ? ' sidebar__link--active' : ''}`
                }
              >
                <Icon size={15} />
                <span style={{ flex: 1 }}>{label}</span>
                {badge && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      background: 'var(--gold)',
                      color: '#000',
                      padding: '1px 5px',
                      borderRadius: 3,
                      letterSpacing: '0.3px',
                    }}
                  >
                    {badge}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar__footer">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn-secondary btn-sm" onClick={openAuth}>
            {user ? 'Account' : 'Sign in'}
          </button>
          <div>v4.1 - SkyHelper</div>
        </div>
      </div>
    </aside>
  );
}
