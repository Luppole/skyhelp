import {
  LayoutDashboard, TrendingUp, Gavel, User, Calculator,
  Sword, Target, Bell, BookOpen, Cpu, Hammer,
  Vote, Skull, Swords, GitBranch, Wallet, Layers, Activity,
  Compass, UserCircle, Sparkles, Sprout, Dice6, DollarSign,
} from 'lucide-react';

export const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard',     Icon: LayoutDashboard },
      { to: '/status',  label: 'System Status', Icon: Activity },
      { to: '/getting-started', label: 'Getting Started', Icon: Compass },
    ],
  },
  {
    label: 'Markets',
    items: [
      { to: '/bazaar',   label: 'Bazaar',        Icon: TrendingUp },
      { to: '/sniper',   label: 'AH Sniper',     Icon: Target, badge: 'HOT' },
      { to: '/auctions', label: 'Auction House', Icon: Gavel },
    ],
  },
  {
    label: 'Money Makers',
    items: [
      { to: '/rng',         label: 'RNG Calculator', Icon: Dice6,       badge: 'NEW' },
      { to: '/money',       label: 'Money Methods',  Icon: DollarSign },
      { to: '/minions',     label: 'Minion Calc',    Icon: Cpu },
      { to: '/craft-chain', label: 'Craft Flips',    Icon: GitBranch },
      { to: '/shards',      label: 'Shard Fusion',   Icon: Sparkles, badge: '💎' },
      { to: '/dungeons',    label: 'Dungeons',       Icon: Skull },
      { to: '/slayer',      label: 'Slayer',         Icon: Swords },
    ],
  },
  {
    label: 'Player Tools',
    items: [
      { to: '/player',   label: 'Player Stats', Icon: User },
      { to: '/networth', label: 'Net Worth',    Icon: Wallet },
      { to: '/portfolio',label: 'Portfolio',    Icon: Layers },
      { to: '/planner',  label: 'Skill Planner',Icon: BookOpen },
      { to: '/account',  label: 'Account',      Icon: UserCircle },
    ],
  },
  {
    label: 'Optimizers',
    items: [
      { to: '/farming',     label: 'Farming',        Icon: Sprout, badge: 'NEW' },
      { to: '/calculators', label: 'Calculators',    Icon: Calculator },
      { to: '/reforge',     label: 'Reforge',        Icon: Hammer },
      { to: '/alerts',      label: 'Price Alerts',   Icon: Bell },
      { to: '/mayor',       label: 'Mayor & Events', Icon: Vote },
    ],
  },
];

export const NAV_ITEMS = NAV_SECTIONS.flatMap(section => section.items);
