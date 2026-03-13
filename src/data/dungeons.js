// Dungeon floor static data for Dungeon Profit Calculator
// Avg drop values are community estimates in coins

export const FLOORS = [
  { id: 'F1', name: 'F1 – The Entrance',       mode: 'normal', avgDropValue: 55_000,    avgTimeSec: 120,  cataReq: 0,  noteworthy: 'Starter floor' },
  { id: 'F2', name: 'F2 – The Caverns',         mode: 'normal', avgDropValue: 110_000,   avgTimeSec: 180,  cataReq: 0,  noteworthy: 'Early essence farm' },
  { id: 'F3', name: 'F3 – The Mines',           mode: 'normal', avgDropValue: 160_000,   avgTimeSec: 240,  cataReq: 0,  noteworthy: 'Flail drops begin' },
  { id: 'F4', name: 'F4 – The Catacombs',       mode: 'normal', avgDropValue: 250_000,   avgTimeSec: 300,  cataReq: 0,  noteworthy: 'Best XP/time for low cata' },
  { id: 'F5', name: 'F5 – Precursor Ruins',     mode: 'normal', avgDropValue: 450_000,   avgTimeSec: 420,  cataReq: 16, noteworthy: 'Juju shortbow farm' },
  { id: 'F6', name: 'F6 – The Warden Quarter',  mode: 'normal', avgDropValue: 700_000,   avgTimeSec: 600,  cataReq: 24, noteworthy: 'Shadow Assassin drops' },
  { id: 'F7', name: 'F7 – The Throne Room',     mode: 'normal', avgDropValue: 2_800_000, avgTimeSec: 900,  cataReq: 30, noteworthy: 'Necron set, Hyperion (RNG)' },
  { id: 'M1', name: 'M1 – Master Entrance',     mode: 'master', avgDropValue: 600_000,   avgTimeSec: 300,  cataReq: 30, noteworthy: '1st master floor' },
  { id: 'M2', name: 'M2 – Master Caverns',      mode: 'master', avgDropValue: 900_000,   avgTimeSec: 420,  cataReq: 30, noteworthy: 'Good essence/coins ratio' },
  { id: 'M3', name: 'M3 – Master Mines',        mode: 'master', avgDropValue: 1_200_000, avgTimeSec: 540,  cataReq: 30, noteworthy: 'Consistent returns' },
  { id: 'M4', name: 'M4 – Master Catacombs',    mode: 'master', avgDropValue: 1_700_000, avgTimeSec: 660,  cataReq: 35, noteworthy: 'Popular endgame floor' },
  { id: 'M5', name: 'M5 – Master Precursor',    mode: 'master', avgDropValue: 2_300_000, avgTimeSec: 780,  cataReq: 35, noteworthy: 'High efficiency' },
  { id: 'M6', name: 'M6 – Master Warden',       mode: 'master', avgDropValue: 4_000_000, avgTimeSec: 1200, cataReq: 40, noteworthy: 'Necron armor shards' },
  { id: 'M7', name: 'M7 – Master Throne',       mode: 'master', avgDropValue: 7_000_000, avgTimeSec: 1680, cataReq: 40, noteworthy: 'Highest value, very RNG' },
];

// Chest costs (S+ score) per floor type [wood, iron, gold, diamond] = coin cost
export const CHEST_COSTS = {
  F1: [0,     500,   3000,   8000],
  F2: [0,     1000,  6000,  15000],
  F3: [0,     2000, 10000,  25000],
  F4: [0,     3000, 15000,  35000],
  F5: [0,     5000, 25000,  60000],
  F6: [0,    10000, 50000, 120000],
  F7: [0,    20000, 90000, 200000],
  M1: [0,    10000, 45000, 100000],
  M2: [0,    15000, 60000, 130000],
  M3: [0,    20000, 75000, 160000],
  M4: [0,    25000, 90000, 180000],
  M5: [0,    30000,100000, 200000],
  M6: [0,    50000,150000, 300000],
  M7: [0,    80000,200000, 400000],
};

export const CHEST_LABELS = ['Wood (Free)', 'Iron', 'Gold', 'Diamond'];

export const KEY_TYPES = [
  { id: 'none',      label: 'No key',              scoreMult: 0.7  },
  { id: 'fairy',     label: 'Fairy key (any chest)',scoreMult: 1.0  },
  { id: 'dungeon',   label: 'Dungeon key (1 open)', scoreMult: 1.0  },
];

/**
 * Calculate dungeon run profit.
 */
export function calcDungeonProfit({ floor, chestTier, runsPerHour, openChest }) {
  const costs = CHEST_COSTS[floor.id] || [0, 0, 0, 0];
  const chestCost = openChest ? (costs[chestTier] || 0) : 0;
  const grossPerRun = floor.avgDropValue;
  const netPerRun = grossPerRun - chestCost;
  const coinsPerHour = netPerRun * runsPerHour;
  return {
    grossPerRun,
    chestCost,
    netPerRun,
    runsPerHour,
    coinsPerHour: Math.round(coinsPerHour),
  };
}
