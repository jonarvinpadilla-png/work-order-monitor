export const FACILITIES = ['Ambient Warehouse', 'Dry Warehouse', 'Cold Storage', 'Port Facility', 'Office / Admin', 'Other'];

export const TYPES = [
  { key: 'PM', label: 'Preventive Maintenance', color: 'teal' },
  { key: 'Corrective', label: 'Corrective / Breakdown', color: 'rust' },
  { key: 'Safety', label: 'Safety Corrective Action', color: 'violet' }
];
export const TYPE_COLOR = Object.fromEntries(TYPES.map(t => [t.key, t.color]));
export function typeLabel(key) {
  return TYPES.find(t => t.key === key)?.label || key;
}

export const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
export const PRIORITY_COLOR = { Low: 'slate', Medium: 'amber', High: 'orange', Critical: 'red' };

export const STATUSES = ['Open', 'In Progress', 'On Hold', 'Completed', 'Cancelled'];
export const STATUS_COLOR = { Open: 'amber', 'In Progress': 'teal', 'On Hold': 'slate', Completed: 'green', Cancelled: 'muted' };

export const REFERENCE_SUGGESTIONS = ['RA 11058', 'PD 1096', 'DOLE DO 198-18', 'RA 9514 (Fire Code)', 'DENR ECC', 'BFP FSIC', 'FSSC 22000'];

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDate(str) {
  if (!str) return '—';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function daysUntil(dueDate) {
  const start = new Date(new Date().toDateString());
  const due = new Date(dueDate + 'T00:00:00');
  return Math.round((due - start) / 86400000);
}

export function isOverdue(o) {
  if (o.status === 'Completed' || o.status === 'Cancelled') return false;
  if (!o.due_date) return false;
  return daysUntil(o.due_date) < 0;
}

export function dueLabel(o) {
  if (o.status === 'Completed') return o.date_completed ? `Completed ${formatDate(o.date_completed)}` : 'Completed';
  if (o.status === 'Cancelled') return 'Cancelled';
  if (!o.due_date) return 'No due date';
  const d = daysUntil(o.due_date);
  if (d < 0) return `Overdue ${Math.abs(d)}d`;
  if (d === 0) return 'Due today';
  return `Due in ${d}d`;
}
