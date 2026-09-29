import { randomUUID } from 'node:crypto';
import { POLICIES, isAdmin, isStaff, writableColumns } from './access.js';
import { ValidationError, coerce, roundTo } from './db.js';
import { addDays, addInterval, addMonths, localDate, localYearMonth } from './time.js';

// An error with an HTTP status. The message is shown to the user as is.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// A business rule said no (e.g. "Not enough stock").
export class RuleError extends HttpError {
  constructor(message) {
    super(400, message);
  }
}

export const forbidden = () => new HttpError(403, "You don't have permission to do that.");
const missing = what => new HttpError(404, `You don't have permission to ${what} this record, or it no longer exists.`);

const ACTIVE_OR_OPEN_EXCLUDED = ['Completed', 'Cancelled', 'Rejected'];
const DONE = ['Completed', 'Cancelled'];

const UNIQUE_MESSAGES = {
  'assets.code': 'That asset tag is already in use.',
  'parts.part_no': 'That part number is already in use.',
  'vendors.name': 'A vendor with that name already exists.',
  'sites.code': 'That site code is already in use.',
  'asset_categories.name': 'That category already exists.',
  'checklist_templates.name': 'A checklist with that name already exists.',
  'work_orders.code': 'That work order number is already in use.',
  'users.email': 'An account with that email already exists.'
};

// SQLite constraint errors → messages a technician can act on.
export function friendlyDbError(e, op) {
  const msg = e?.message || '';
  if (e?.code !== 'ERR_SQLITE_ERROR' || !/constraint failed/i.test(msg)) return null;
  let m;
  if ((m = /UNIQUE constraint failed: (\w+)\.(\w+)/.exec(msg))) return new HttpError(409, UNIQUE_MESSAGES[`${m[1]}.${m[2]}`] || 'That value is already in use.');
  if (/FOREIGN KEY constraint failed/.test(msg)) {
    return new HttpError(409, op === 'delete'
      ? 'This record is still used elsewhere, so it cannot be deleted.'
      : 'A linked record no longer exists. Refresh the page and try again.');
  }
  if (/pm_calendar_fields/.test(msg)) return new HttpError(400, 'Calendar schedules need an interval and a next due date.');
  if (/pm_meter_fields/.test(msg)) return new HttpError(400, 'Hour-meter schedules need an asset and an hour interval.');
  if ((m = /NOT NULL constraint failed: \w+\.(\w+)/.exec(msg))) {
    const name = m[1].replace(/_id$/, '').replace(/_/g, ' ');
    return new HttpError(400, `${name[0].toUpperCase()}${name.slice(1)} is required.`);
  }
  return new HttpError(400, 'One of the values is not allowed. Check the form and try again.');
}

const sameValue = (a, b) => (a !== null && typeof a === 'object') || (b !== null && typeof b === 'object')
  ? JSON.stringify(a) === JSON.stringify(b)
  : a === b;

// A stock quantity without trailing zeros: 5, 2.5, 0.25.
const qtyText = n => String(roundTo(Number(n) || 0, 2));

// ---------------------------------------------------------------------------
// Rules that run when rows are written: the port of the Postgres triggers.
// Each hook gets the store, the operation context and the row(s). Hooks run
// for every write, including the ones other rules make, and inside the same
// transaction, so a failure anywhere undoes the whole operation.
// ---------------------------------------------------------------------------
const HOOKS = {
  profiles: {
    beforeUpdate(s, ctx, old, row) {
      if ((row.role !== old.role || row.active !== old.active) && !ctx.system && !isAdmin(ctx.user)) {
        throw new RuleError('Only an admin can change roles or deactivate accounts.');
      }
      if (old.role === 'admin' && old.active && (row.role !== 'admin' || !row.active)
          && !s.db.get("select 1 from profiles where role = 'admin' and active = 1 and id <> ?", old.id)) {
        throw new RuleError('At least one active admin is required.');
      }
      row.id = old.id;
      row.email = old.email;
    }
  },

  // Readable codes (AST-0001) and the status history behind MHE availability.
  assets: {
    beforeInsert(s, ctx, row) { row.code = s.makeCode(row.code, 'AST-', 'asset_code_seq', 'assets', 'code'); },
    beforeUpdate(s, ctx, old, row, keys) { if (keys.has('code')) row.code = s.makeCode(row.code, 'AST-', 'asset_code_seq', 'assets', 'code'); },
    afterInsert(s, ctx, row) { s.logStatus(ctx, row); },
    afterUpdate(s, ctx, old, row) { if (row.status !== old.status) s.logStatus(ctx, row); }
  },

  // Stock on hand only moves through part_transactions.
  parts: {
    beforeInsert(s, ctx, row) { row.part_no = s.makeCode(row.part_no, 'P-', 'part_no_seq', 'parts', 'part_no'); },
    beforeUpdate(s, ctx, old, row, keys) {
      if (keys.has('part_no')) row.part_no = s.makeCode(row.part_no, 'P-', 'part_no_seq', 'parts', 'part_no');
      if (row.qty_on_hand !== old.qty_on_hand && !ctx.stockSync) {
        throw new RuleError('Stock on hand changes only through a stock movement (receive, issue, return or adjust).');
      }
    }
  },

  // Hour meter readings keep the asset's current meter up to date.
  meter_readings: {
    defaults: ctx => ({ recorded_by: ctx.uid, recorded_at: ctx.now }),
    afterInsert(s, ctx, r) {
      const a = s.row('assets', r.asset_id);
      if (a && (a.current_meter === null || r.reading >= a.current_meter)) {
        s._update(ctx, 'assets', a.id, { current_meter: r.reading, meter_updated_at: r.recorded_at });
      }
    }
  },

  // Work orders: numbers, defaults, the approval gate, timestamps, the
  // activity log, meter capture and PM roll-forward.
  work_orders: {
    beforeInsert(s, ctx, row) {
      if (!row.code || !row.code.trim()) row.code = s.newWorkOrderCode();
      row.requested_by ??= ctx.uid;
      row.created_by ??= ctx.uid;
      s.fillPlace(row);
      stampWork(ctx, null, row);
    },
    beforeUpdate(s, ctx, old, row) {
      s.fillPlace(row);
      if (old.status === 'Requested' && row.status !== 'Requested') {
        if (!ctx.system && !isAdmin(ctx.user)) throw new RuleError('Only an admin can approve or reject a request.');
        row.approved_by = ctx.uid ?? row.approved_by;
        row.approved_at = ctx.now;
      } else if (row.status === 'Requested' && old.status !== 'Requested') {
        throw new RuleError('A work order cannot be turned back into a request.');
      }
      stampWork(ctx, old, row);
    },
    afterInsert(s, ctx, row) {
      const body = ctx.woOrigin
        || (row.status === 'Requested' ? 'Request submitted' : row.pm_schedule_id ? 'Generated from PM schedule' : 'Work order created');
      ctx.woOrigin = null;
      s.activity(ctx, row.id, 'system', body);
    },
    afterUpdate(s, ctx, old, row) {
      if (row.status !== old.status) {
        const why = row.status === 'On Hold' && row.hold_reason ? `: ${row.hold_reason}`
          : row.status === 'Rejected' && row.reject_reason ? `: ${row.reject_reason}` : '';
        s.activity(ctx, row.id, 'status', `${old.status} → ${row.status}${why}`);
      }
      if (row.assigned_to !== old.assigned_to) {
        const p = row.assigned_to ? s.db.get('select full_name, email from profiles where id = ?', row.assigned_to) : null;
        const name = p ? (p.full_name ?? p.email) : null;
        s.activity(ctx, row.id, 'system', name ? `Assigned to ${name}` : 'Unassigned');
      }
      if (row.status === 'Completed' && old.status !== 'Completed' && row.asset_id && row.meter_at_completion !== null) {
        s._insert(ctx, 'meter_readings', { asset_id: row.asset_id, reading: row.meter_at_completion, source: 'Work order' });
      }
      if (row.pm_schedule_id && DONE.includes(row.status) && !DONE.includes(old.status)) s.rollPmForward(ctx, row);
    }
  },

  // Task sign-off stamps.
  wo_tasks: {
    beforeInsert(s, ctx, row) { stampTask(ctx, null, row); },
    beforeUpdate(s, ctx, old, row) { stampTask(ctx, old, row); }
  },

  // Labour picks up the standard rate from settings.
  wo_labor: {
    defaults: (ctx, s) => ({ work_date: s.today(), created_by: ctx.uid }),
    beforeInsert(s, ctx, row) { if (row.rate === null || row.rate === undefined) row.rate = s.settings().labor_rate ?? 0; }
  },

  wo_activity: {
    defaults: ctx => ({ kind: 'comment', author_id: ctx.uid })
  },

  part_transactions: {
    defaults: ctx => ({ created_by: ctx.uid }),
    beforeInsert(s, ctx, row) { s.applyStockMovement(ctx, row); }
  },

  checklist_submissions: {
    defaults: ctx => ({ submitted_by: ctx.uid }),
    beforeInsert(s, ctx, row) { s.applyPreUseCheck(ctx, row); }
  },

  compliance_events: {
    defaults: ctx => ({ recorded_by: ctx.uid }),
    beforeInsert(s, ctx, row) { s.applyComplianceEvent(ctx, row); }
  }
};

function stampWork(ctx, old, row) {
  if (row.status === 'In Progress' && !row.started_at) row.started_at = ctx.now;
  if (row.status === 'Completed') row.completed_at ??= ctx.now;
  else if (old && old.status === 'Completed') row.completed_at = null;
}

function stampTask(ctx, old, row) {
  if (row.result === null || row.result === undefined) {
    row.done_by = null;
    row.done_at = null;
  } else if (!old || row.result !== old.result) {
    row.done_by = ctx.uid;
    row.done_at = ctx.now;
  }
}

const isCritical = r => r?.critical === true || r?.critical === 'true';

export class Store {
  constructor(db, { onChange } = {}) {
    this.db = db;
    this.onChange = onChange || (() => {});
  }

  // --------------------------------------------------------------- context

  // Everything one operation needs: who is doing it (null = the server
  // itself, e.g. the daily PM run), one timestamp for the whole operation
  // and the tables it touched.
  context(user) {
    return {
      user: user || null,
      uid: user?.id ?? null,
      system: !user,
      now: new Date().toISOString(),
      changed: new Set(),
      statusNote: null,
      woOrigin: null,
      stockSync: false
    };
  }

  // Runs fn(ctx) in one transaction, then reports the tables that changed.
  transact(user, fn, op = 'write') {
    const ctx = this.context(user);
    let result;
    try {
      result = this.db.tx(() => fn(ctx));
    } catch (e) {
      throw friendlyDbError(e, op) || e;
    }
    if (ctx.changed.size) this.onChange([...ctx.changed]);
    return result;
  }

  settings() { return this.db.decodeRow('app_settings', this.db.get('select * from app_settings where id = 1')); }
  timezone() { return this.settings()?.timezone || 'Asia/Manila'; }
  today() { return localDate(this.timezone()); }

  row(table, id) {
    return id === null || id === undefined ? null : this.db.decodeRow(table, this.db.get(`select * from "${table}" where id = ?`, id));
  }

  nextval(name) {
    return this.db.get('insert into counters (name, value) values (?, 1) on conflict (name) do update set value = value + 1 returning value', name).value;
  }

  // AST-0001 / P-0001 when the field is blank; always upper case.
  makeCode(value, prefix, counter, table, column) {
    const given = typeof value === 'string' ? value.trim() : '';
    if (given) return given.toUpperCase();
    let code;
    do code = `${prefix}${String(this.nextval(counter)).padStart(4, '0')}`;
    while (this.db.get(`select 1 from "${table}" where "${column}" = ?`, code));
    return code;
  }

  // WO-YYMM-0001, numbered continuously across months.
  newWorkOrderCode() {
    const yymm = localYearMonth(this.timezone());
    let code;
    do code = `WO-${yymm}-${String(this.nextval('wo_code_seq')).padStart(4, '0')}`;
    while (this.db.get('select 1 from work_orders where code = ?', code));
    return code;
  }

  // Site and location follow the asset (or the location) when left blank.
  fillPlace(row) {
    if (row.asset_id && (!row.site_id || !row.location_id)) {
      const a = this.db.get('select site_id, location_id from assets where id = ?', row.asset_id);
      row.site_id ||= a?.site_id ?? null;
      row.location_id ||= a?.location_id ?? null;
    }
    if (!row.site_id && row.location_id) {
      row.site_id = this.db.get('select site_id from locations where id = ?', row.location_id)?.site_id ?? null;
    }
  }

  logStatus(ctx, asset) {
    this._insert(ctx, 'asset_status_log', {
      asset_id: asset.id, status: asset.status, note: ctx.statusNote || null, changed_by: ctx.uid, changed_at: ctx.now
    });
  }

  activity(ctx, workOrderId, kind, body) {
    this._insert(ctx, 'wo_activity', { work_order_id: workOrderId, kind, body, author_id: ctx.uid });
  }

  // ------------------------------------------------------ internal writes
  // These apply the rules but not the permission checks; the API methods
  // below check permissions first.

  coerceRow(table, input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ValidationError('Expected one record.');
    const cols = this.db.columns(table);
    const out = {};
    for (const [k, v] of Object.entries(input)) {
      const meta = cols.get(k);
      if (!meta) throw new ValidationError(`Unknown field "${k}".`);
      out[k] = coerce(k, meta, v);
    }
    return out;
  }

  _insert(ctx, table, input, check) {
    const hooks = HOOKS[table] || {};
    const cols = this.db.columns(table);
    const row = this.coerceRow(table, input);
    if (cols.get('id')?.kind === 'uuid' && !row.id) row.id = randomUUID();
    if (cols.has('created_at') && !row.created_at) row.created_at = ctx.now;
    if (cols.has('updated_at')) row.updated_at = ctx.now;
    if (hooks.defaults) {
      for (const [k, v] of Object.entries(hooks.defaults(ctx, this))) if (row[k] === undefined) row[k] = v;
    }
    hooks.beforeInsert?.(this, ctx, row);
    if (check && !check(row)) throw forbidden();
    // A blank value for a required column with a default takes the default.
    const keys = Object.keys(row).filter(k => row[k] !== undefined && !(row[k] === null && cols.get(k)?.notnull && cols.get(k)?.hasDefault));
    const sql = keys.length
      ? `insert into "${table}" (${keys.map(k => `"${k}"`).join(', ')}) values (${keys.map(() => '?').join(', ')}) returning *`
      : `insert into "${table}" default values returning *`;
    const stored = this.db.decodeRow(table, this.db.get(sql, ...keys.map(k => this.db.encodeValue(table, k, row[k]))));
    ctx.changed.add(table);
    hooks.afterInsert?.(this, ctx, stored);
    return stored;
  }

  _update(ctx, table, id, patchInput, check) {
    const hooks = HOOKS[table] || {};
    const old = this.row(table, id);
    if (!old) throw missing('change');
    const patch = this.coerceRow(table, patchInput);
    const row = { ...old, ...patch };
    if (this.db.columns(table).has('updated_at')) row.updated_at = ctx.now;
    hooks.beforeUpdate?.(this, ctx, old, row, new Set(Object.keys(patch)));
    if (check && !check(row)) throw forbidden();
    const changed = Object.keys(row).filter(k => !sameValue(row[k], old[k]));
    let stored = old;
    if (changed.length) {
      const sql = `update "${table}" set ${changed.map(k => `"${k}" = ?`).join(', ')} where id = ? returning *`;
      stored = this.db.decodeRow(table, this.db.get(sql, ...changed.map(k => this.db.encodeValue(table, k, row[k])), old.id));
      ctx.changed.add(table);
    }
    hooks.afterUpdate?.(this, ctx, old, stored);
    return stored;
  }

  _delete(ctx, table, id) {
    const old = this.row(table, id);
    if (!old) throw missing('delete');
    this.db.run(`delete from "${table}" where id = ?`, old.id);
    // Foreign keys cascade or clear links in other tables; tell their viewers too.
    const seen = new Set([table]);
    const queue = [table];
    while (queue.length) {
      for (const t of this.db.referencing(queue.shift())) if (!seen.has(t)) { seen.add(t); queue.push(t); }
    }
    seen.forEach(t => ctx.changed.add(t));
    return old;
  }

  // -------------------------------------------------------- stock ledger

  applyStockMovement(ctx, row) {
    const p = this.row('parts', row.part_id);
    if (!p) throw new RuleError('Part not found.');
    if (row.kind === 'Adjust' && !ctx.system && !isAdmin(ctx.user)) throw new RuleError('Only an admin can adjust stock counts.');
    if (!row.qty) throw new RuleError('Enter a quantity other than zero.');

    if (row.kind === 'Receive' || row.kind === 'Return') row.qty = Math.abs(row.qty);
    else if (row.kind === 'Issue') row.qty = -Math.abs(row.qty);

    if (row.kind === 'Return' && row.work_order_id) {
      const issued = -(this.db.get(`select coalesce(sum(qty), 0) as q from part_transactions
                                    where part_id = ? and work_order_id = ? and kind in ('Issue','Return')`, p.id, row.work_order_id).q);
      if (row.qty > issued + 1e-9) {
        throw new RuleError(`Only ${qtyText(issued)} ${p.unit} of ${p.name} was issued to this work order.`);
      }
      if (row.unit_cost === null || row.unit_cost === undefined) {
        row.unit_cost = this.db.get(`select unit_cost from part_transactions where part_id = ? and work_order_id = ? and kind = 'Issue'
                                     order by created_at desc, id desc limit 1`, p.id, row.work_order_id)?.unit_cost ?? null;
      }
    }

    if (p.qty_on_hand + row.qty < -1e-9) {
      throw new RuleError(`Not enough stock of ${p.name}: ${qtyText(p.qty_on_hand)} ${p.unit} on hand.`);
    }
    if (row.unit_cost === null || row.unit_cost === undefined) row.unit_cost = p.unit_cost;

    const patch = { qty_on_hand: roundTo(p.qty_on_hand + row.qty, 2) };
    if (row.kind === 'Receive' && row.unit_cost > 0) patch.unit_cost = row.unit_cost;
    ctx.stockSync = true;
    try {
      this._update(ctx, 'parts', p.id, patch);
    } finally {
      ctx.stockSync = false;
    }
  }

  // ---------------------------------------------- MHE pre-use checklists
  // A failed item raises a work order; a failed critical item locks the
  // unit out until a technician returns it to service.

  applyPreUseCheck(ctx, row) {
    const a = this.row('assets', row.asset_id);
    if (!a) throw new RuleError('Asset not found.');
    if (!ctx.system) row.submitted_by = ctx.uid;
    if (!row.template_name && row.template_id) {
      row.template_name = this.db.get('select name from checklist_templates where id = ?', row.template_id)?.name ?? null;
    }
    if (row.meter_reading !== null && row.meter_reading !== undefined && row.meter_reading < 0) {
      throw new RuleError("The hour meter reading can't be negative.");
    }

    const results = Array.isArray(row.results) ? row.results : [];
    const failed = results.filter(r => r && r.result === 'Fail');
    row.results = results;
    row.fail_count = failed.length;
    row.critical_fail = failed.some(isCritical);

    if (row.meter_reading !== null && row.meter_reading !== undefined) {
      this._insert(ctx, 'meter_readings', { asset_id: a.id, reading: row.meter_reading, source: 'Pre-use check', recorded_by: row.submitted_by ?? null });
    }

    if (row.fail_count > 0) {
      const n = row.fail_count;
      const list = failed.map(r => `• ${r.text}${isCritical(r) ? ' [CRITICAL]' : ''}${r.note ? ` — ${r.note}` : ''}`).join('\n');
      ctx.woOrigin = 'Raised automatically by a failed pre-use check';
      const wo = this._insert(ctx, 'work_orders', {
        title: `Pre-use check failed: ${a.code} (${n} ${n === 1 ? 'item' : 'items'})`,
        description: `Reported by ${row.operator_name || 'operator'}${row.shift ? ` · ${row.shift}` : ''}\n\nFailed items:\n${list}`
          + (row.remarks ? `\n\nRemarks: ${row.remarks}` : ''),
        type: 'Corrective',
        priority: row.critical_fail ? 'Critical' : 'High',
        status: 'Open',
        site_id: a.site_id, location_id: a.location_id, asset_id: a.id,
        requested_by: row.submitted_by ?? null,
        requester_name: row.operator_name ?? null,
        asset_down: row.critical_fail,
        due_date: addDays(this.today(), row.critical_fail ? 0 : 2)
      });
      row.work_order_id = wo.id;

      if (row.critical_fail && a.status !== 'Decommissioned') {
        if (a.status !== 'Out of Service') this.withStatusNote(ctx, 'Locked out: critical defect on pre-use check', () => this._update(ctx, 'assets', a.id, { status: 'Out of Service' }));
      } else if (a.status === 'Operational') {
        this.withStatusNote(ctx, 'Defect reported on pre-use check', () => this._update(ctx, 'assets', a.id, { status: 'Needs Attention' }));
      }
    }
  }

  withStatusNote(ctx, note, fn) {
    ctx.statusNote = note;
    try {
      return fn();
    } finally {
      ctx.statusNote = null;
    }
  }

  // ------------------------------------------ compliance renewals

  applyComplianceEvent(ctx, row) {
    const item = this.row('compliance_items', row.item_id);
    if (!item) throw new RuleError('Compliance requirement not found.');
    if (!row.next_due && item.frequency_months) row.next_due = addMonths(row.done_date, item.frequency_months);
    this._update(ctx, 'compliance_items', item.id, {
      last_done: row.done_date,
      next_due: row.next_due ?? item.next_due,
      document_url: row.document_url || item.document_url
    });
  }

  // ------------------------------------- preventive maintenance

  // Moves a schedule on once its work order is closed out.
  rollPmForward(ctx, wo) {
    const s = this.row('pm_schedules', wo.pm_schedule_id);
    if (!s) return;
    const completed = wo.status === 'Completed';
    const patch = completed ? { last_completed_at: wo.completed_at } : {};
    if (s.trigger_type === 'Calendar') {
      if (!s.interval_value || !s.interval_unit || !s.next_due) return;
      let next;
      if (s.schedule_mode === 'Floating' && completed) {
        next = addInterval(localDate(this.timezone(), new Date(wo.completed_at)), s.interval_value, s.interval_unit);
      } else {
        const today = this.today();
        next = addInterval(s.next_due, s.interval_value, s.interval_unit);
        while (next <= today) next = addInterval(next, s.interval_value, s.interval_unit);
      }
      patch.next_due = next;
    } else {
      const meter = this.db.get('select current_meter from assets where id = ?', s.asset_id)?.current_meter ?? null;
      patch.meter_last = wo.meter_at_completion ?? meter ?? (s.meter_last + s.meter_interval);
    }
    this._update(ctx, 'pm_schedules', s.id, patch);
  }

  // Creates a work order for every active schedule that is due (calendar
  // date within its lead time, or hour meter within its lead) and has no
  // work order still open. Safe to run as often as you like.
  generatePm(ctx) {
    if (!ctx.system && !isStaff(ctx.user)) throw new RuleError('Only technicians and admins can generate PM work orders.');
    const today = this.today();
    const schedules = this.db.all(`select p.*, a.current_meter as a_meter, a.site_id as a_site, a.location_id as a_location, a.status as a_status
                                   from pm_schedules p left join assets a on a.id = p.asset_id
                                   where p.active = 1 order by p.created_at, p.id`);
    let created = 0;
    for (const raw of schedules) {
      const s = this.db.decodeRow('pm_schedules', raw);
      if (raw.a_status === 'Decommissioned') continue;
      if (this.db.get(`select 1 from work_orders where pm_schedule_id = ? and status not in (${ACTIVE_OR_OPEN_EXCLUDED.map(() => '?').join(',')}) limit 1`,
        s.id, ...ACTIVE_OR_OPEN_EXCLUDED)) continue;

      let due = null;
      if (s.trigger_type === 'Calendar') {
        if (s.next_due && addDays(s.next_due, -s.lead_days) <= today) due = s.next_due;
      } else if (raw.a_meter !== null && s.meter_interval !== null && raw.a_meter >= s.meter_last + s.meter_interval - s.meter_lead) {
        due = addDays(today, 7);
      }
      if (!due) continue;

      const wo = this._insert(ctx, 'work_orders', {
        title: s.title, description: s.instructions, type: s.type, priority: s.priority, status: 'Open',
        site_id: s.site_id ?? raw.a_site ?? null, location_id: s.location_id ?? raw.a_location ?? null, asset_id: s.asset_id,
        pm_schedule_id: s.id, assigned_to: s.assigned_to, vendor_id: s.vendor_id, due_date: due, estimated_hours: s.estimated_hours
      });
      (Array.isArray(s.tasks) ? s.tasks : []).forEach((t, i) => {
        const text = typeof t === 'string' || typeof t === 'number' ? String(t).trim() : '';
        if (text) this._insert(ctx, 'wo_tasks', { work_order_id: wo.id, seq: i + 1, description: text });
      });
      this._update(ctx, 'pm_schedules', s.id, { last_generated_at: ctx.now });
      created++;
    }
    return created;
  }

  // Change an asset's status with a reason that lands in its history.
  setAssetStatus(ctx, { p_asset, p_status, p_note } = {}) {
    const id = typeof p_asset === 'string' ? p_asset.toLowerCase() : null;
    const asset = ctx.system ? this.row('assets', id)
      : POLICIES.assets.update.allow(ctx.user) ? this.visibleRow(ctx.user, 'assets', id) : null;
    if (!asset) throw new RuleError('Asset not found, or you do not have permission to change it.');
    this.withStatusNote(ctx, p_note ? String(p_note) : null, () => this._update(ctx, 'assets', asset.id, { status: p_status }));
    return null;
  }

  // ---------------------------------------------------- permissions

  visibleRow(user, table, id) {
    if (id === null || id === undefined) return null;
    const f = POLICIES[table].select(user);
    return this.db.decodeRow(table, this.db.get(`select * from "${table}" where id = ? and (${f.sql})`, id, ...f.params));
  }

  can(user) {
    return { see: (table, id) => !!this.visibleRow(user, table, id) };
  }

  policy(table) {
    const p = POLICIES[table];
    if (!p) throw new HttpError(404, 'Unknown table.');
    return p;
  }

  checkWritable(user, table, op, input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ValidationError('Expected one record.');
    const allowed = new Set(writableColumns(user, table, op));
    const cols = this.db.columns(table);
    if (op === 'insert' && cols.get('id')?.kind === 'uuid') allowed.add('id');
    for (const k of Object.keys(input)) {
      if (allowed.has(k)) continue;
      if (!cols.has(k)) throw new ValidationError(`Unknown field "${k}".`);
      throw new HttpError(403, `The field "${k}" can't be set here.`);
    }
  }

  idFor(table, id) {
    const meta = this.db.columns(table).get('id');
    try {
      return meta ? coerce('id', meta, id) : null;
    } catch {
      return null;
    }
  }

  // ------------------------------------------------------------ API
  // What the app calls. Permissions are checked here; rules run inside.

  select(user, table, spec) {
    const f = this.policy(table).select(user);
    if (f.sql === '0') return [];
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) spec = {};
    const cols = this.db.columns(table);
    const col = c => {
      if (!cols.has(c)) throw new ValidationError(`Unknown field "${c}".`);
      return `"${c}"`;
    };
    const where = [`(${f.sql})`];
    const params = [...f.params];
    for (const [op, sqlOp] of [['eq', '='], ['gte', '>='], ['lte', '<=']]) {
      const filters = spec[op] && typeof spec[op] === 'object' ? spec[op] : {};
      for (const [c, v] of Object.entries(filters)) {
        if (v === null && op === 'eq') { where.push(`${col(c)} is null`); continue; }
        where.push(`${col(c)} ${sqlOp} ?`);
        params.push(this.db.encodeValue(table, c, coerce(c, cols.get(c), v)));
      }
    }
    const order = (Array.isArray(spec.order) ? spec.order : []).map(o => {
      if (!Array.isArray(o)) throw new ValidationError('The sort order was not valid.');
      const [c, dir, nulls] = o;
      const d = dir === 'desc' ? 'desc' : 'asc';
      const n = nulls === 'first' || nulls === 'last' ? nulls : d === 'asc' ? 'last' : 'first';
      return `${col(c)}${cols.get(c).kind === 'text' ? ' collate nocase' : ''} ${d} nulls ${n}`;
    });
    let sql = `select * from "${table}" where ${where.join(' and ')}`;
    if (order.length) sql += ` order by ${order.join(', ')}`;
    const limit = spec.limit === undefined || spec.limit === null ? 100000 : Math.min(Math.max(Math.trunc(Number(spec.limit)) || 1, 1), 100000);
    sql += ' limit ? offset ?';
    params.push(limit, Math.max(Math.trunc(Number(spec.offset)) || 0, 0));
    return this.db.all(sql, ...params).map(r => this.db.decodeRow(table, r));
  }

  insert(user, table, input) {
    const policy = this.policy(table).insert;
    if (!policy || !policy.allow(user)) throw forbidden();
    const many = Array.isArray(input);
    const rows = many ? input : [input];
    if (rows.length > 500) throw new ValidationError('Too many records at once.');
    rows.forEach(r => this.checkWritable(user, table, 'insert', r));
    const can = this.can(user);
    const saved = this.transact(user, ctx => rows.map(r => this._insert(ctx, table, r, row => !policy.row || policy.row(user, row, can))), 'insert');
    return many ? saved : saved[0];
  }

  update(user, table, id, patch) {
    const policy = this.policy(table).update;
    if (!policy || !policy.allow(user)) throw missing('change');
    this.checkWritable(user, table, 'update', patch);
    const key = this.idFor(table, id);
    return this.transact(user, ctx => {
      const old = this.visibleRow(user, table, key);
      if (!old || (policy.row && !policy.row(user, old))) throw missing('change');
      return this._update(ctx, table, key, patch, row => !policy.row || policy.row(user, row));
    }, 'update');
  }

  remove(user, table, id) {
    const policy = this.policy(table).delete;
    if (!policy || !policy.allow(user)) throw missing('delete');
    const key = this.idFor(table, id);
    return this.transact(user, ctx => {
      const old = this.visibleRow(user, table, key);
      if (!old || (policy.row && !policy.row(user, old))) throw missing('delete');
      return this._delete(ctx, table, key);
    }, 'delete');
  }

  rpc(user, name, args) {
    switch (name) {
      case 'generate_pm_work_orders': return this.transact(user, ctx => this.generatePm(ctx));
      case 'set_asset_status': return this.transact(user, ctx => this.setAssetStatus(ctx, args || {}), 'update');
      default: throw new HttpError(404, 'Unknown action.');
    }
  }
}
