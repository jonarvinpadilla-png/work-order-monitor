import { isOverdue } from '../lib/constants';

function computeKPIs(orders) {
  const active = orders.filter(o => ['Open', 'In Progress', 'On Hold'].includes(o.status)).length;
  const overdue = orders.filter(isOverdue).length;
  const cutoff = new Date(Date.now() - 30 * 86400000);
  const completed30 = orders.filter(o => o.status === 'Completed' && o.date_completed && new Date(o.date_completed) >= cutoff).length;
  const resolved = orders.filter(o => o.status === 'Completed' && o.date_completed && o.date_reported);
  let avgRes = null;
  if (resolved.length) {
    const total = resolved.reduce((sum, o) => sum + Math.max(0, (new Date(o.date_completed) - new Date(o.date_reported)) / 86400000), 0);
    avgRes = (total / resolved.length).toFixed(1);
  }
  return { active, overdue, completed30, avgRes };
}

export default function KpiBar({ orders }) {
  const k = computeKPIs(orders);
  return (
    <div className="kpis">
      <div className="kpi kpi-teal"><span className="kpi-label">Active</span><span className="kpi-value">{k.active}</span></div>
      <div className="kpi kpi-red"><span className="kpi-label">Overdue</span><span className="kpi-value">{k.overdue}</span></div>
      <div className="kpi kpi-green"><span className="kpi-label">Completed (30d)</span><span className="kpi-value">{k.completed30}</span></div>
      <div className="kpi kpi-slate"><span className="kpi-label">Avg. resolution</span><span className="kpi-value">{k.avgRes !== null ? `${k.avgRes}d` : '—'}</span></div>
    </div>
  );
}
