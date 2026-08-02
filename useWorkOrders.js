import { FACILITIES, TYPES, PRIORITIES } from '../lib/constants';

const TABS = [
  { key: 'board', label: 'Board' },
  { key: 'log', label: 'Log' },
  { key: 'dashboard', label: 'Dashboard' }
];

export default function Controls({ view, setView, filters, setFilters }) {
  function update(patch) {
    setFilters(f => ({ ...f, ...patch }));
  }
  function clear() {
    setFilters({ search: '', facility: 'all', type: 'all', priority: 'all' });
  }
  return (
    <div className="controls">
      <div className="tabs">
        {TABS.map(t => (
          <button key={t.key} className={`tab${view === t.key ? ' active' : ''}`} onClick={() => setView(t.key)}>{t.label}</button>
        ))}
      </div>
      <div className="filters">
        <input type="text" placeholder="Search work orders…" value={filters.search} onChange={e => update({ search: e.target.value })} />
        <select value={filters.facility} onChange={e => update({ facility: e.target.value })}>
          <option value="all">All facilities</option>
          {FACILITIES.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={filters.type} onChange={e => update({ type: e.target.value })}>
          <option value="all">All types</option>
          {TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <select value={filters.priority} onChange={e => update({ priority: e.target.value })}>
          <option value="all">All priorities</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <button className="btn btn-text" onClick={clear}>Clear filters</button>
      </div>
    </div>
  );
}
