import { useState, useMemo, useCallback } from 'react';
import { GitBranch, RefreshCw, ChevronRight } from 'lucide-react';
import { useFetch } from '../hooks/useFetch';
import PageHeader from './ui/PageHeader';
import { RECIPES, resolveRecipeCost } from '../data/recipes';
import { fetchBazaarFlips, formatCoins } from '../utils/api';

export default function CraftChain() {
  const [targetId, setTargetId]   = useState(RECIPES[0].id);
  const [quantity, setQuantity]   = useState(1);
  const [search, setSearch]       = useState('');

  // Fetch bazaar prices
  const fetcher = useCallback(
    (options = {}) => fetchBazaarFlips(0, 0, 500, options),
    []
  );
  const { data, loading, reload } = useFetch(fetcher, []);

  const prices = useMemo(() => {
    const map = {};
    for (const f of data?.flips ?? []) {
      map[f.item_id] = f.sell_price; // cheapest to buy
    }
    return map;
  }, [data]);

  const recipe = RECIPES.find(r => r.id === targetId);

  const analysis = useMemo(() => {
    if (!recipe || !Object.keys(prices).length) return null;
    return resolveRecipeCost(targetId, quantity, prices);
  }, [targetId, quantity, prices, recipe]);

  const sellPrice = prices[targetId] ? prices[targetId] * quantity : null;
  const profit = sellPrice && analysis
    ? sellPrice * 0.9875 - analysis.craftCost
    : null;

  const filteredRecipes = search
    ? RECIPES.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
    : RECIPES;

  return (
    <div className="page">
      <PageHeader
        icon={GitBranch}
        title="Craft Chain Optimizer"
        description="Compare multi-step craft cost vs buying from bazaar. Shows optimal buy vs craft decision at each step."
        actions={
          <button className="btn-icon" onClick={reload} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
        }
      />

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Config */}
        <div className="card" style={{ minWidth: 280, flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card__title">Target Item</div>
          <div className="field">
            <label>Search Recipe</label>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="e.g. Enchanted Diamond…" />
          </div>
          <div className="field">
            <label>Item</label>
            <select value={targetId} onChange={e => setTargetId(e.target.value)} style={{ width: '100%' }}>
              {filteredRecipes.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Quantity</label>
            <input type="number" value={quantity} min={1}
              onChange={e => setQuantity(Math.max(1, +e.target.value))} />
          </div>

          {analysis && recipe && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <SL label="Craft cost"   value={formatCoins(analysis.craftCost)} color="var(--blue)" bold />
                {sellPrice && <SL label="Bazaar buy price" value={formatCoins(sellPrice)} />}
                {sellPrice && (
                  <div style={{ marginTop: 4, background: analysis.shouldCraft ? 'rgba(63,185,80,0.08)' : 'rgba(88,166,255,0.08)',
                    border: `1px solid ${analysis.shouldCraft ? 'rgba(63,185,80,0.25)' : 'rgba(88,166,255,0.25)'}`,
                    borderRadius: 6, padding: '8px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>RECOMMENDATION</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: analysis.shouldCraft ? 'var(--green)' : 'var(--blue)' }}>
                      {analysis.shouldCraft ? '🔨 CRAFT IT' : '🛒 BUY IT'}
                    </div>
                    <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>
                      Save {formatCoins(Math.abs((analysis.craftCost) - sellPrice))}
                    </div>
                  </div>
                )}
                {profit !== null && (
                  <>
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }} />
                    <SL label="Sell price (×0.9875)" value={formatCoins(sellPrice * 0.9875)} />
                    <SL label="Craft profit"
                      value={`${profit > 0 ? '+' : ''}${formatCoins(profit)}`}
                      color={profit > 0 ? 'var(--green)' : 'var(--red)'} bold />
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Recipe tree */}
        <div style={{ flex: 1, minWidth: 300 }}>
          {!analysis && (
            <div className="empty-state">
              <span className="empty-state-icon">🔗</span>
              <span>{loading ? 'Loading bazaar prices…' : 'Select an item to analyze'}</span>
            </div>
          )}
          {analysis && (
            <div className="card">
              <div className="card__title">
                <GitBranch size={13} /> Craft Chain — {recipe?.name} ×{quantity}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {analysis.steps.map((step, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px',
                    background: step.source === 'craft' ? 'rgba(63,185,80,0.05)' : 'rgba(88,166,255,0.05)',
                    border: `1px solid ${step.source === 'craft' ? 'rgba(63,185,80,0.15)' : 'rgba(88,166,255,0.15)'}`,
                    borderRadius: 8,
                    marginLeft: i > 0 ? Math.min(i * 20, 60) : 0,
                  }}>
                    {i > 0 && <ChevronRight size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="text-bold" style={{ fontSize: 13 }}>
                          {step.itemId.replace(/_/g, ' ')}
                          {step.quantity > 1 && <span className="text-muted"> ×{step.quantity}</span>}
                        </span>
                        <span className={`tag ${step.source === 'craft' ? 'tag-green' : 'tag-blue'}`}>
                          {step.source === 'craft' ? '🔨 Craft' : '🛒 Buy'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: 12 }}>
                        {step.craftCost !== undefined && (
                          <span className="text-muted">Craft: <span style={{ color: 'var(--green)' }}>{formatCoins(step.craftCost)}</span></span>
                        )}
                        {step.buyPrice > 0 && (
                          <span className="text-muted">Buy: <span style={{ color: 'var(--blue)' }}>{formatCoins(step.buyPrice)}</span></span>
                        )}
                        {step.cost > 0 && step.craftCost === undefined && (
                          <span className="text-muted">Cost: <span style={{ color: 'var(--text)' }}>{formatCoins(step.cost)}</span></span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>Total Craft Cost</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--gold)' }}>
                  {formatCoins(analysis.craftCost)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SL({ label, value, color, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 2 }}>
      <span className="text-muted">{label}</span>
      <span style={{ color: color || 'var(--text)', fontWeight: bold ? 700 : 400 }}>{value}</span>
    </div>
  );
}
