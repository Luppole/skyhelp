import { useEffect, useState } from 'react';
import { Search, Gavel, RefreshCw } from 'lucide-react';
import { SkeletonTable } from './ui/Skeleton';
import PageHeader from './ui/PageHeader';
import { searchAuctions, fetchAuctionStatus, formatCoins } from '../utils/api';
import { rarityClass } from '../utils/skyblock';
import { useFetch } from '../hooks/useFetch';
import { useSupabaseUser } from '../hooks/useSupabaseUser';
import { fetchUserData, saveUserData } from '../utils/supabaseStore';
import ItemIcon from './ui/ItemIcon';
import { useUserData } from '../hooks/useUserData';

function timeLeft(end) {
  const diff = end - Date.now();
  if (diff <= 0) return 'Ended';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function AuctionHouse() {
  const [query, setQuery]     = useUserData('ah_query', '');
  const [binOnly, setBinOnly] = useUserData('ah_bin_only', false);
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const { data: status } = useFetch(fetchAuctionStatus, [], { refreshInterval: 30_000 });
  const [saved, setSaved] = useState(loadSavedSearches);
  const { user } = useSupabaseUser();

  function loadSavedSearches() {
    try { return JSON.parse(localStorage.getItem('ah-saved') ?? '[]'); }
    catch { return []; }
  }
  function saveSavedSearches(next) {
    localStorage.setItem('ah-saved', JSON.stringify(next));
  }

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError('');
    try {
      const data = await searchAuctions(query, binOnly);
      setResults(data);
    } catch (e) {
      setSearchError(e.message);
    } finally {
      setSearching(false);
    }
  }

  function addSaved() {
    if (!query.trim()) return;
    const item = { name: query.trim(), binOnly };
    const next = [
      item,
      ...saved.filter(s => s.name !== item.name || s.binOnly !== item.binOnly),
    ].slice(0, 10);
    setSaved(next);
    saveSavedSearches(next);
  }

  function applySaved(s) {
    setQuery(s.name);
    setBinOnly(!!s.binOnly);
  }

  function removeSaved(name, binOnly) {
    const next = saved.filter(s => s.name !== name || s.binOnly !== binOnly);
    setSaved(next);
    saveSavedSearches(next);
  }

  useEffect(() => {
    let mounted = true;
    async function loadRemote() {
      if (!user) return;
      const remote = await fetchUserData(user.id, 'ah_saved_searches');
      if (mounted && Array.isArray(remote)) setSaved(remote);
    }
    loadRemote();
    return () => { mounted = false; };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    saveUserData(user.id, 'ah_saved_searches', saved).catch(() => {});
  }, [saved, user]);

  return (
    <div className="page">
      <PageHeader
        icon={Gavel}
        title="Auction House"
        description="Search across all live auctions — full index refreshed every 60 s server-side."
        actions={
          status && (
            <span className="status-badge">
              <span className={`status-dot ${status.ready ? 'status-dot--green' : 'status-dot--yellow'}`} />
              {status.ready
                ? `${(status.auction_count ?? 0).toLocaleString()} auctions indexed`
                : 'Indexing…'}
            </span>
          )
        }
      />

      <div className="toolbar">
        <div className="field">
          <label>Item name</label>
          <input
            type="text"
            placeholder="e.g. Hyperion"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            style={{ width: 280 }}
          />
        </div>
        <label className="checkbox-label">
          <input type="checkbox" checked={binOnly} onChange={e => setBinOnly(e.target.checked)} />
          BIN only
        </label>
        <button className="btn-primary" onClick={search} disabled={searching || !query.trim()}>
          {searching
            ? <><RefreshCw size={14} className="spin" /> Searching…</>
            : <><Search size={14} /> Search</>}
        </button>
        <button className="btn-secondary" onClick={addSaved} disabled={!query.trim()}>
          Save Search
        </button>
      </div>

      {saved.length > 0 && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card__title">Saved Searches</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {saved.map((s, i) => (
              <div key={`${s.name}-${i}`} className="tag tag-blue" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  className="btn-icon btn-sm"
                  onClick={() => applySaved(s)}
                  title="Apply saved search"
                  style={{ background: 'none' }}
                >
                  {s.name}{s.binOnly ? ' (BIN)' : ''}
                </button>
                <button
                  className="btn-icon btn-sm btn-danger"
                  onClick={() => removeSaved(s.name, s.binOnly)}
                  title="Delete saved search"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {searchError && <div className="error-box">{searchError}</div>}

      {searching && <SkeletonTable rows={8} cols={6} />}

      {!searching && results && (
        <>
          <div className="result-meta">
            {results.count.toLocaleString()} results
            {results.index_age_seconds != null && (
              <span className="text-muted"> · index {results.index_age_seconds}s old</span>
            )}
          </div>
          {results.count === 0 ? (
            <p className="empty-state">No auctions found for "{query}".</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Price</th>
                    <th>Type</th>
                    <th>Time Left</th>
                    <th>Rarity</th>
                    <th>Category</th>
                  </tr>
                </thead>
                <tbody>
                  {results.auctions.map(a => (
                    <tr key={a.uuid}>
                      <td className="text-bold">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <ItemIcon itemId={a.item_id || ''} name={a.item_name} size={22} kind="ah" />
                          <span>{a.item_name}</span>
                        </div>
                      </td>
                      <td><span className="tag tag-gold">{formatCoins(a.starting_bid)}</span></td>
                      <td>
                        {a.bin
                          ? <span className="tag tag-blue">BIN</span>
                          : <span className="tag tag-purple">Auction</span>}
                      </td>
                      <td className="text-muted">{timeLeft(a.end)}</td>
                      <td><span className={`tag rarity-tag ${rarityClass(a.tier)}`}>{a.tier}</span></td>
                      <td className="text-muted" style={{ textTransform: 'capitalize' }}>{a.category}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
