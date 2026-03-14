import { useState, useCallback, useEffect } from 'react';
import { Bell, Plus, Trash2, BellOff, BellRing, Check, Smartphone, Cloud } from 'lucide-react';
import { useFetch } from '../hooks/useFetch';
import { useAlerts } from '../hooks/useAlerts';
import PageHeader from './ui/PageHeader';
import { fetchBazaarFlips, formatCoins } from '../utils/api';
import { useSupabaseUser } from '../hooks/useSupabaseUser';
import { useAuthModal } from './AuthProvider';
import {
  subscribeToPush, sendSubscriptionToServer,
  unsubscribeFromPush, getCurrentSubscription,
} from '../utils/pushNotifications';

export default function PriceAlerts() {
  const { data } = useFetch(
    useCallback((options = {}) => fetchBazaarFlips(1000, 2, 200, options), []),
    [],
    { refreshInterval: 30_000 }
  );
  const { user } = useSupabaseUser();
  const { openAuth } = useAuthModal();
  const { alerts, recentlyTriggered, addAlert, removeAlert, requestPermission } = useAlerts(data, user?.id);

  const [showForm, setShowForm]       = useState(false);
  const [form, setForm]               = useState({ itemId: '', itemName: '', direction: 'below', targetPrice: '', priceType: 'buy' });
  const [notifStatus, setNotifStatus] = useState(Notification?.permission ?? 'default');
  const [pushActive, setPushActive]   = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  const flips = data?.flips ?? [];

  // Check if already subscribed to push
  useEffect(() => {
    getCurrentSubscription().then(sub => setPushActive(!!sub));
  }, []);

  async function handleRequestNotif() {
    await requestPermission();
    setNotifStatus(Notification?.permission ?? 'default');
  }

  async function handleEnablePush() {
    setPushLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setNotifStatus(perm);
      if (perm !== 'granted') return;
      const sub = await subscribeToPush();
      if (sub && user) {
        await sendSubscriptionToServer(sub, user.id);
        setPushActive(true);
      } else if (sub) {
        setPushActive(true);
      }
    } finally {
      setPushLoading(false);
    }
  }

  async function handleDisablePush() {
    setPushLoading(true);
    try {
      await unsubscribeFromPush(user?.id);
      setPushActive(false);
    } finally {
      setPushLoading(false);
    }
  }

  function handleAdd(e) {
    e.preventDefault();
    if (!form.itemId || !form.targetPrice) return;
    addAlert({
      itemId:      form.itemId,
      itemName:    form.itemName || form.itemId,
      direction:   form.direction,
      targetPrice: Number(form.targetPrice),
      priceType:   form.priceType,
    });
    setForm({ itemId: '', itemName: '', direction: 'below', targetPrice: '', priceType: 'buy' });
    setShowForm(false);
  }

  function handleSelectItem(e) {
    const itemId = e.target.value;
    const flip   = flips.find(f => f.item_id === itemId);
    setForm(f => ({ ...f, itemId, itemName: flip?.name ?? itemId }));
  }

  const vapidConfigured = !!import.meta.env.VITE_VAPID_PUBLIC_KEY;

  return (
    <div className="page">
      <PageHeader
        icon={Bell}
        title="Price Alerts"
        description="Get notified when bazaar items hit your target price — even when the app is closed."
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {/* Push notification toggle */}
            {vapidConfigured && notifStatus !== 'denied' && (
              pushActive
                ? <button className="btn-secondary btn-sm" onClick={handleDisablePush} disabled={pushLoading}>
                    <Smartphone size={13} /> Push On
                  </button>
                : <button className="btn-secondary btn-sm" onClick={handleEnablePush} disabled={pushLoading}>
                    <Smartphone size={13} /> {pushLoading ? 'Setting up…' : 'Enable Push'}
                  </button>
            )}
            {/* Browser notifications fallback */}
            {!vapidConfigured && notifStatus !== 'granted' && (
              <button className="btn-secondary btn-sm" onClick={handleRequestNotif}>
                <BellRing size={13} /> Enable Notifications
              </button>
            )}
            {(notifStatus === 'granted' && !pushActive) && (
              <span className="tag tag-green" style={{ fontSize: 11 }}>
                <Check size={11} /> Browser alerts on
              </span>
            )}
            <button className="btn-primary btn-sm" onClick={() => setShowForm(s => !s)}>
              <Plus size={14} /> New Alert
            </button>
          </div>
        }
      />

      {/* Sign-in prompt — alerts survive page refresh when signed in */}
      {!user && (
        <div className="info-box" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Cloud size={15} style={{ color: 'var(--blue)', flexShrink: 0 }} />
            <span><strong>Sign in</strong> to sync alerts across devices and enable background push notifications.</span>
          </div>
          <button className="btn-primary btn-sm" onClick={openAuth} style={{ flexShrink: 0 }}>Sign in</button>
        </div>
      )}

      {notifStatus === 'denied' && (
        <div className="error-box" style={{ marginBottom: 18 }}>
          <BellOff size={14} />
          Browser notifications are blocked. Enable them in browser settings to receive alerts.
        </div>
      )}

      {/* Push active badge */}
      {pushActive && (
        <div className="info-box" style={{ marginBottom: 18, borderColor: 'var(--green)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Smartphone size={14} style={{ color: 'var(--green)' }} />
          <span><strong style={{ color: 'var(--green)' }}>Push notifications active</strong> — you'll be notified even when the app is closed.</span>
        </div>
      )}

      {/* Add alert form */}
      {showForm && (
        <div className="card" style={{ marginBottom: 18, animation: 'slide-in-up 0.2s ease' }}>
          <div className="card__title">New Price Alert</div>
          <form onSubmit={handleAdd}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="field" style={{ minWidth: 220 }}>
                <label>Item</label>
                <select value={form.itemId} onChange={handleSelectItem} required>
                  <option value="">Select a bazaar item…</option>
                  {flips.map(f => <option key={f.item_id} value={f.item_id}>{f.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Price Type</label>
                <select value={form.priceType} onChange={e => setForm(f => ({ ...f, priceType: e.target.value }))}>
                  <option value="buy">Buy Order Price</option>
                  <option value="sell">Sell Order Price</option>
                </select>
              </div>
              <div className="field">
                <label>Alert When Price Is</label>
                <select value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value }))}>
                  <option value="below">Below</option>
                  <option value="above">Above</option>
                </select>
              </div>
              <div className="field">
                <label>Target Price (coins)</label>
                <input type="number" required value={form.targetPrice}
                  onChange={e => setForm(f => ({ ...f, targetPrice: e.target.value }))}
                  placeholder="e.g. 5000000" style={{ width: 160 }} />
              </div>
              <button type="submit" className="btn-primary" disabled={!form.itemId || !form.targetPrice}>
                <Bell size={14} /> Create Alert
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        {/* Active alerts */}
        <div>
          <div className="section-title" style={{ marginTop: 0 }}>
            Active Alerts ({alerts.length})
          </div>
          {alerts.length === 0 ? (
            <div className="empty-state" style={{ marginTop: 30 }}>
              <span className="empty-state-icon"><Bell size={32} strokeWidth={1.5} /></span>
              <span>No active alerts</span>
              <span className="text-muted" style={{ fontSize: 12 }}>Click "New Alert" to set one up</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {alerts.map(alert => {
                const currentPriceDisplay = alert.currentPrice ? formatCoins(alert.currentPrice) : '—';
                const isNear = alert.currentPrice && (
                  alert.direction === 'below'
                    ? alert.currentPrice <= alert.targetPrice * 1.1
                    : alert.currentPrice >= alert.targetPrice * 0.9
                );
                return (
                  <div key={alert.id}
                    className={`card ${alert.triggered ? 'card--glow-green' : isNear ? 'card--glow-gold' : ''}`}
                    style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <span style={{ fontSize: 18 }}>{alert.triggered ? '✅' : isNear ? '⚡' : '🔔'}</span>
                      <div style={{ minWidth: 0 }}>
                        <div className="text-bold" style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {alert.itemName}
                        </div>
                        <div className="text-muted" style={{ fontSize: 12 }}>
                          {alert.priceType === 'sell' ? 'Sell' : 'Buy'} price {alert.direction}{' '}
                          <span className="text-gold">{formatCoins(alert.targetPrice)}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                          Current: {currentPriceDisplay}
                        </div>
                      </div>
                    </div>
                    <button className="btn-icon btn-sm btn-danger" onClick={() => removeAlert(alert.id)} title="Delete alert">
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Triggered history */}
        <div>
          <div className="section-title" style={{ marginTop: 0 }}>
            Recent Triggers ({recentlyTriggered.length})
          </div>
          {recentlyTriggered.length === 0 ? (
            <div className="empty-state" style={{ marginTop: 30 }}>
              <span className="empty-state-icon"><BellOff size={28} strokeWidth={1.5} /></span>
              <span>No recent triggers</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentlyTriggered.map((t, i) => (
                <div key={i} className="card card--glow-green" style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>🔔</span>
                    <div>
                      <div className="text-bold" style={{ fontSize: 13 }}>{t.itemName}</div>
                      <div className="text-green" style={{ fontSize: 12 }}>
                        Hit {t.direction} {formatCoins(t.targetPrice)} →{' '}
                        <strong>{formatCoins(t.currentPrice)}</strong>
                      </div>
                      <div className="text-muted" style={{ fontSize: 11 }}>
                        {new Date(t.triggeredAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
