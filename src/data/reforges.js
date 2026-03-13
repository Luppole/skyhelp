// Reforge optimizer static data
// Stats shown are for LEGENDARY rarity (most relevant for end-game players)

export const ITEM_TYPES = [
  { id: 'sword',   label: 'Sword / Melee' },
  { id: 'bow',     label: 'Bow / Ranged' },
  { id: 'armor',   label: 'Armor Set' },
  { id: 'helmet',  label: 'Helmet only' },
];

export const STAT_GOALS = [
  { id: 'crit_damage', label: 'Max Crit Damage' },
  { id: 'strength',    label: 'Max Strength' },
  { id: 'effective_hp', label: 'Max EHP (Defense+HP)' },
  { id: 'intelligence', label: 'Max Intelligence' },
  { id: 'balanced',    label: 'Balanced (all-round)' },
];

// Reforge definitions: id, name, stone, applicable types, stats per rarity
// Stats: str, critDmg, critChance, def, hp, int, speed, atkSpeed
export const REFORGES = {
  sword: [
    {
      id: 'fabled',    name: 'Fabled',    stone: 'Dragon Claw',
      stats: { common: { str:2, critDmg:2, critChance:1 }, uncommon: { str:3, critDmg:3, critChance:2 }, rare: { str:4, critDmg:4, critChance:3 }, epic: { str:5, critDmg:5, critChance:4 }, legendary: { str:7, critDmg:8, critChance:5 } },
      note: 'Best all-round DPS sword reforge',
    },
    {
      id: 'withered',  name: 'Withered',  stone: 'Precursor Gear',
      stats: { common: { str:3, critDmg:2 }, uncommon: { str:4, critDmg:3 }, rare: { str:5, critDmg:5 }, epic: { str:7, critDmg:7 }, legendary: { str:10, critDmg:10 } },
      note: 'Necromancer/Dungeon build favorite',
    },
    {
      id: 'spicy',     name: 'Spicy',     stone: 'Hot Stuff',
      stats: { common: { str:1, critDmg:1 }, uncommon: { str:2, critDmg:2 }, rare: { str:3, critDmg:3 }, epic: { str:4, critDmg:4 }, legendary: { str:5, critDmg:5, atkSpeed:1 } },
      note: 'Cheap option for mid-game',
    },
    {
      id: 'heroic',    name: 'Heroic',    stone: 'Onyx',
      stats: { common: { str:1, int:10 }, uncommon: { str:2, int:15 }, rare: { str:3, int:20 }, epic: { str:4, int:30 }, legendary: { str:5, int:50 } },
      note: 'Int + Str hybrid — good for mage builds',
    },
    {
      id: 'sharp',     name: 'Sharp',     stone: null,
      stats: { common: { critDmg:1 }, uncommon: { critDmg:2 }, rare: { critDmg:3 }, epic: { critDmg:5 }, legendary: { critDmg:8 } },
      note: 'Pure crit damage, free to reforge',
    },
    {
      id: 'spiritual', name: 'Spiritual', stone: 'Spirit Stone',
      stats: { common: { int:5 }, uncommon: { int:10 }, rare: { int:20 }, epic: { int:40 }, legendary: { int:100 } },
      note: 'Pure intelligence, mage only',
    },
  ],
  bow: [
    {
      id: 'deadly',    name: 'Deadly',    stone: null,
      stats: { common: { critChance:1 }, uncommon: { critChance:2 }, rare: { critChance:3 }, epic: { critChance:5 }, legendary: { critChance:8 } },
      note: 'Crit chance for archers',
    },
    {
      id: 'fabled',    name: 'Fabled',    stone: 'Dragon Claw',
      stats: { common: { str:2, critDmg:2, critChance:1 }, uncommon: { str:3, critDmg:3, critChance:2 }, rare: { str:4, critDmg:4, critChance:3 }, epic: { str:5, critDmg:5, critChance:4 }, legendary: { str:7, critDmg:8, critChance:5 } },
      note: 'Best overall bow reforge',
    },
    {
      id: 'sniper',    name: 'Sniper',    stone: 'Sniper Lense',
      stats: { common: { critDmg:3 }, uncommon: { critDmg:5 }, rare: { critDmg:7 }, epic: { critDmg:10 }, legendary: { critDmg:15 } },
      note: 'Max crit damage for ranged',
    },
  ],
  armor: [
    {
      id: 'ancient',   name: 'Ancient',   stone: 'Precursor Gear',
      stats: { common: { str:1, critDmg:2 }, uncommon: { str:2, critDmg:3 }, rare: { str:3, critDmg:5 }, epic: { str:5, critDmg:7 }, legendary: { str:7, critDmg:10 } },
      note: 'Top DPS armor reforge — best for damage dealers',
    },
    {
      id: 'renowned',  name: 'Renowned',  stone: 'Dragon Horn',
      stats: { common: { str:1, def:1, hp:5, speed:1 }, uncommon: { str:2, def:2, hp:10, speed:1 }, rare: { str:3, def:3, hp:15, speed:2 }, epic: { str:4, def:4, hp:25, speed:2 }, legendary: { str:5, def:5, hp:40, speed:3 } },
      note: 'Balanced offensive armor reforge',
    },
    {
      id: 'giant',     name: 'Giant',     stone: "Giant's Sword",
      stats: { common: { def:5, hp:20 }, uncommon: { def:10, hp:35 }, rare: { def:20, hp:50 }, epic: { def:30, hp:70 }, legendary: { def:40, hp:100 } },
      note: 'Best defensive/tank reforge',
    },
    {
      id: 'fierce',    name: 'Fierce',    stone: 'Dragon Claw',
      stats: { common: { str:1, critDmg:1 }, uncommon: { str:2, critDmg:2 }, rare: { str:3, critDmg:4 }, epic: { str:4, critDmg:6 }, legendary: { str:6, critDmg:8 } },
      note: 'Damage-focused, cheaper than Ancient',
    },
    {
      id: 'wise',      name: 'Wise',      stone: "Witch's Broom",
      stats: { common: { int:5, def:1 }, uncommon: { int:10, def:2 }, rare: { int:20, def:4 }, epic: { int:35, def:6 }, legendary: { int:50, def:8 } },
      note: 'Mage armor reforge — int + defense',
    },
    {
      id: 'necrotic',  name: 'Necrotic', stone: 'Precursor Gear',
      stats: { common: { int:5 }, uncommon: { int:10 }, rare: { int:20 }, epic: { int:35 }, legendary: { int:60 } },
      note: 'Full set: +120 Int — pure mage',
    },
    {
      id: 'titanic',   name: 'Titanic',   stone: 'Titanium-infused',
      stats: { common: { def:5, hp:25 }, uncommon: { def:10, hp:50 }, rare: { def:15, hp:80 }, epic: { def:20, hp:120 }, legendary: { def:25, hp:170 } },
      note: 'HP-focused tank reforge',
    },
  ],
};

// Stone costs (approximate bazaar/AH prices in coins)
export const STONE_COSTS = {
  'Dragon Claw':      2_500_000,
  'Precursor Gear':   8_000_000,
  'Dragon Horn':      3_000_000,
  "Giant's Sword":    5_000_000,
  "Witch's Broom":    500_000,
  'Spirit Stone':     1_200_000,
  'Onyx':             4_000_000,
  'Hot Stuff':        200_000,
  'Sniper Lense':     600_000,
  'Titanium-infused': 1_500_000,
};

const STAT_SCORE_WEIGHTS = {
  crit_damage:  { critDmg: 1.5, str: 1.0, critChance: 0.5 },
  strength:     { str: 2.0, critDmg: 0.5, atkSpeed: 0.3 },
  effective_hp: { def: 1.5, hp: 0.01 },
  intelligence: { int: 1.5, str: 0.2 },
  balanced:     { str: 1.0, critDmg: 1.0, def: 0.5, hp: 0.005, int: 0.3 },
};

export function scoreReforge(reforge, rarity, goal) {
  const stats = reforge.stats[rarity] || reforge.stats.legendary || {};
  const weights = STAT_SCORE_WEIGHTS[goal] || STAT_SCORE_WEIGHTS.balanced;
  let score = 0;
  for (const [stat, w] of Object.entries(weights)) {
    score += (stats[stat] || 0) * w;
  }
  return Math.round(score * 100) / 100;
}

export function getBestReforges(itemType, rarity, goal) {
  const list = REFORGES[itemType] || [];
  return list
    .map(r => ({ ...r, score: scoreReforge(r, rarity, goal) }))
    .sort((a, b) => b.score - a.score);
}
