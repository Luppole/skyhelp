import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, ChevronRight } from 'lucide-react';
import { NAV_SECTIONS, NAV_ITEMS } from './navConfig';
import { useSupabaseUser } from '../hooks/useSupabaseUser';
import { useAuthModal } from './AuthProvider';

const PAGE_TITLES = NAV_ITEMS.reduce((acc, item) => {
  acc[item.to] = item.label;
  return acc;
}, {});

export default function MobileNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { user } = useSupabaseUser();
  const { openAuth } = useAuthModal();

  const currentTitle = PAGE_TITLES[pathname] ?? 'Dashboard';

  const [filter, setFilter] = useState('');
  const groupedItems = useMemo(() => {
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
    <>
      <div className="mobile-nav">
        <button
          className="btn-icon"
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu size={18} />
        </button>
        <div className="mobile-nav__title">SkyHelper</div>
        <select
          className="mobile-nav__select"
          value={pathname}
          onChange={e => navigate(e.target.value)}
          aria-label="Quick page switcher"
        >
          {NAV_ITEMS.map(item => (
            <option key={item.to} value={item.to}>
              {item.label}
            </option>
          ))}
        </select>
        <div className="mobile-nav__current">{currentTitle}</div>
      </div>

      {open && (
        <div className="mobile-nav__overlay" onClick={() => setOpen(false)}>
          <div
            className="mobile-nav__panel"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
          >
            <div className="mobile-nav__panel-header">
              <div className="mobile-nav__panel-title">Navigate</div>
              <button className="btn-icon" onClick={() => setOpen(false)} aria-label="Close navigation menu">
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: 10 }}>
              <input
                type="text"
                placeholder="Filter tools..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
                style={{ width: '100%' }}
                aria-label="Filter navigation items"
              />
            </div>

            <div className="mobile-nav__sections">
              {groupedItems.map(section => (
                <div key={section.label} className="mobile-nav__section">
                  <div className="mobile-nav__section-title">{section.label}</div>
                  <div className="mobile-nav__section-items">
                    {section.items.map(({ to, label, Icon, badge }) => (
                      <button
                        key={to}
                        className={`mobile-nav__item${pathname === to ? ' mobile-nav__item--active' : ''}`}
                        onClick={() => {
                          navigate(to);
                          setOpen(false);
                        }}
                      >
                        <Icon size={16} />
                        <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
                        {badge && <span className="mobile-nav__badge">{badge}</span>}
                        <ChevronRight size={14} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16 }}>
              <button className="btn-secondary btn-sm" onClick={openAuth}>
                {user ? 'Account' : 'Sign in'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
