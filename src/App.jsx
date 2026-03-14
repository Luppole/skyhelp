import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import KoFiCorner from './components/KoFiCorner';
import Landing from './components/Landing';
import Dashboard from './components/Dashboard';
import Bazaar from './components/Bazaar';
import AuctionHouse from './components/AuctionHouse';
import PlayerStats from './components/PlayerStats';
import Calculators from './components/Calculators';
import AHSniper from './components/AHSniper';
import PriceAlerts from './components/PriceAlerts';
import SkillPlanner from './components/SkillPlanner';
import MinionCalc from './components/MinionCalc';
import ReforgeOptimizer from './components/ReforgeOptimizer';
import MayorTracker from './components/MayorTracker';
import DungeonProfit from './components/DungeonProfit';
import SlayerDashboard from './components/SlayerDashboard';
import CraftChain from './components/CraftChain';
import ShardFusion from './components/ShardFusion';
import NetWorth from './components/NetWorth';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { AuthProvider } from './components/AuthProvider';
import SystemStatus from './components/SystemStatus';
import Portfolio from './components/Portfolio';
import Account from './components/Account';
import GettingStarted from './components/GettingStarted';
import { useTrackPage } from './hooks/useTrackPage';

const PAGE_TITLES = {
  '/':            'SkyHelper — The Ultimate SkyBlock Companion',
  '/dashboard':   'Dashboard',
  '/bazaar':      'Bazaar Flip Finder',
  '/auctions':    'Auction House',
  '/player':      'Player Stats',
  '/calculators': 'Calculators',
  '/sniper':      'AH Flip Sniper',
  '/alerts':      'Price Alerts',
  '/planner':     'Skill Planner',
  '/minions':     'Minion Calculator',
  '/reforge':     'Reforge Optimizer',
  '/mayor':       'Mayor and Events',
  '/dungeons':    'Dungeon Profit',
  '/slayer':      'Slayer Dashboard',
  '/craft-chain': 'Craft Flips',
  '/shards':      'Shard Fusion Sniper',
  '/networth':    'Net Worth',
  '/status':      'System Status',
  '/portfolio':   'Portfolio',
  '/account':     'Account',
  '/getting-started': 'Getting Started',
};

function TitleSync() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = `${PAGE_TITLES[pathname] ?? 'Not Found'} - SkyHelper`;
  }, [pathname]);
  useTrackPage();
  return null;
}

function NotFound() {
  return (
    <div className="page" style={{ textAlign: 'center', paddingTop: 80 }}>
      <div className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
        <div className="card__title" style={{ justifyContent: 'center' }}>
          404 - Page Not Found
        </div>
        <p className="text-muted">This page does not exist.</p>
      </div>
    </div>
  );
}

function AppShell() {
  return (
    <>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <MobileNav />
      <KoFiCorner />
      <div className="app-shell">
        <Sidebar />
        <main id="main-content" className="app-main" role="main">
          <Routes>
            <Route path="/dashboard"   element={<Dashboard />} />
            <Route path="/bazaar"      element={<Bazaar />} />
            <Route path="/auctions"    element={<AuctionHouse />} />
            <Route path="/player"      element={<PlayerStats />} />
            <Route path="/calculators" element={<Calculators />} />
            <Route path="/sniper"      element={<AHSniper />} />
            <Route path="/alerts"      element={<PriceAlerts />} />
            <Route path="/planner"     element={<SkillPlanner />} />
            <Route path="/minions"     element={<MinionCalc />} />
            <Route path="/reforge"     element={<ReforgeOptimizer />} />
            <Route path="/mayor"       element={<MayorTracker />} />
            <Route path="/dungeons"    element={<DungeonProfit />} />
            <Route path="/slayer"      element={<SlayerDashboard />} />
            <Route path="/craft-chain" element={<CraftChain />} />
            <Route path="/shards"      element={<ShardFusion />} />
            <Route path="/networth"    element={<NetWorth />} />
            <Route path="/status"      element={<SystemStatus />} />
            <Route path="/portfolio"   element={<Portfolio />} />
            <Route path="/account"     element={<Account />} />
            <Route path="/getting-started" element={<GettingStarted />} />
            <Route path="*"            element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <TitleSync />
      <AuthProvider>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="*" element={<AppShell />} />
          </Routes>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}
