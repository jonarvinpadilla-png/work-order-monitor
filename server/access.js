// Who can see and change what. This replaces the row-level security the
// Supabase version had in the database, rule for rule:
//
//   admin      – everything, including approvals, users and settings
//   technician – work orders, PM, assets, parts and checklists
//   requester  – submit requests and pre-use checks, follow their own
//
// Each table lists who may SELECT, INSERT, UPDATE and DELETE. A missing
// entry means nobody can do it through the app (the rules in rules.js
// still write there, e.g. the asset status log).

export const isMember = u => !!u && !!u.active;
export const isStaff = u => isMember(u) && (u.role === 'admin' || u.role === 'technician');
export const isAdmin = u => isMember(u) && u.role === 'admin';

// A select policy returns an SQL condition for the rows the user may see.
const ALL = { sql: '1', params: [] };
const NONE = { sql: '0', params: [] };
const only = test => u => (test(u) ? ALL : NONE);
const onOwnWorkOrders = u => ({ sql: 'work_order_id in (select id from work_orders where requested_by = ?)', params: [u.id] });

const adminWrites = { insert: { allow: isAdmin }, update: { allow: isAdmin }, delete: { allow: isAdmin } };

export const POLICIES = {
  profiles: {
    select: only(isMember),
    update: { allow: isMember, row: (u, r) => r.id === u.id || isAdmin(u) }
  },
  app_settings: { select: only(isMember), update: { allow: isAdmin } },
  sites: { select: only(isMember), ...adminWrites },
  locations: { select: only(isMember), ...adminWrites },
  asset_categories: { select: only(isMember), ...adminWrites },
  vendors: { select: only(isStaff), ...adminWrites },
  contracts: { select: only(isStaff), ...adminWrites },
  assets: { select: only(isMember), insert: { allow: isStaff }, update: { allow: isStaff }, delete: { allow: isAdmin } },
  asset_status_log: { select: only(isStaff) },
  meter_readings: { select: only(isStaff), insert: { allow: isStaff }, delete: { allow: isAdmin } },
  pm_schedules: { select: only(isStaff), insert: { allow: isStaff }, update: { allow: isStaff }, delete: { allow: isAdmin } },
  work_orders: {
    select: u => (isStaff(u) ? ALL : isMember(u) ? { sql: 'requested_by = ?', params: [u.id] } : NONE),
    insert: { allow: isMember, row: (u, r) => isStaff(u) || (r.status === 'Requested' && r.requested_by === u.id) },
    update: { allow: isStaff },
    delete: { allow: isAdmin }
  },
  wo_tasks: {
    select: u => (isStaff(u) ? ALL : isMember(u) ? onOwnWorkOrders(u) : NONE),
    insert: { allow: isStaff }, update: { allow: isStaff }, delete: { allow: isStaff }
  },
  wo_labor: { select: only(isStaff), insert: { allow: isStaff }, update: { allow: isStaff }, delete: { allow: isStaff } },
  wo_activity: {
    select: u => (isStaff(u) ? ALL : isMember(u) ? onOwnWorkOrders(u) : NONE),
    insert: {
      allow: isMember,
      row: (u, r, can) => isStaff(u) || (r.kind === 'comment' && r.author_id === u.id && can.see('work_orders', r.work_order_id))
    },
    delete: { allow: isAdmin }
  },
  parts: { select: only(isStaff), insert: { allow: isStaff }, update: { allow: isStaff }, delete: { allow: isAdmin } },
  part_transactions: { select: only(isStaff), insert: { allow: isStaff } },
  checklist_templates: { select: only(isMember), ...adminWrites },
  checklist_submissions: {
    select: u => (isStaff(u) ? ALL : isMember(u) ? { sql: 'submitted_by = ?', params: [u.id] } : NONE),
    insert: { allow: isMember },
    delete: { allow: isAdmin }
  },
  compliance_items: { select: only(isStaff), ...adminWrites },
  compliance_events: { select: only(isStaff), insert: { allow: isAdmin }, delete: { allow: isAdmin } },
  wo_summary: { select: only(isStaff), key: 'work_order_id' }
};

// Columns the app may set. Everything else (ids, timestamps, codes made by
// the server, stock on hand, sign-off stamps…) is filled in by the rules.
const WO_REQUEST = ['title', 'description', 'type', 'priority', 'status', 'site_id', 'location_id', 'asset_id', 'asset_down', 'requested_by', 'requester_name'];
const WO_STAFF = [...WO_REQUEST, 'assigned_to', 'vendor_id', 'pm_schedule_id', 'due_date', 'estimated_hours', 'external_cost', 'hold_reason',
  'reject_reason', 'action_taken', 'failure_cause', 'downtime_hours', 'meter_at_completion', 'completed_at'];

export const WRITABLE = {
  profiles: { update: ['full_name', 'phone', 'trade', 'role', 'active'] },
  app_settings: { update: ['org_name', 'labor_rate', 'allow_signup'] },
  sites: ['code', 'name', 'address'],
  locations: ['site_id', 'parent_id', 'name', 'kind', 'temp_zone'],
  asset_categories: ['name', 'is_mhe', 'sort'],
  vendors: ['name', 'service_type', 'contact_person', 'phone', 'email', 'address', 'notes', 'active'],
  contracts: ['vendor_id', 'site_id', 'title', 'scope', 'start_date', 'end_date', 'value', 'billing', 'renewal_notice_days', 'notes'],
  assets: ['code', 'name', 'category_id', 'site_id', 'location_id', 'parent_id', 'status', 'criticality', 'make', 'model', 'serial_no',
    'install_date', 'warranty_expiry', 'purchase_cost', 'vendor_id', 'mhe_type', 'capacity_kg', 'lift_height_mm', 'power_type',
    'battery_ref', 'ownership', 'current_meter', 'cert_expiry', 'notes'],
  meter_readings: ['asset_id', 'reading', 'source'],
  pm_schedules: ['title', 'instructions', 'site_id', 'asset_id', 'location_id', 'type', 'priority', 'assigned_to', 'vendor_id',
    'trigger_type', 'interval_value', 'interval_unit', 'schedule_mode', 'next_due', 'lead_days', 'meter_interval', 'meter_last',
    'meter_lead', 'tasks', 'estimated_hours', 'active'],
  work_orders: { insert: u => (isStaff(u) ? WO_STAFF : WO_REQUEST), update: WO_STAFF },
  wo_tasks: ['work_order_id', 'seq', 'description', 'result', 'note'],
  wo_labor: ['work_order_id', 'technician_id', 'work_date', 'hours', 'notes'],
  wo_activity: { insert: ['work_order_id', 'kind', 'body'] },
  parts: ['part_no', 'name', 'description', 'category', 'unit', 'site_id', 'bin_location', 'min_qty', 'max_qty', 'unit_cost', 'vendor_id', 'active', 'notes'],
  part_transactions: { insert: ['part_id', 'kind', 'qty', 'unit_cost', 'work_order_id', 'reference', 'notes'] },
  checklist_templates: ['name', 'description', 'applies_to', 'items', 'active'],
  checklist_submissions: { insert: ['asset_id', 'template_id', 'template_name', 'operator_name', 'shift', 'meter_reading', 'remarks', 'results'] },
  compliance_items: ['site_id', 'name', 'category', 'authority', 'reference', 'frequency_months', 'last_done', 'next_due', 'responsible_id',
    'vendor_id', 'document_url', 'notes', 'active'],
  compliance_events: { insert: ['item_id', 'done_date', 'next_due', 'notes', 'document_url'] }
};

// The columns `user` may set on `table` for 'insert' or 'update'.
export function writableColumns(user, table, op) {
  const w = WRITABLE[table];
  if (!w) return [];
  const list = Array.isArray(w) ? w : w[op];
  if (!list) return [];
  return typeof list === 'function' ? list(user) : list;
}

export const NO_ROWS = NONE;
