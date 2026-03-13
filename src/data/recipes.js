// Craft Chain recipe tree — common SkyBlock enchanted items
// Each recipe: id (bazaar item ID), name, ingredients: [{id, count}]
// Recursive resolution uses bazaar prices to find total material cost

export const RECIPES = [
  // Tier 1 enchanted (x160)
  { id: 'ENCHANTED_COBBLESTONE',    name: 'Enchanted Cobblestone',    ingredients: [{ id: 'COBBLESTONE',    count: 160 }] },
  { id: 'ENCHANTED_COAL',           name: 'Enchanted Coal',           ingredients: [{ id: 'COAL',           count: 160 }] },
  { id: 'ENCHANTED_IRON',           name: 'Enchanted Iron Ingot',     ingredients: [{ id: 'IRON_INGOT',     count: 160 }] },
  { id: 'ENCHANTED_GOLD',           name: 'Enchanted Gold Ingot',     ingredients: [{ id: 'GOLD_INGOT',     count: 160 }] },
  { id: 'ENCHANTED_DIAMOND',        name: 'Enchanted Diamond',        ingredients: [{ id: 'DIAMOND',        count: 160 }] },
  { id: 'ENCHANTED_EMERALD',        name: 'Enchanted Emerald',        ingredients: [{ id: 'EMERALD',        count: 160 }] },
  { id: 'ENCHANTED_REDSTONE',       name: 'Enchanted Redstone',       ingredients: [{ id: 'REDSTONE',       count: 160 }] },
  { id: 'ENCHANTED_LAPIS',          name: 'Enchanted Lapis Lazuli',   ingredients: [{ id: 'INK_SACK:4',    count: 160 }] },
  { id: 'ENCHANTED_GLOWSTONE_DUST', name: 'Enchanted Glowstone Dust', ingredients: [{ id: 'GLOWSTONE_DUST', count: 160 }] },
  { id: 'ENCHANTED_QUARTZ',         name: 'Enchanted Quartz',         ingredients: [{ id: 'QUARTZ',         count: 160 }] },
  { id: 'ENCHANTED_SUGAR_CANE',     name: 'Enchanted Sugar Cane',     ingredients: [{ id: 'SUGAR_CANE',     count: 160 }] },
  { id: 'ENCHANTED_SUGAR',          name: 'Enchanted Sugar',          ingredients: [{ id: 'SUGAR_CANE',     count: 160 }] },
  { id: 'ENCHANTED_WHEAT',          name: 'Enchanted Wheat',          ingredients: [{ id: 'WHEAT',          count: 160 }] },
  { id: 'ENCHANTED_CARROT',         name: 'Enchanted Carrot',         ingredients: [{ id: 'CARROT_ITEM',    count: 160 }] },
  { id: 'ENCHANTED_POTATO',         name: 'Enchanted Potato',         ingredients: [{ id: 'POTATO_ITEM',    count: 160 }] },
  { id: 'ENCHANTED_MELON',          name: 'Enchanted Melon',          ingredients: [{ id: 'MELON',          count: 160 }] },
  { id: 'ENCHANTED_PUMPKIN',        name: 'Enchanted Pumpkin',        ingredients: [{ id: 'PUMPKIN',        count: 160 }] },
  { id: 'ENCHANTED_CACTUS',         name: 'Enchanted Cactus',         ingredients: [{ id: 'CACTUS',         count: 160 }] },
  { id: 'ENCHANTED_BONE',           name: 'Enchanted Bone',           ingredients: [{ id: 'BONE',           count: 160 }] },
  { id: 'ENCHANTED_STRING',         name: 'Enchanted String',         ingredients: [{ id: 'STRING',         count: 160 }] },
  { id: 'ENCHANTED_ROTTEN_FLESH',   name: 'Enchanted Rotten Flesh',   ingredients: [{ id: 'ROTTEN_FLESH',   count: 160 }] },
  { id: 'ENCHANTED_BLAZE_ROD',      name: 'Enchanted Blaze Rod',      ingredients: [{ id: 'BLAZE_ROD',      count: 160 }] },
  { id: 'ENCHANTED_ENDER_PEARL',    name: 'Enchanted Ender Pearl',    ingredients: [{ id: 'ENDER_PEARL',    count: 160 }] },
  { id: 'ENCHANTED_OAK_LOG',        name: 'Enchanted Oak Log',        ingredients: [{ id: 'OAK_LOG',        count: 160 }] },
  { id: 'ENCHANTED_GHAST_TEAR',     name: 'Enchanted Ghast Tear',     ingredients: [{ id: 'GHAST_TEAR',     count: 160 }] },
  // Tier 2 (x8 enchanted)
  { id: 'DOUBLE_ENCHANTED_COBBLESTONE', name: '2x Enchanted Cobblestone', ingredients: [{ id: 'ENCHANTED_COBBLESTONE', count: 8 }] },
  { id: 'DOUBLE_ENCHANTED_COAL',        name: '2x Enchanted Coal',        ingredients: [{ id: 'ENCHANTED_COAL',        count: 8 }] },
  { id: 'DOUBLE_ENCHANTED_IRON',        name: '2x Enchanted Iron',         ingredients: [{ id: 'ENCHANTED_IRON',        count: 8 }] },
  { id: 'DOUBLE_ENCHANTED_GOLD',        name: '2x Enchanted Gold',         ingredients: [{ id: 'ENCHANTED_GOLD',        count: 8 }] },
  { id: 'DOUBLE_ENCHANTED_DIAMOND',     name: '2x Enchanted Diamond',      ingredients: [{ id: 'ENCHANTED_DIAMOND',     count: 8 }] },
  { id: 'DOUBLE_ENCHANTED_EMERALD',     name: '2x Enchanted Emerald',      ingredients: [{ id: 'ENCHANTED_EMERALD',     count: 8 }] },
  { id: 'ENCHANTED_SUGAR_CANE_BLOCK',   name: 'Sugar Cane Block',          ingredients: [{ id: 'ENCHANTED_SUGAR_CANE', count: 8 }] },
  { id: 'ENCHANTED_WHEAT_BLOCK',        name: 'Enchanted Hay Bale',        ingredients: [{ id: 'ENCHANTED_WHEAT',      count: 8 }] },
];

// Build a lookup map
export const RECIPE_MAP = Object.fromEntries(RECIPES.map(r => [r.id, r]));

/**
 * Recursively resolve total raw material cost.
 * @param {string} itemId - target item
 * @param {number} quantity
 * @param {Object} prices - { [bazaarId]: price }
 * @param {number} depth - recursion guard
 * @returns {{ craftCost, buyPrice, shouldCraft, steps }}
 */
export function resolveRecipeCost(itemId, quantity = 1, prices = {}, depth = 0) {
  if (depth > 10) return { craftCost: Infinity, steps: [] };

  const recipe = RECIPE_MAP[itemId];
  const buyPrice = (prices[itemId] || 0) * quantity;

  if (!recipe) {
    // Raw material — use bazaar price
    return {
      craftCost: buyPrice,
      buyPrice,
      shouldCraft: false,
      steps: [{ itemId, quantity, cost: buyPrice, source: 'bazaar' }],
    };
  }

  // Calculate craft cost recursively
  let craftCost = 0;
  const steps = [];

  for (const ing of recipe.ingredients) {
    const resolved = resolveRecipeCost(ing.id, ing.count * quantity, prices, depth + 1);
    craftCost += resolved.craftCost;
    steps.push(...resolved.steps);
  }

  const shouldCraft = craftCost < buyPrice || buyPrice === 0;
  steps.unshift({
    itemId,
    quantity,
    craftCost: Math.round(craftCost),
    buyPrice: Math.round(buyPrice),
    shouldCraft,
    source: shouldCraft ? 'craft' : 'buy',
  });

  return { craftCost: Math.round(craftCost), buyPrice: Math.round(buyPrice), shouldCraft, steps };
}
