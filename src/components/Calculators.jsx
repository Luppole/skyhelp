import { useState } from 'react';
import { Calculator } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import { calcBazaarFlip, calcCraftProfit, calcEnchantingROI, xpToLevel, SKILL_XP_TABLE, SKILL_NAMES } from '../utils/skyblock';
import { formatCoins } from '../utils/api';

const TABS = [
  ['bazaar',     'Bazaar Flip'],
  ['craft',      'Craft & Sell'],
  ['enchanting', 'Enchanting ROI'],
  ['xp',         'Skill XP Lookup'],
];

export default function Calculators() {
  const [tab, setTab] = useState('bazaar');
  return (
    <div className="page">
      <PageHeader icon={Calculator} title="Profit Calculators"
        description="Instant calculations — all math runs locally, no network required." />
      <div className="btn-group" style={{ marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(([key, label]) => (
          <button key={key} className={tab === key ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>
      {tab === 'bazaar'     && <BazaarFlipCalc />}
      {tab === 'craft'      && <CraftCalc />}
      {tab === 'enchanting' && <EnchantingCalc />}
      {tab === 'xp'         && <XPLookup />}
    </div>
  );
}

// ── Bazaar Flip ─────────────────────────────────────────────────────────────

function BazaarFlipCalc() {
  const [buyPrice, setBuyPrice]     = useState('');
  const [sellPrice, setSellPrice]   = useState('');
  const [quantity, setQuantity]     = useState(1);
  const [useBuyOrder, setUseBuyOrder] = useState(true);
  const [result, setResult]         = useState(null);

  function calculate() {
    if (!buyPrice || !sellPrice) return;
    setResult(calcBazaarFlip(+buyPrice, +sellPrice, +quantity, useBuyOrder));
  }

  return (
    <div className="calc-layout">
      <div className="card calc-form">
        <div className="card__title">Bazaar Flip</div>
        <Field label="Buy price (per item)"><input type="number" value={buyPrice} onChange={e => setBuyPrice(e.target.value)} /></Field>
        <Field label="Sell price (per item)"><input type="number" value={sellPrice} onChange={e => setSellPrice(e.target.value)} /></Field>
        <Field label="Quantity"><input type="number" value={quantity} min={1} onChange={e => setQuantity(e.target.value)} /></Field>
        <label className="checkbox-label">
          <input type="checkbox" checked={useBuyOrder} onChange={e => setUseBuyOrder(e.target.checked)} />
          Use buy order (tax-free purchase)
        </label>
        <button className="btn-primary" onClick={calculate} disabled={!buyPrice || !sellPrice}>Calculate</button>
      </div>
      {result && (
        <div className="card calc-result">
          <div className="card__title">Results</div>
          <R label="Buy price"               value={formatCoins(result.buy_price)} />
          <R label="Sell price (after 1.25%)" value={formatCoins(result.effective_sell)} />
          <R label="Profit / item"            value={formatCoins(result.profit_per_item)} gold={result.profit_per_item > 0} />
          <R label="Quantity"                 value={result.quantity.toLocaleString()} />
          <R label="Total invested"           value={formatCoins(result.total_invested)} />
          <div className="calc-result__divider" />
          <R label="Total profit" value={`${result.total_profit > 0?'+':''}${formatCoins(result.total_profit)}`} gold={result.total_profit > 0} large />
          <R label="ROI"          value={`${result.roi_pct.toFixed(2)}%`} gold={result.roi_pct > 0} />
        </div>
      )}
    </div>
  );
}

// ── Craft & Sell ────────────────────────────────────────────────────────────

function CraftCalc() {
  const [craftCost, setCraftCost] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [quantity, setQuantity]   = useState(1);
  const [result, setResult]       = useState(null);

  function calculate() {
    if (!craftCost || !sellPrice) return;
    setResult(calcCraftProfit(+craftCost, +sellPrice, +quantity));
  }

  return (
    <div className="calc-layout">
      <div className="card calc-form">
        <div className="card__title">Craft &amp; Sell</div>
        <Field label="Craft cost (per item)"><input type="number" value={craftCost} onChange={e => setCraftCost(e.target.value)} /></Field>
        <Field label="Sell order price (per item)"><input type="number" value={sellPrice} onChange={e => setSellPrice(e.target.value)} /></Field>
        <Field label="Quantity"><input type="number" value={quantity} min={1} onChange={e => setQuantity(e.target.value)} /></Field>
        <button className="btn-primary" onClick={calculate} disabled={!craftCost || !sellPrice}>Calculate</button>
      </div>
      {result && (
        <div className="card calc-result">
          <div className="card__title">Results</div>
          <R label="Craft cost"               value={formatCoins(result.craft_cost)} />
          <R label="Sell price (after 1.25%)" value={formatCoins(result.effective_sell)} />
          <R label="Profit / item"            value={formatCoins(result.profit_per_item)} gold={result.profit_per_item > 0} />
          <R label="Quantity"                 value={result.quantity.toLocaleString()} />
          <div className="calc-result__divider" />
          <R label="Total profit" value={`${result.total_profit > 0?'+':''}${formatCoins(result.total_profit)}`} gold={result.total_profit > 0} large />
          <R label="ROI"          value={`${result.roi_pct.toFixed(2)}%`} gold={result.roi_pct > 0} />
        </div>
      )}
    </div>
  );
}

// ── Enchanting ROI ──────────────────────────────────────────────────────────

function EnchantingCalc() {
  const [basePrice, setBasePrice]     = useState('');
  const [targetLevel, setTargetLevel] = useState(5);
  const [sellPrice, setSellPrice]     = useState('');
  const [result, setResult]           = useState(null);

  const booksPreview = Math.pow(2, targetLevel - 1);

  function calculate() {
    if (!basePrice || !sellPrice) return;
    setResult(calcEnchantingROI(+basePrice, +targetLevel, +sellPrice));
  }

  return (
    <div className="calc-layout">
      <div className="card calc-form">
        <div className="card__title">Enchanting ROI</div>
        <p className="text-muted" style={{ fontSize: 12, marginBottom: 4 }}>
          Calculates material cost only — does not include anvil XP cost.
        </p>
        <Field label="Level 1 book price (coins)">
          <input type="number" value={basePrice} onChange={e => setBasePrice(e.target.value)} />
        </Field>
        <Field label={`Target level (${booksPreview} books needed)`}>
          <select value={targetLevel} onChange={e => setTargetLevel(+e.target.value)}>
            {[2,3,4,5,6,7,8,9,10].map(l => (
              <option key={l} value={l}>Level {l} — {Math.pow(2, l-1)} books</option>
            ))}
          </select>
        </Field>
        <Field label="Sell price for combined book">
          <input type="number" value={sellPrice} onChange={e => setSellPrice(e.target.value)} />
        </Field>
        <button className="btn-primary" onClick={calculate} disabled={!basePrice || !sellPrice}>Calculate</button>
      </div>
      {result && (
        <div className="card calc-result">
          <div className="card__title">Results</div>
          <R label="Books needed"       value={result.books_needed.toLocaleString()} />
          <R label="Total book cost"    value={formatCoins(result.total_cost)} />
          <R label="Sell (after 1.25%)" value={formatCoins(result.effective_sell)} />
          <div className="calc-result__divider" />
          <R label="Profit" value={`${result.profit > 0?'+':''}${formatCoins(result.profit)}`} gold={result.profit > 0} large />
          <R label="ROI"    value={`${result.roi_pct.toFixed(2)}%`} gold={result.roi_pct > 0} />
        </div>
      )}
    </div>
  );
}

// ── Skill XP Lookup ─────────────────────────────────────────────────────────

function XPLookup() {
  const [rawXP, setRawXP]   = useState('');
  const [result, setResult] = useState(null);

  function calculate() {
    if (!rawXP) return;
    setResult(xpToLevel(Number(rawXP), SKILL_XP_TABLE));
  }

  return (
    <div className="calc-layout">
      <div className="card calc-form">
        <div className="card__title">Skill XP Lookup</div>
        <Field label="Raw XP">
          <input type="number" value={rawXP} onChange={e => setRawXP(e.target.value)}
            placeholder="e.g. 3500000"
            onKeyDown={e => e.key === 'Enter' && calculate()} />
        </Field>
        <button className="btn-primary" onClick={calculate} disabled={!rawXP}>Lookup</button>
      </div>
      {result && (
        <div className="card calc-result">
          <div className="card__title">Results</div>
          <R label="Current Level" value={result.level} gold large />
          <R label="Raw XP"        value={Number(rawXP).toLocaleString()} />
          <div className="calc-result__divider" />
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 5, fontSize:13 }}>
              <span className="text-muted">Progress to next level</span>
              <span style={{ color: 'var(--gold)' }}>{result.progress.toFixed(1)}%</span>
            </div>
            <div className="progress-bar" style={{ height: 8 }}>
              <div className="progress-fill" style={{ width: `${result.progress}%` }} />
            </div>
          </div>
          {result.atMax
            ? <p className="text-muted" style={{ marginTop: 10, fontSize: 12 }}>Max level reached!</p>
            : <R label="XP to next level" value={result.xpToNext.toLocaleString()} />
          }
        </div>
      )}
    </div>
  );
}

// ── Shared sub-components ───────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

function R({ label, value, gold, large }) {
  return (
    <div className={`result-row${large ? ' result-row--large' : ''}`}>
      <span className="result-row__label">{label}</span>
      <span className={gold ? 'result-row__value--gold' : 'result-row__value'}>{value}</span>
    </div>
  );
}
