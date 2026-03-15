import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import KoFiCorner from './components/KoFiCorner';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { AuthProvider } from './components/AuthProvider';
import { useTrackPage } from './hooks/useTrackPage';

const Landing          = lazy(() => import('./components/Landing'));
const Dashboard        = lazy(() => import('./components/Dashboard'));
const Bazaar           = lazy(() => import('./components/Bazaar'));
const AuctionHouse     = lazy(() => import('./components/AuctionHouse'));
const PlayerStats      = lazy(() => import('./components/PlayerStats'));
const Calculators      = lazy(() => import('./components/Calculators'));
const AHSniper         = lazy(() => import('./components/AHSniper'));
const PriceAlerts      = lazy(() => import('./components/PriceAlerts'));
const SkillPlanner     = lazy(() => import('./components/SkillPlanner'));
const MinionCalc       = lazy(() => import('./components/MinionCalc'));
const ReforgeOptimizer = lazy(() => import('./components/ReforgeOptimizer'));
const MayorTracker     = lazy(() => import('./components/MayorTracker'));
const DungeonProfit    = lazy(() => import('./components/DungeonProfit'));
const SlayerDashboard  = lazy(() => import('./components/SlayerDashboard'));
const CraftChain       = lazy(() => import('./components/CraftChain'));
const ShardFusion      = lazy(() => import('./components/ShardFusion'));
const NetWorth         = lazy(() => import('./components/NetWorth'));
const SystemStatus     = lazy(() => import('./components/SystemStatus'));
const Portfolio        = lazy(() => import('./components/Portfolio'));
const Account          = lazy(() => import('./components/Account'));
const GettingStarted   = lazy(() => import('./components/GettingStarted'));
const FarmingUpgrades  = lazy(() => import('./components/FarmingUpgrades'));
const RNGCalculator    = lazy(() => import('./components/RNGCalculator'));
const MoneyMethods     = lazy(() => import('./components/MoneyMethods'));

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
  '/farming':         'Farming Optimizer',
  '/rng':             'RNG Drop Calculator',
  '/money':           'Money Methods',
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
          <Suspense fallback={<div className="page-loading" aria-live="polite">Loading…</div>}>
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
            <Route path="/farming"     element={<FarmingUpgrades />} />
            <Route path="/rng"         element={<RNGCalculator />} />
            <Route path="/money"       element={<MoneyMethods />} />
            <Route path="*"            element={<NotFound />} />
          </Routes>
          </Suspense>
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
          <Suspense fallback={<div className="page-loading" aria-live="polite">Loading…</div>}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="*" element={<AppShell />} />
          </Routes>
          </Suspense>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}
