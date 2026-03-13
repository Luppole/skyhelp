// Minion static data for Minion Profit Calculator
// Tier delays in seconds (time between actions): T1-T12
export const TIER_DELAYS = [26, 24, 22, 20, 18, 16, 14, 12, 10, 8, 6, 4];

export const FUELS = [
  { id: 'none',       label: 'No Fuel',          speedMult: 1.0,  costPerDay: 0 },
  { id: 'coal',       label: 'Coal',             speedMult: 1.25, costPerDay: 2000 },
  { id: 'coal_block', label: 'Block of Coal',    speedMult: 1.5,  costPerDay: 15000 },
  { id: 'foul_flesh', label: 'Foul Flesh',       speedMult: 2.0,  costPerDay: 45000 },
  { id: 'catalyst',   label: 'Ender Catalyst',   speedMult: 3.0,  costPerDay: 120000 },
  { id: 'plasma',     label: 'Plasma Bucket',    speedMult: 4.0,  costPerDay: 350000 },
];

export const STORAGES = [
  { id: 'none',   label: 'No Storage',    slots: 0  },
  { id: 'small',  label: 'Small Chest',   slots: 27 },
  { id: 'medium', label: 'Medium Chest',  slots: 54 },
  { id: 'large',  label: 'Large Chest',   slots: 108 },
  { id: 'mega',   label: 'Mega Storage',  slots: 216 },
  { id: 'greater_backpack', label: 'Greater Backpack', slots: 36 },
];

// Each minion: id, name, emoji, category, bazaarId (bazaar product key for price lookup), outputPerAction
export const MINIONS = [
  // Farming
  { id: 'SUGAR_CANE',    name: 'Sugar Cane',    emoji: '🌿', category: 'Farming',   bazaarId: 'SUGAR_CANE',    outputPerAction: 1 },
  { id: 'WHEAT',         name: 'Wheat',         emoji: '🌾', category: 'Farming',   bazaarId: 'WHEAT',         outputPerAction: 1 },
  { id: 'CARROT',        name: 'Carrot',        emoji: '🥕', category: 'Farming',   bazaarId: 'CARROT_ITEM',   outputPerAction: 1 },
  { id: 'POTATO',        name: 'Potato',        emoji: '🥔', category: 'Farming',   bazaarId: 'POTATO_ITEM',   outputPerAction: 1 },
  { id: 'MELON',         name: 'Melon',         emoji: '🍉', category: 'Farming',   bazaarId: 'MELON',         outputPerAction: 1 },
  { id: 'PUMPKIN',       name: 'Pumpkin',       emoji: '🎃', category: 'Farming',   bazaarId: 'PUMPKIN',       outputPerAction: 1 },
  { id: 'CACTUS',        name: 'Cactus',        emoji: '🌵', category: 'Farming',   bazaarId: 'CACTUS',        outputPerAction: 1 },
  { id: 'MUSHROOM',      name: 'Mushroom',      emoji: '🍄', category: 'Farming',   bazaarId: 'BROWN_MUSHROOM',outputPerAction: 1 },
  { id: 'COCOA',         name: 'Cocoa Beans',   emoji: '🍫', category: 'Farming',   bazaarId: 'INK_SACK:3',    outputPerAction: 1 },
  // Mining
  { id: 'COBBLESTONE',   name: 'Cobblestone',   emoji: '🪨', category: 'Mining',    bazaarId: 'COBBLESTONE',   outputPerAction: 1 },
  { id: 'COAL',          name: 'Coal',          emoji: '⚫', category: 'Mining',    bazaarId: 'COAL',          outputPerAction: 1 },
  { id: 'IRON',          name: 'Iron',          emoji: '⚙️', category: 'Mining',    bazaarId: 'IRON_INGOT',    outputPerAction: 1 },
  { id: 'GOLD',          name: 'Gold',          emoji: '🟡', category: 'Mining',    bazaarId: 'GOLD_INGOT',    outputPerAction: 1 },
  { id: 'DIAMOND',       name: 'Diamond',       emoji: '💎', category: 'Mining',    bazaarId: 'DIAMOND',       outputPerAction: 1 },
  { id: 'EMERALD',       name: 'Emerald',       emoji: '🟢', category: 'Mining',    bazaarId: 'EMERALD',       outputPerAction: 1 },
  { id: 'REDSTONE',      name: 'Redstone',      emoji: '🔴', category: 'Mining',    bazaarId: 'REDSTONE',      outputPerAction: 1 },
  { id: 'LAPIS',         name: 'Lapis Lazuli',  emoji: '🔵', category: 'Mining',    bazaarId: 'INK_SACK:4',    outputPerAction: 1 },
  { id: 'GLOWSTONE',     name: 'Glowstone',     emoji: '✨', category: 'Mining',    bazaarId: 'GLOWSTONE_DUST',outputPerAction: 1 },
  { id: 'QUARTZ',        name: 'Nether Quartz', emoji: '🪨', category: 'Mining',    bazaarId: 'QUARTZ',        outputPerAction: 1 },
  { id: 'SNOW',          name: 'Snow',          emoji: '❄️', category: 'Mining',    bazaarId: 'SNOW_BALL',     outputPerAction: 2 },
  { id: 'ICE',           name: 'Ice',           emoji: '🧊', category: 'Mining',    bazaarId: 'ICE',           outputPerAction: 1 },
  { id: 'CLAY',          name: 'Clay',          emoji: '🧱', category: 'Mining',    bazaarId: 'CLAY_BALL',     outputPerAction: 1 },
  // Foraging
  { id: 'OAK',           name: 'Oak Wood',      emoji: '🌳', category: 'Foraging',  bazaarId: 'OAK_LOG',       outputPerAction: 1 },
  { id: 'BIRCH',         name: 'Birch Wood',    emoji: '🌲', category: 'Foraging',  bazaarId: 'BIRCH_LOG',     outputPerAction: 1 },
  { id: 'SPRUCE',        name: 'Spruce Wood',   emoji: '🌲', category: 'Foraging',  bazaarId: 'SPRUCE_LOG',    outputPerAction: 1 },
  { id: 'DARK_OAK',      name: 'Dark Oak Wood', emoji: '🌳', category: 'Foraging',  bazaarId: 'DARK_OAK_LOG',  outputPerAction: 1 },
  // Animals
  { id: 'CHICKEN',       name: 'Chicken',       emoji: '🐔', category: 'Animals',   bazaarId: 'RAW_CHICKEN',   outputPerAction: 1 },
  { id: 'COW',           name: 'Cow',           emoji: '🐄', category: 'Animals',   bazaarId: 'LEATHER',       outputPerAction: 1 },
  { id: 'SHEEP',         name: 'Sheep',         emoji: '🐑', category: 'Animals',   bazaarId: 'WOOL',          outputPerAction: 1 },
  { id: 'RABBIT',        name: 'Rabbit',        emoji: '🐇', category: 'Animals',   bazaarId: 'RAW_RABBIT',    outputPerAction: 1 },
  // Combat
  { id: 'GHAST',         name: 'Ghast',         emoji: '👻', category: 'Combat',    bazaarId: 'GHAST_TEAR',    outputPerAction: 1 },
  { id: 'SKELETON',      name: 'Skeleton',      emoji: '💀', category: 'Combat',    bazaarId: 'BONE',          outputPerAction: 2 },
  { id: 'SPIDER',        name: 'Spider',        emoji: '🕷️', category: 'Combat',    bazaarId: 'STRING',        outputPerAction: 1 },
  { id: 'ZOMBIE',        name: 'Zombie',        emoji: '🧟', category: 'Combat',    bazaarId: 'ROTTEN_FLESH',  outputPerAction: 1 },
  { id: 'BLAZE',         name: 'Blaze',         emoji: '🔥', category: 'Combat',    bazaarId: 'BLAZE_ROD',     outputPerAction: 1 },
  { id: 'ENDERMAN',      name: 'Enderman',      emoji: '👾', category: 'Combat',    bazaarId: 'ENDER_PEARL',   outputPerAction: 1 },
];

export const MINION_CATEGORIES = ['All', 'Farming', 'Mining', 'Foraging', 'Animals', 'Combat'];

/**
 * Calculate minion profits.
 * @param {Object} minion - from MINIONS array
 * @param {number} tier - 1-12
 * @param {Object} fuel - from FUELS array
 * @param {number} itemPrice - coins per item (from bazaar)
 * @returns {Object} - { actionsPerHour, itemsPerHour, coinsPerHour, coinsPerDay, netPerDay }
 */
export function calcMinionProfit(minion, tier, fuel, itemPrice) {
  const baseDelay = TIER_DELAYS[tier - 1] ?? 26;
  const effectiveDelay = baseDelay / fuel.speedMult;
  const actionsPerHour = 3600 / effectiveDelay;
  const itemsPerHour = actionsPerHour * minion.outputPerAction;
  const coinsPerHour = itemsPerHour * itemPrice;
  const coinsPerDay = coinsPerHour * 24;
  const netPerDay = coinsPerDay - fuel.costPerDay;
  return {
    actionsPerHour: Math.round(actionsPerHour),
    itemsPerHour:   Math.round(itemsPerHour),
    coinsPerHour:   Math.round(coinsPerHour),
    coinsPerDay:    Math.round(coinsPerDay),
    netPerDay:      Math.round(netPerDay),
    effectiveDelay: Math.round(effectiveDelay * 10) / 10,
  };
}
