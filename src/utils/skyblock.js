/**
 * Client-side SkyBlock constants and math.
 * Mirrors backend/utils/calculators.py — no network required.
 */

const SELL_TAX = 0.0125;

// ── Calculators ────────────────────────────────────────────────────────────

export function calcBazaarFlip(buyPrice, sellPrice, quantity, useBuyOrder = true) {
  const effectiveBuy  = Number(buyPrice);
  const effectiveSell = Number(sellPrice) * (1 - SELL_TAX);
  const profitPer     = effectiveSell - effectiveBuy;
  const totalInvested = effectiveBuy * quantity;
  const totalProfit   = profitPer * quantity;
  const roiPct        = totalInvested ? (totalProfit / totalInvested) * 100 : 0;
  return {
    buy_price:       effectiveBuy,
    sell_price:      Number(sellPrice),
    effective_sell:  r2(effectiveSell),
    profit_per_item: r2(profitPer),
    quantity:        Number(quantity),
    total_invested:  r2(totalInvested),
    total_profit:    r2(totalProfit),
    roi_pct:         r2(roiPct),
  };
}

export function calcCraftProfit(craftCost, sellPrice, quantity) {
  const effectiveSell = Number(sellPrice) * (1 - SELL_TAX);
  const profitPer     = effectiveSell - Number(craftCost);
  const totalProfit   = profitPer * quantity;
  const roiPct        = craftCost ? (profitPer / craftCost) * 100 : 0;
  return {
    craft_cost:      Number(craftCost),
    sell_price:      Number(sellPrice),
    effective_sell:  r2(effectiveSell),
    profit_per_item: r2(profitPer),
    quantity:        Number(quantity),
    total_profit:    r2(totalProfit),
    roi_pct:         r2(roiPct),
  };
}

export function calcEnchantingROI(basePricePerBook, targetLevel, finalSellPrice) {
  const booksNeeded   = Math.pow(2, targetLevel - 1);
  const totalCost     = booksNeeded * Number(basePricePerBook);
  const effectiveSell = Number(finalSellPrice) * (1 - SELL_TAX);
  const profit        = effectiveSell - totalCost;
  const roiPct        = totalCost ? (profit / totalCost) * 100 : 0;
  return {
    books_needed:    booksNeeded,
    total_cost:      r2(totalCost),
    effective_sell:  r2(effectiveSell),
    profit:          r2(profit),
    roi_pct:         r2(roiPct),
  };
}

function r2(n) { return Math.round(n * 100) / 100; }

// ── XP tables ──────────────────────────────────────────────────────────────

export const SKILL_XP_TABLE = [
  0, 50, 175, 375, 675, 1175, 1925, 2925, 4425, 6425, 9925,
  14925, 22425, 32425, 47425, 67425, 97425, 147425, 222425, 322425, 522425,
  822425, 1222425, 1722425, 2322425, 3022425, 3822425, 4722425, 5722425,
  6822425, 8022425, 9322425, 10722425, 12222425, 13822425, 15522425,
  17322425, 19222425, 21222425, 23322425, 25522425, 27822425, 30222425,
  32722425, 35322425, 38072425, 40972425, 44072425, 47472425, 51172425,
  55172425, 59472425, 64072425, 68972425, 74172425, 79672425, 85472425,
  91572425, 97972425, 104672425,
];

export const DUNGEON_XP_TABLE = [
  0, 50, 125, 235, 395, 625, 955, 1425, 2095, 3045, 4385, 6275, 8940,
  12700, 17960, 25340, 35640, 50040, 70040, 97640, 135640, 188140, 259640,
  356640, 488640, 668640, 911640, 1239640, 1684640, 2284640, 3084640,
  4149640, 5559640, 7459640, 9959640, 13259640, 17559640, 23159640,
  30359640, 39559640, 51559640,
];

export const SKILL_NAMES = [
  'farming', 'mining', 'combat', 'foraging', 'fishing',
  'enchanting', 'alchemy', 'carpentry', 'runecrafting', 'social',
];

export function xpToLevel(xp, table = SKILL_XP_TABLE) {
  let level = 0;
  for (let i = 0; i < table.length; i++) {
    if (xp >= table[i]) level = i;
    else break;
  }
  const atMax     = level >= table.length - 1;
  const currentXp = xp - table[level];
  const nextXp    = atMax ? 0 : table[level + 1] - table[level];
  const progress  = atMax ? 100 : (currentXp / nextXp) * 100;
  const xpToNext  = atMax ? 0 : nextXp - currentXp;
  return {
    level,
    progress:  Math.round(progress * 10) / 10,
    xpToNext:  Math.round(xpToNext),
    atMax,
  };
}

// ── Rarity ─────────────────────────────────────────────────────────────────

export function rarityClass(tier) {
  const map = {
    COMMON: 'rarity-common', UNCOMMON: 'rarity-uncommon', RARE: 'rarity-rare',
    EPIC: 'rarity-epic', LEGENDARY: 'rarity-legendary',
    MYTHIC: 'rarity-mythic', SPECIAL: 'rarity-special',
  };
  return map[tier] || 'rarity-common';
}
