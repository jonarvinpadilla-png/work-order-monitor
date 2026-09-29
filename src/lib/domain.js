import { ACTIVE_STATUSES, CLOSED_STATUSES, INTERVAL_UNITS, MHE_SUPPORT_TYPES } from './constants.js';
import { addInterval, daysUntil, fmtDate, fmtNum, parseDate, relativeDays, todayStr } from './format.js';

// ---------------------------------------------------------------- work orders
export const isActive = wo => ACTIVE_STATUSES.includes(wo.status);
export const isClosed = wo => CLOSED_STATUSES.includes(wo.status);

export function isOverdue(wo, now = new Date()) {
  if (!isActive(wo) || !wo.due_date) return false;
  return daysUntil(wo.due_date, now) < 0;
}

// Label and tone for a work order's due date, as shown on lists and cards.
export function dueInfo(wo, now = new Date()) {
  if (wo.status === 'Completed') return { label: `Done ${fmtDate(wo.completed_at)}`, tone: 'good' };
  if (wo.status === 'Cancelled' || wo.status === 'Rejected') return { label: wo.status, tone: 'muted' };
  if (wo.status === 'Requested') return { label: 'Awaiting approval', tone: 'violet' };
  if (!wo.due_date) return { label: 'No due date', tone: 'muted' };
  const d = daysUntil(wo.due_date, now);
  if (d < 0) return { label: `${-d}d overdue`, tone: 'danger' };
  if (d === 0) return { label: 'Due today', tone: 'warn' };
  if (d <= 2) return { label: `Due in ${d}d`, tone: 'warn' };
  return { label: `Due ${fmtDate(wo.due_date)}`, tone: 'muted' };
}

export function hoursBetween(a, b) {
  if (!a || !b) return null;
  return (parseDate(b) - parseDate(a)) / 3600000;
}

// ---------------------------------------------------------------- assets
export const isMheUnit = asset => !!asset?.mhe_type && !MHE_SUPPORT_TYPES.includes(asset.mhe_type);

// Status of each expiry-style date (certificates, warranties, contracts, permits).
export function expiryInfo(dateStr, warnDays = 30, now = new Date()) {
  if (!dateStr) return { label: 'Not set', tone: 'muted', days: null };
  const d = daysUntil(dateStr, now);
  if (d < 0) return { label: `Expired ${relativeDays(dateStr, now)}`, tone: 'danger', days: d };
  if (d <= warnDays) return { label: d === 0 ? 'Expires today' : `Expires in ${d}d`, tone: 'warn', days: d };
  return { label: `Valid to ${fmtDate(dateStr)}`, tone: 'good', days: d };
}

// Location name with its parent, e.g. "Warehouse Building › Freezer Room".
export function locationPath(loc, byId) {
  if (!loc) return '';
  const parts = [loc.name];
  let p = loc.parent_id ? byId[loc.parent_id] : null;
  let guard = 0;
  while (p && guard++ < 6) {
    parts.unshift(p.name);
    p = p.parent_id ? byId[p.parent_id] : null;
  }
  return parts.join(' › ');
}

// Which part of the DC a location belongs to, for the dashboard cutaway:
// freezer / chiller / dry storage by temperature zone, docks, or office.
export function zoneOf(locationId, byId) {
  let loc = byId[locationId];
  let guard = 0;
  while (loc && guard++ < 8) {
    if (loc.temp_zone === 'Freezer') return 'freezer';
    if (loc.temp_zone === 'Chiller') return 'chiller';
    if (loc.kind === 'Dock' || /dock/i.test(loc.name)) return 'docks';
    if (loc.temp_zone === 'Ambient') return 'dry';
    if (/office|admin|canteen|locker/i.test(loc.name)) return 'office';
    loc = loc.parent_id ? byId[loc.parent_id] : null;
  }
  return null;
}

// Locations ordered as a tree with depth, for indented pickers.
export function locationTree(locations, siteId) {
  const list = locations.filter(l => !siteId || l.site_id === siteId);
  const kids = {};
  list.forEach(l => { (kids[l.parent_id || 'root'] ||= []).push(l); });
  Object.values(kids).forEach(arr => arr.sort((a, b) => a.name.localeCompare(b.name)));
  const ids = new Set(list.map(l => l.id));
  const out = [];
  const walk = (key, depth) => (kids[key] || []).forEach(l => { out.push({ ...l, depth }); walk(l.id, depth + 1); });
  walk('root', 0);
  // orphans whose parent is at another site or deleted
  list.filter(l => l.parent_id && !ids.has(l.parent_id)).forEach(l => { if (!out.find(o => o.id === l.id)) { out.push({ ...l, depth: 0 }); walk(l.id, 1); } });
  return out;
}

// ---------------------------------------------------------------- PM schedules
export function describeTrigger(s) {
  if (s.trigger_type === 'Meter') return `Every ${fmtNum(s.meter_interval)} hours`;
  const u = INTERVAL_UNITS.find(x => x.value === s.interval_unit);
  if (!u) return '—';
  return s.interval_value === 1 ? `Every ${u.one}` : `Every ${s.interval_value} ${u.many}`;
}

// Where a schedule stands: when it is next due and whether it is late.
export function pmNextInfo(s, asset, now = new Date()) {
  if (s.trigger_type === 'Meter') {
    const next = Number(s.meter_last || 0) + Number(s.meter_interval || 0);
    const cur = asset?.current_meter;
    if (cur === null || cur === undefined) return { label: `At ${fmtNum(next)} h`, sub: 'No meter reading yet', tone: 'muted', sortKey: 1e9 };
    const left = next - Number(cur);
    const tone = left <= 0 ? 'danger' : left <= Number(s.meter_lead || 0) ? 'warn' : 'muted';
    return {
      label: `At ${fmtNum(next)} h`,
      sub: left === 0 ? 'Due now' : left < 0 ? `${fmtNum(Math.abs(left))} h over` : `${fmtNum(left)} h to go`,
      tone,
      sortKey: left / 8 // assume roughly 8 running hours a day for ordering only
    };
  }
  const d = daysUntil(s.next_due, now);
  return {
    label: fmtDate(s.next_due),
    sub: relativeDays(s.next_due, now),
    tone: d < 0 ? 'danger' : d <= (s.lead_days || 0) ? 'warn' : 'muted',
    sortKey: d
  };
}

// Calendar PM occurrences in the next `days` days (meter PMs cannot be dated).
export function pmForecast(schedules, days = 90, now = new Date()) {
  const today = todayStr(now);
  const end = addInterval(today, days, 'day');
  const out = [];
  for (const s of schedules) {
    if (!s.active || s.trigger_type !== 'Calendar' || !s.next_due || !s.interval_value) continue;
    let d = s.next_due;
    let guard = 0;
    while (d <= end && guard++ < 400) {
      out.push({ schedule: s, date: d, overdue: d < today });
      d = addInterval(d, s.interval_value, s.interval_unit);
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------- parts
export function stockInfo(p) {
  const q = Number(p.qty_on_hand);
  if (q <= 0) return { label: 'Out of stock', tone: 'danger', low: true };
  if (q <= Number(p.min_qty || 0)) return { label: 'Reorder', tone: 'warn', low: true };
  return { label: 'In stock', tone: 'good', low: false };
}
