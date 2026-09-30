// Maintenance KPIs, computed in the browser from the loaded records.
import { isActive, isMheUnit, hoursBetween } from './domain.js';
import { addDays, daysUntil, parseDate, toDateStr, todayStr } from './format.js';

const REACTIVE = ['Corrective', 'Emergency'];
const PLANNED = ['Preventive', 'Inspection'];

// Share of planned work (PM and inspections) due in the window that was
// completed on or before its due date.
export function pmCompliance(workOrders, days = 30, now = new Date()) {
  const today = todayStr(now);
  const from = addDays(today, -days);
  const due = workOrders.filter(w =>
    PLANNED.includes(w.type) && w.due_date && w.due_date >= from && w.due_date <= today &&
    w.status !== 'Cancelled' && w.status !== 'Rejected');
  const onTime = due.filter(w => w.status === 'Completed' && w.completed_at && toDateStr(parseDate(w.completed_at)) <= w.due_date);
  return { total: due.length, onTime: onTime.length, pct: due.length ? Math.round((onTime.length / due.length) * 100) : null };
}

// Mean time to repair: hours from report to completion for reactive work
// completed in the window.
export function mttr(workOrders, days = 30, now = new Date()) {
  const from = now.getTime() - days * 86400000;
  const done = workOrders.filter(w => REACTIVE.includes(w.type) && w.status === 'Completed' && w.completed_at && parseDate(w.completed_at).getTime() >= from);
  if (!done.length) return { hours: null, count: 0 };
  const total = done.reduce((sum, w) => sum + Math.max(0, hoursBetween(w.created_at, w.completed_at)), 0);
  return { hours: total / done.length, count: done.length };
}

// Planned vs reactive share of work completed in the window.
export function plannedShare(workOrders, days = 30, now = new Date()) {
  const from = now.getTime() - days * 86400000;
  const done = workOrders.filter(w => w.status === 'Completed' && w.completed_at && parseDate(w.completed_at).getTime() >= from);
  const planned = done.filter(w => PLANNED.includes(w.type)).length;
  return { total: done.length, planned, pct: done.length ? Math.round((planned / done.length) * 100) : null };
}

function weekStart(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - dow);
  return x;
}

// Work orders created and completed per week (Monday-based), oldest first.
export function weeklyThroughput(workOrders, weeks = 12, now = new Date()) {
  const thisWeek = weekStart(now);
  const buckets = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(thisWeek);
    start.setDate(start.getDate() - 7 * i);
    buckets.push({ start: toDateStr(start), created: 0, completed: 0 });
  }
  const index = new Map(buckets.map((b, i) => [b.start, i]));
  for (const w of workOrders) {
    if (w.status === 'Requested' || w.status === 'Rejected') continue;
    const c = index.get(toDateStr(weekStart(parseDate(w.created_at))));
    if (c !== undefined) buckets[c].created++;
    if (w.status === 'Completed' && w.completed_at) {
      const k = index.get(toDateStr(weekStart(parseDate(w.completed_at))));
      if (k !== undefined) buckets[k].completed++;
    }
  }
  return buckets;
}

// Open backlog grouped by how long ago each work order was raised.
export function backlogAging(workOrders, now = new Date()) {
  const buckets = [
    { label: '0–7 days', max: 7, count: 0 },
    { label: '8–30 days', max: 30, count: 0 },
    { label: '31–60 days', max: 60, count: 0 },
    { label: 'Over 60 days', max: Infinity, count: 0 }
  ];
  for (const w of workOrders) {
    if (!isActive(w)) continue;
    const age = -daysUntil(w.created_at, now);
    buckets.find(b => age <= b.max).count++;
  }
  return buckets;
}

// Share of the window each MHE unit was not locked out, averaged across units.
// The status log gives each change; before the first entry a unit is assumed
// to have been in the state that entry records.
export function mheAvailability(assets, statusLog, days = 30, now = new Date()) {
  const units = assets.filter(a => isMheUnit(a) && a.status !== 'Decommissioned' && a.mhe_type !== 'Manual Pallet Jack');
  if (!units.length) return { pct: null, units: 0, downHours: 0 };
  const end = now.getTime();
  const start = end - days * 86400000;
  const byAsset = {};
  for (const e of statusLog) (byAsset[e.asset_id] ||= []).push(e);
  let downMs = 0;
  for (const u of units) {
    const log = (byAsset[u.id] || []).slice().sort((a, b) => parseDate(a.changed_at) - parseDate(b.changed_at));
    let state = log.length ? log[0].status : u.status;
    let cursor = start;
    for (const e of log) {
      const t = parseDate(e.changed_at).getTime();
      if (t <= start) { state = e.status; continue; }
      if (t > end) break;
      if (state === 'Out of Service') downMs += t - cursor;
      cursor = t;
      state = e.status;
    }
    if (state === 'Out of Service') downMs += end - cursor;
  }
  const totalMs = units.length * (end - start);
  return { pct: Math.round((1 - downMs / totalMs) * 1000) / 10, units: units.length, downHours: downMs / 3600000 };
}

// Assets with the most reactive work in the window, with their cost.
export function topProblemAssets(workOrders, summaryByWo, days = 90, limit = 6, now = new Date()) {
  const from = now.getTime() - days * 86400000;
  const agg = {};
  for (const w of workOrders) {
    if (!w.asset_id || !REACTIVE.includes(w.type) || parseDate(w.created_at).getTime() < from) continue;
    const a = (agg[w.asset_id] ||= { asset_id: w.asset_id, count: 0, cost: 0 });
    a.count++;
    a.cost += Number(summaryByWo[w.id]?.total_cost || 0);
  }
  return Object.values(agg).sort((a, b) => b.count - a.count || b.cost - a.cost).slice(0, limit);
}
