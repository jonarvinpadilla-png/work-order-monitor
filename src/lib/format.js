// Dates from the database arrive as 'YYYY-MM-DD' (date columns) or ISO
// timestamps. Everything here works in the browser's local time zone.

export function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayStr(now = new Date()) {
  return toDateStr(now);
}

export function parseDate(str) {
  if (!str) return null;
  if (str.length === 10) return new Date(str + 'T00:00:00');
  return new Date(str);
}

// Whole days from today until the given date (negative = in the past).
export function daysUntil(dateStr, now = new Date()) {
  if (!dateStr) return null;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = parseDate(dateStr);
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((day - start) / 86400000);
}

export function addDays(dateStr, n) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

// Mirrors add_interval() in the database, including month-end clamping
// (Jan 31 + 1 month = Feb 28/29).
export function addInterval(dateStr, n, unit) {
  const d = parseDate(dateStr);
  if (unit === 'day') d.setDate(d.getDate() + n);
  else if (unit === 'week') d.setDate(d.getDate() + 7 * n);
  else {
    const months = unit === 'year' ? 12 * n : n;
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
  }
  return toDateStr(d);
}

const dateFmt = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' });

export function fmtDate(str) {
  if (!str) return '—';
  return dateFmt.format(parseDate(str));
}

export function fmtShortDate(str) {
  if (!str) return '—';
  return shortFmt.format(parseDate(str));
}

export function fmtDateTime(str) {
  if (!str) return '—';
  const d = parseDate(str);
  return `${dateFmt.format(d)}, ${timeFmt.format(d)}`;
}

export function fmtTime(str) {
  return str ? timeFmt.format(parseDate(str)) : '—';
}

export function fmtAgo(str, now = new Date()) {
  if (!str) return '—';
  const mins = Math.round((now - parseDate(str)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} d ago`;
  return fmtDate(str);
}

// "in 3 days", "today", "2 days overdue" style wording for a due date.
export function relativeDays(dateStr, now = new Date()) {
  const d = daysUntil(dateStr, now);
  if (d === null) return '';
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d === -1) return 'yesterday';
  return d > 0 ? `in ${d} days` : `${-d} days ago`;
}

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });
const pesoExact = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 });
export function fmtMoney(n, exact = false) {
  if (n === null || n === undefined || n === '') return '—';
  return (exact ? pesoExact : peso).format(Number(n));
}

const numFmt = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 1 });
export function fmtNum(n) {
  if (n === null || n === undefined || n === '') return '—';
  return numFmt.format(Number(n));
}

export function fmtHours(n) {
  if (n === null || n === undefined) return '—';
  return `${numFmt.format(Number(n))} h`;
}

export function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/[\s.@]+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function plural(n, one, many = one + 's') {
  return `${n} ${n === 1 ? one : many}`;
}
