// Dates in the site's time zone. The server PC's own clock zone doesn't
// matter: "today", work order numbers and PM due dates always follow the
// time zone in Settings (Asia/Manila by default).

const formatters = new Map();

function partsIn(timeZone, date) {
  let fmt = formatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    });
    formatters.set(timeZone, fmt);
  }
  const out = {};
  for (const p of fmt.formatToParts(date)) if (p.type !== 'literal') out[p.type] = p.value;
  return out;
}

// 'YYYY-MM-DD' for the given moment in the given zone.
export function localDate(timeZone, date = new Date()) {
  const p = partsIn(timeZone, date);
  return `${p.year}-${p.month}-${p.day}`;
}

// 'YYYY-MM-DD-HHmm', used in backup file names.
export function localStamp(timeZone, date = new Date()) {
  const p = partsIn(timeZone, date);
  return `${p.year}-${p.month}-${p.day}-${p.hour}${p.minute}`;
}

// 'YYMM', used in work order numbers (WO-2609-0001).
export function localYearMonth(timeZone, date = new Date()) {
  const p = partsIn(timeZone, date);
  return p.year.slice(2) + p.month;
}

// Milliseconds from `now` until the next hh:mm in the given zone.
export function msUntilLocalTime(timeZone, hour, minute, now = new Date()) {
  const p = partsIn(timeZone, now);
  const wallNow = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  const offset = wallNow - Math.floor(now.getTime() / 60000) * 60000;
  let target = Date.UTC(+p.year, +p.month - 1, +p.day, hour, minute) - offset;
  if (target <= now.getTime()) target += 86400000;
  return target - now.getTime();
}

const pad = n => String(n).padStart(2, '0');
const iso = (y, m0, d) => `${String(y).padStart(4, '0')}-${pad(m0 + 1)}-${pad(d)}`;

function split(dateStr) {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return [y, m - 1, d];
}

export function addDays(dateStr, n) {
  const [y, m0, d] = split(dateStr);
  const t = new Date(Date.UTC(y, m0, d + n));
  return iso(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
}

// Calendar months with month-end clamping, like Postgres: Jan 31 + 1 month = Feb 28/29.
export function addMonths(dateStr, n) {
  const [y, m0, d] = split(dateStr);
  const first = new Date(Date.UTC(y, m0 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return iso(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, last));
}

export function addInterval(dateStr, n, unit) {
  switch (unit) {
    case 'day': return addDays(dateStr, n);
    case 'week': return addDays(dateStr, 7 * n);
    case 'month': return addMonths(dateStr, n);
    case 'year': return addMonths(dateStr, 12 * n);
    default: throw new Error(`Unknown interval unit: ${unit}`);
  }
}

export function isValidDate(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const [y, m0, d] = split(str);
  const t = new Date(Date.UTC(y, m0, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m0 && t.getUTCDate() === d;
}
