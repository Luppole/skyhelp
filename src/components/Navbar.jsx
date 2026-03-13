import { NavLink } from 'react-router-dom';
import { TrendingUp, Gavel, User, Calculator, Sword } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/',           label: 'Bazaar',        Icon: TrendingUp },
  { to: '/auctions',   label: 'Auction House', Icon: Gavel      },
  { to: '/player',     label: 'Player Stats',  Icon: User       },
  { to: '/calculators',label: 'Calculators',   Icon: Calculator },
];

export default function Navbar() {
  return (
    <nav className="navbar">
      <span className="navbar__brand">
        <Sword size={18} />
        SkyBlock Tools
      </span>
      <div className="navbar__links">
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `navbar__link${isActive ? ' navbar__link--active' : ''}`}
          >
            <Icon size={15} />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
