const BASE = import.meta.env.VITE_ITEM_ICON_BASE || '';
const AH_BASE = import.meta.env.VITE_AH_ICON_BASE || '';

export function getItemIconUrl(itemId) {
  if (!BASE || !itemId) return null;
  if (BASE.includes('{id}')) {
    return BASE.replace('{id}', itemId);
  }
  return `${BASE}${itemId}`;
}

export function getAhIconUrl(itemId) {
  if (!AH_BASE || !itemId) return null;
  if (AH_BASE.includes('{id}')) {
    return AH_BASE.replace('{id}', itemId);
  }
  return `${AH_BASE}${itemId}`;
}
