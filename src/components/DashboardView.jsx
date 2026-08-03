import { STATUSES, STATUS_COLOR, TYPES, TYPE_COLOR, typeLabel, FACILITIES, PRIORITIES, PRIORITY_COLOR, isOverdue, dueLabel } from '../lib/constants';

function countBy(orders, key) {
  const out = {};
  orders.forEach(o => { out[o[key]] = (out[o[key]] || 0) + 1; });
  return out;
}

function BarRow({ label, count, max, color }) {
  const pct = max ? Math.round((count / max) * 100) : 0;
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <div className="bar-track"><div className={`bar-fill fill-${color}`} style={{ width: `${pct}%` }} /></div>
      <span className="bar-count">{count}</span>
    </div>
  );
}

export default function DashboardView({ orders }) {
  const byStatus = countBy(orders, 'status');
  const byType = countBy(orders, 'type');
  const byFacility = countBy(orders, 'facility');
  const byPriority = countBy(orders, 'priority');
  const maxStatus = Math.max(1, ...STATUSES.map(s => byStatus[s] || 0));
  const maxType = Math.max(1, ...TYPES.map(t => byType[t.key] || 0));
  const facilitiesUsed = FACILITIES.filter(f => byFacility[f]);
  const maxFacility = Math.max(1, ...facilitiesUsed.map(f => byFacility[f] || 0));
  const totalPriority = orders.length;
  const upcoming = orders
    .filter(o => !['Completed', 'Cancelled'].includes(o.status) && o.due_date)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 5);

  return (
    <div className="dash-grid">
      <div className="dash-card">
        <h3>By status</h3>
        {STATUSES.map(s => <BarRow key={s} label={s} count={byStatus[s] || 0} max={maxStatus} color={STATUS_COLOR[s]} />)}
      </div>
      <div className="dash-card">
        <h3>By type</h3>
        {TYPES.map(t => <BarRow key={t.key} label={t.label} count={byType[t.key] || 0} max={maxType} color={TYPE_COLOR[t.key]} />)}
      </div>
      <div className="dash-card">
        <h3>By facility</h3>
        {facilitiesUsed.length
          ? facilitiesUsed.map(f => <BarRow key={f} label={f} count={byFacility[f] || 0} max={maxFacility} color="teal" />)
          : <p className="muted-note">No data</p>}
      </div>
      <div className="dash-card">
        <h3>Priority load</h3>
        <div className="load-meter">
          {PRIORITIES.map(p => {
            const c = byPriority[p] || 0;
            const pct = totalPriority ? (c / totalPriority) * 100 : 0;
            return pct > 0 ? <span key={p} className={`fill-${PRIORITY_COLOR[p]}`} style={{ width: `${pct}%` }} /> : null;
          })}
        </div>
        <div className="load-legend">
          {PRIORITIES.map(p => (
            <span className="legend-item" key={p}><span className={`dot dot-${PRIORITY_COLOR[p]}`} />{p} ({byPriority[p] || 0})</span>
          ))}
        </div>
      </div>
      <div className="dash-card dash-wide">
        <h3>Upcoming &amp; overdue</h3>
        {upcoming.length ? (
          <ul className="upcoming-list">
            {upcoming.map(o => (
              <li key={o.id}>
                <span className="upcoming-code">{o.code}</span>
                <span className="upcoming-title">{o.title}</span>
                <span className={`chip chip-sm chip-${TYPE_COLOR[o.type]}`}>{typeLabel(o.type)}</span>
                <span className={`wo-due${isOverdue(o) ? ' overdue' : ''}`}>{dueLabel(o)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="muted-note">Nothing due.</p>}
      </div>
    </div>
  );
}
