import { useEffect } from 'react';
import { X } from 'lucide-react';
import { formatCoins } from '../utils/api';

// ── Minecraft color/format code rendering ─────────────────────────────────────
const MC_COLORS = {
  '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA',
  '4': '#AA0000', '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA',
  '8': '#555555', '9': '#5555FF', 'a': '#55FF55', 'b': '#55FFFF',
  'c': '#FF5555', 'd': '#FF55FF', 'e': '#FFFF55', 'f': '#FFFFFF',
};

function parseMcText(text) {
  const segments = [];
  let i = 0, buf = '', color = null, bold = false, italic = false;
  while (i < text.length) {
    if (text[i] === '§' && i + 1 < text.length) {
      if (buf) { segments.push({ text: buf, color, bold, italic }); buf = ''; }
      const c = text[i + 1].toLowerCase();
      if (MC_COLORS[c]) { color = MC_COLORS[c]; bold = false; italic = false; }
      else if (c === 'l') bold = true;
      else if (c === 'o') italic = true;
      else if (c === 'r') { color = null; bold = false; italic = false; }
      i += 2;
    } else { buf += text[i++]; }
  }
  if (buf) segments.push({ text: buf, color, bold, italic });
  return segments;
}

function McText({ text }) {
  if (!text) return null;
  const segs = parseMcText(text);
  return (
    <>
      {segs.map((s, i) => (
        <span key={i} style={{
          color:      s.color || 'var(--text-muted)',
          fontWeight: s.bold   ? '700' : undefined,
          fontStyle:  s.italic ? 'italic' : undefined,
        }}>{s.text}</span>
      ))}
    </>
  );
}

// ── Rarity from last lore line ────────────────────────────────────────────────
const RARITY_COLORS = {
  COMMON:       '#AAAAAA',
  UNCOMMON:     '#55FF55',
  RARE:         '#5555FF',
  EPIC:         '#AA00AA',
  LEGENDARY:    '#FFAA00',
  MYTHIC:       '#FF55FF',
  DIVINE:       '#55FFFF',
  SPECIAL:      '#FF5555',
};
const _RARITY_RE = /COMMON|UNCOMMON|RARE|EPIC|LEGENDARY|MYTHIC|DIVINE|SPECIAL/;

function rarityFromLore(lore) {
  for (let i = lore.length - 1; i >= 0; i--) {
    const clean = lore[i].replace(/§./g, '');
    const m = clean.match(_RARITY_RE);
    if (m) return m[0];
  }
  return null;
}

// ── Roman numerals ────────────────────────────────────────────────────────────
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
function toRoman(n) { return n >= 1 && n <= 10 ? ROMAN[n] : String(n); }

function fmtEnchant(name, level) {
  const niceName = name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return `${niceName} ${toRoman(level)}`;
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 6 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// ── Tag chip ─────────────────────────────────────────────────────────────────
function Chip({ color, children }) {
  return (
    <span style={{
      display: 'inline-block', fontSize: 11, padding: '2px 8px', borderRadius: 12,
      background: `${color}22`, border: `1px solid ${color}55`, color, marginRight: 5, marginBottom: 4,
    }}>
      {children}
    </span>
  );
}

// ── Value row ────────────────────────────────────────────────────────────────
function ValRow({ label, value, color }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{label}</span>
      <span style={{ color: color || 'var(--gold)', fontWeight: 700, fontSize: 13 }}>{formatCoins(value)}</span>
    </div>
  );
}

// ── Main modal ───────────────────────────────────────────────────────────────
export default function ItemModal({ item, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!item) return null;

  const rarity      = rarityFromLore(item.lore || []);
  const rarityColor = RARITY_COLORS[rarity] || '#AAAAAA';
  const encEntries  = Object.entries(item.enchantments || {});
  const hasUpgrades = item.hot_potato_count > 0 || item.rarity_upgrades > 0 || item.dungeon_item_level > 0 || item.reforge;
  const hasGems     = item.gems?.length > 0;
  const hasAttr     = Object.keys(item.attributes || {}).length > 0;

  const displayName = item.name || item.id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: 'var(--bg-2)',
        border: `1px solid ${rarityColor}44`,
        borderRadius: 12,
        width: '100%', maxWidth: 540,
        maxHeight: '88vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: `0 0 40px ${rarityColor}22`,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          padding: '16px 18px 12px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: rarityColor, lineHeight: 1.3 }}>
              {item.count > 1 && <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>×{item.count}</span>}
              {displayName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
              <span style={{ fontFamily: 'monospace', background: 'var(--bg-3)', padding: '1px 6px', borderRadius: 4 }}>{item.id}</span>
              {rarity && <span style={{ marginLeft: 8, color: rarityColor, fontWeight: 600 }}>{rarity}</span>}
              {item.dungeon_item_level > 0 && (
                <span style={{ marginLeft: 8, color: '#f5c518' }}>
                  {'✦'.repeat(Math.min(item.dungeon_item_level, 5))} {item.dungeon_item_level > 5 ? `+${item.dungeon_item_level - 5}` : ''}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div style={{ overflowY: 'auto', padding: '14px 18px', flex: 1 }}>

          {/* Upgrades row */}
          {hasUpgrades && (
            <Section title="Upgrades">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                {item.reforge && <Chip color="#58a6ff">{item.reforge}</Chip>}
                {item.hot_potato_count > 0 && (
                  <Chip color="#ff9f43">
                    {item.hot_potato_count <= 10
                      ? `${item.hot_potato_count} HPB`
                      : `10 HPB + ${item.hot_potato_count - 10} Fuming`}
                  </Chip>
                )}
                {item.rarity_upgrades > 0 && <Chip color="#bc8cff">Recombobulated</Chip>}
                {item.dungeon_item_level > 0 && (
                  <Chip color="#f5c518">
                    {item.dungeon_item_level <= 5
                      ? `${item.dungeon_item_level}★`
                      : `5★ + ${item.dungeon_item_level - 5} Master`}
                  </Chip>
                )}
                {item.skin && <Chip color="#39d0d8">Skin: {item.skin.replace(/_/g, ' ')}</Chip>}
              </div>
            </Section>
          )}

          {/* Enchantments */}
          {encEntries.length > 0 && (
            <Section title={`Enchantments (${encEntries.length})`}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {encEntries
                  .sort(([, a], [, b]) => b - a)
                  .map(([name, level]) => (
                    <Chip key={name} color="#5555FF">{fmtEnchant(name, level)}</Chip>
                  ))}
              </div>
            </Section>
          )}

          {/* Gems */}
          {hasGems && (
            <Section title="Gems">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {item.gems.map((g, i) => <Chip key={i} color="#39d0d8">{g}</Chip>)}
              </div>
            </Section>
          )}

          {/* Attributes */}
          {hasAttr && (
            <Section title="Attributes">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {Object.entries(item.attributes).map(([k, v]) => (
                  <Chip key={k} color="#f472b6">{k} {toRoman(v)}</Chip>
                ))}
              </div>
            </Section>
          )}

          {/* Value breakdown */}
          {item.value > 0 && (
            <Section title="Value Estimate">
              <ValRow label="Base item"   value={item.base_value}     color="var(--gold)" />
              {item.upgrades_value > 0 && (
                <ValRow label="Upgrades (HPB / recomb / stars / enchants)" value={item.upgrades_value} color="#bc8cff" />
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 0', marginTop: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>Total</span>
                <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 15 }}>{formatCoins(item.value)}</span>
              </div>
            </Section>
          )}

          {/* Lore */}
          {item.lore?.length > 0 && (
            <Section title="Lore">
              <div style={{
                background: 'var(--bg-3)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '10px 12px',
                fontFamily: 'monospace', fontSize: 12.5, lineHeight: 1.7,
              }}>
                {item.lore.map((line, i) => (
                  <div key={i} style={{ minHeight: '1em' }}>
                    {line ? <McText text={line} /> : <>&nbsp;</>}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
