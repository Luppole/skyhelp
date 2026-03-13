import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchUserData, saveUserData } from '../utils/supabaseStore';

const STORAGE_KEY = 'sb-price-alerts';

function loadAlerts() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); }
  catch { return []; }
}

function saveAlerts(alerts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
}

/**
 * Price alert hook.
 * Each alert: { id, itemId, itemName, direction: 'above'|'below', targetPrice, triggered: bool, lastCheck }
 */
export function useAlerts(bazaarData, userId) {
  const [alerts, setAlerts] = useState(loadAlerts);
  const [recentlyTriggered, setRecentlyTriggered] = useState([]);
  const notifiedIds = useRef(new Set());

  // Check alerts whenever bazaar data updates
  useEffect(() => {
    if (!bazaarData?.flips) return;
    const priceMap = {};
    for (const f of bazaarData.flips) {
      priceMap[f.item_id] = { buy: f.sell_price, sell: f.buy_price };
    }

    let anyTriggered = false;
    const newAlerts = alerts.map(alert => {
      const prices = priceMap[alert.itemId];
      if (!prices) return alert;
      const currentPrice = alert.priceType === 'sell' ? prices.sell : prices.buy;
      const triggered =
        alert.direction === 'below' ? currentPrice <= alert.targetPrice
                                    : currentPrice >= alert.targetPrice;

      if (triggered && !notifiedIds.current.has(alert.id)) {
        notifiedIds.current.add(alert.id);
        anyTriggered = true;
        setRecentlyTriggered(prev => [{
          ...alert,
          currentPrice,
          triggeredAt: Date.now(),
        }, ...prev.slice(0, 9)]);

        // Browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`🔔 SkyBlock Alert: ${alert.itemName}`, {
            body: `Price ${alert.direction === 'below' ? 'dropped below' : 'rose above'} ${alert.targetPrice.toLocaleString()} coins (now ${Math.round(currentPrice).toLocaleString()})`,
            icon: '/favicon.ico',
          });
        }
      }

      return { ...alert, currentPrice, triggered };
    });

    if (anyTriggered) {
      setAlerts(newAlerts);
      saveAlerts(newAlerts);
    }
  }, [bazaarData]);

  const addAlert = useCallback((alert) => {
    const newAlert = {
      id: Date.now(),
      triggered: false,
      priceType: 'buy',
      ...alert,
    };
    setAlerts(prev => {
      const next = [...prev, newAlert];
      saveAlerts(next);
      return next;
    });
  }, []);

  const removeAlert = useCallback((id) => {
    notifiedIds.current.delete(id);
    setAlerts(prev => {
      const next = prev.filter(a => a.id !== id);
      saveAlerts(next);
      return next;
    });
  }, []);

  const requestPermission = useCallback(async () => {
    if ('Notification' in window) {
      await Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadRemote() {
      if (!userId) return;
      const remote = await fetchUserData(userId, 'price_alerts');
      if (mounted && Array.isArray(remote)) {
        setAlerts(remote);
        saveAlerts(remote);
      }
    }
    loadRemote();
    return () => { mounted = false; };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    saveUserData(userId, 'price_alerts', alerts).catch(() => {});
  }, [alerts, userId]);

  return { alerts, recentlyTriggered, addAlert, removeAlert, requestPermission };
}
