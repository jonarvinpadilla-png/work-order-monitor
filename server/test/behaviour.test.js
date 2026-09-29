// Behaviour tests for the rules and permissions: the same scenarios the
// Supabase version tested in SQL, run against the server's own database.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from '../db.js';
import { Store } from '../rules.js';
import { Accounts } from '../auth.js';
import { addDays, addInterval } from '../time.js';

const SITE = '10000000-0000-0000-0000-000000000001';
const LOC = '20000000-0000-0000-0000-000000000001';
const RT01 = '30000000-0000-0000-0000-000000000001';
const DOCK = '30000000-0000-0000-0000-000000000002';
const WO = '40000000-0000-0000-0000-000000000001';
const PART = '50000000-0000-0000-0000-000000000001';
const PM1 = '60000000-0000-0000-0000-000000000001';
const PM2 = '60000000-0000-0000-0000-000000000002';
const PM3 = '60000000-0000-0000-0000-000000000003';
const CK1 = '70000000-0000-0000-0000-000000000001';
const CK2 = '70000000-0000-0000-0000-000000000002';
const ITEM = '80000000-0000-0000-0000-000000000001';

test('roles, permissions and rules behave like the original database', async t => {
  const db = new Database(':memory:');
  const store = new Store(db);
  const accounts = new Accounts(store);
  const one = (sql, ...params) => db.get(sql, ...params);
  const woRow = id => store.row('work_orders', id);
  const check = (ok, msg) => t.test(msg, () => assert.ok(ok, msg));
  const rejects = (fn, pattern, msg) => t.test(msg, () => assert.throws(fn, err => pattern.test(err.message) || assert.fail(`wrong error: ${err.message}`)));

  // ------------------------------------------------------------ people
  let admin = await accounts.create({ email: 'admin@hlpi.test', password: 'password-a' });
  let tech = await accounts.create({ email: 'tech@hlpi.test', password: 'password-b' });
  const op = await accounts.create({ email: 'op@hlpi.test', password: 'password-c' });
  const op2 = await accounts.create({ email: 'op2@hlpi.test', password: 'password-d' });
  await check(admin.role === 'admin', 'first sign-up becomes admin');
  await check(op.role === 'requester', 'later sign-ups start as requester');
  store.update(admin, 'profiles', tech.id, { role: 'technician' });
  tech = accounts.profile(tech.id);
  store.update(admin, 'app_settings', 1, { labor_rate: 250 });

  store.insert(admin, 'sites', { id: SITE, code: 'PLD', name: 'Plaridel DC' });
  store.insert(admin, 'locations', { id: LOC, site_id: SITE, name: 'Freezer Room', temp_zone: 'Freezer' });
  const mhe = one("select id from asset_categories where name = 'Material Handling Equipment (MHE)'").id;
  store.insert(tech, 'assets', [
    { id: RT01, code: 'rt-01', name: 'Reach Truck 1', site_id: SITE, location_id: LOC, mhe_type: 'Reach Truck', current_meter: 240, category_id: mhe },
    { id: DOCK, code: null, name: 'Dock Leveler 1', site_id: SITE }
  ]);
  await check(store.row('assets', RT01).code === 'RT-01', 'asset tags are upper-cased');
  await check(/^AST-\d{4}$/.test(store.row('assets', DOCK).code), 'blank asset tag gets an AST- code');

  // ------------------------------------------------------ requester rules
  await rejects(() => store.update(op, 'profiles', op.id, { role: 'admin' }), /only an admin/i, 'requester cannot promote themselves');
  await rejects(() => store.insert(op, 'work_orders', { title: 'Light out', status: 'Open' }), /permission/i, 'requester cannot open a work order directly');
  store.insert(op, 'work_orders', { id: WO, title: 'Dock leveler lip not extending', status: 'Requested', asset_id: DOCK, priority: 'High' });
  await check(woRow(WO).requested_by === op.id, 'request is stamped with the requester');
  await check(woRow(WO).site_id === SITE, 'site is filled in from the asset');
  await check(store.select(op, 'parts').length === 0 && store.select(op, 'vendors').length === 0, 'requester cannot read parts or vendors');
  store.insert(op, 'wo_activity', { work_order_id: WO, body: 'It is dock 3' });
  await check(store.select(op, 'wo_activity', { eq: { work_order_id: WO } }).length === 2, 'requester sees and comments on own request');

  await check(store.select(op2, 'work_orders').length === 0, 'another requester cannot see it');
  await rejects(() => store.insert(op2, 'wo_activity', { work_order_id: WO, body: 'x' }), /permission/i, "another requester cannot comment on it");

  // ------------------------------------------------------------ approvals
  await rejects(() => store.update(tech, 'work_orders', WO, { status: 'Open' }), /only an admin can approve/i, 'technician cannot approve');
  await rejects(() => store.remove(tech, 'work_orders', WO), /permission/i, 'technician cannot delete a work order');
  await check(!!woRow(WO), 'technician delete is blocked (row still there)');

  store.update(admin, 'work_orders', WO, { status: 'Open', assigned_to: tech.id });
  await check(woRow(WO).approved_by === admin.id, 'admin approval is recorded');
  await check(!!one('select 1 from wo_activity where work_order_id = ? and body = ?', WO, 'Requested → Open'), 'status change is logged');
  await check(!!one('select 1 from wo_activity where work_order_id = ? and body = ?', WO, 'Assigned to tech'), 'assignment is logged');
  await rejects(() => store.update(admin, 'profiles', admin.id, { role: 'technician' }), /at least one active admin/i, 'the last admin cannot step down');

  // ------------------------------------------------------ work & labour
  store.update(tech, 'work_orders', WO, { status: 'In Progress' });
  await check(!!woRow(WO).started_at, 'start time is stamped');
  store.insert(tech, 'wo_labor', { work_order_id: WO, technician_id: tech.id, hours: 2.5 });
  await check(store.select(tech, 'wo_summary', { eq: { work_order_id: WO } })[0].labor_cost === 625, 'labour cost uses the standard rate');

  // --------------------------------------------------------------- stock
  store.insert(tech, 'parts', { id: PART, part_no: null, name: 'Hydraulic oil ISO 46', unit: 'L', min_qty: 20 });
  await check(/^P-\d{4}$/.test(store.row('parts', PART).part_no), 'blank part number gets a P- code');
  store.insert(tech, 'part_transactions', { part_id: PART, kind: 'Receive', qty: 40, unit_cost: 180 });
  store.insert(tech, 'part_transactions', { part_id: PART, kind: 'Issue', qty: 5, work_order_id: WO });
  await check(store.row('parts', PART).qty_on_hand === 35, 'receive and issue move stock');
  await rejects(() => store.insert(tech, 'part_transactions', { part_id: PART, kind: 'Return', qty: 6, work_order_id: WO }), /only 5 L of hydraulic/i, 'cannot return more than was issued');
  store.insert(tech, 'part_transactions', { part_id: PART, kind: 'Return', qty: 1, work_order_id: WO });
  await check(store.select(tech, 'wo_summary', { eq: { work_order_id: WO } })[0].parts_cost === 720, 'parts cost nets returns (4 L × 180)');
  await rejects(() => store.insert(tech, 'part_transactions', { part_id: PART, kind: 'Issue', qty: 100 }), /not enough stock/i, 'cannot issue more than on hand');
  await rejects(() => store.update(tech, 'parts', PART, { qty_on_hand: 999 }), /can't be set/i, 'stock on hand is not editable in the app');
  await rejects(() => store.transact(null, ctx => store._update(ctx, 'parts', PART, { qty_on_hand: 999 })), /stock movement/i, 'stock on hand only changes through movements');
  await rejects(() => store.insert(tech, 'part_transactions', { part_id: PART, kind: 'Adjust', qty: -1 }), /only an admin can adjust/i, 'only an admin can adjust counts');

  store.update(tech, 'work_orders', WO, { status: 'Completed', action_taken: 'Replaced seal' });
  await check(!!woRow(WO).completed_at, 'completion time is stamped');
  store.update(tech, 'work_orders', WO, { status: 'Open' });
  await check(woRow(WO).completed_at === null, 'reopening clears completion time');

  // ---------------------------------------------------------- PM: calendar
  const today = store.today();
  store.insert(tech, 'pm_schedules', {
    id: PM1, title: 'Dock leveler monthly PM', asset_id: DOCK, site_id: SITE, trigger_type: 'Calendar',
    interval_value: 1, interval_unit: 'month', next_due: addDays(today, 3), lead_days: 7, tasks: ['Lubricate hinge pins', 'Check hydraulic level', ' ']
  });
  store.insert(tech, 'pm_schedules', {
    id: PM3, title: 'Not due yet', asset_id: DOCK, site_id: SITE, trigger_type: 'Calendar',
    interval_value: 1, interval_unit: 'year', next_due: addDays(today, 60), lead_days: 7
  });
  // ------------------------------------------------------------ PM: meter
  store.insert(tech, 'pm_schedules', { id: PM2, title: 'RT-01 250-hour service', asset_id: RT01, trigger_type: 'Meter', meter_interval: 250, meter_last: 0, meter_lead: 20 });

  await check(store.rpc(tech, 'generate_pm_work_orders') === 2, 'generator creates the due calendar PM and the meter PM');
  await check(store.rpc(tech, 'generate_pm_work_orders') === 0, 'generator does not duplicate open PMs');
  await check(one('select count(*) n from wo_tasks t join work_orders w on w.id = t.work_order_id where w.pm_schedule_id = ?', PM1).n === 2, 'PM tasks copied (blank lines skipped)');
  await check(one('select due_date from work_orders where pm_schedule_id = ?', PM1).due_date === addDays(today, 3), 'PM work order due on the schedule date');

  const pmWo = sched => one("select id from work_orders where pm_schedule_id = ? and status = 'Open'", sched).id;
  store.update(tech, 'work_orders', pmWo(PM1), { status: 'Completed' });
  await check(store.row('pm_schedules', PM1).next_due === addInterval(addDays(today, 3), 1, 'month'), 'fixed schedule rolls forward one interval');

  store.update(tech, 'work_orders', pmWo(PM2), { status: 'Completed', meter_at_completion: 262 });
  await check(store.row('pm_schedules', PM2).meter_last === 262, 'meter schedule restarts from the completion reading');
  await check(store.row('assets', RT01).current_meter === 262, 'completion reading updates the hour meter');
  await check(store.rpc(tech, 'generate_pm_work_orders') === 0, 'nothing due right after completion');

  // Fixed schedules skip occurrences that are already in the past.
  store.update(tech, 'pm_schedules', PM1, { next_due: addDays(today, -70), interval_value: 1, interval_unit: 'month' });
  await check(store.rpc(tech, 'generate_pm_work_orders') === 1, 'overdue schedule generates');
  store.update(tech, 'work_orders', pmWo(PM1), { status: 'Completed' });
  await check(store.row('pm_schedules', PM1).next_due > today, 'late completion jumps to the next future date');

  // -------------------------------------------------- pre-use checklists
  store.insert(op, 'checklist_submissions', {
    id: CK1, asset_id: RT01, operator_name: 'Juan', shift: 'Shift 1', meter_reading: 270,
    results: [{ text: 'Horn works', critical: true, result: 'OK' }, { text: 'Tyres', critical: false, result: 'Fail', note: 'chunk missing' }]
  });
  await check(store.row('checklist_submissions', CK1).fail_count === 1, 'fail count computed');
  await check(store.row('assets', RT01).status === 'Needs Attention', 'non-critical failure flags the unit');
  await check(store.select(op, 'work_orders', { eq: { asset_id: RT01, status: 'Open', priority: 'High' } }).length === 1,
    'non-critical failure raises a High work order the operator can see');

  store.insert(op, 'checklist_submissions', {
    id: CK2, asset_id: RT01, operator_name: 'Juan', results: [{ text: 'Service brake', critical: true, result: 'Fail', note: 'spongy' }]
  });
  await check(store.row('assets', RT01).status === 'Out of Service', 'critical failure locks the unit out');
  await check(woRow(store.row('checklist_submissions', CK2).work_order_id).priority === 'Critical', 'critical failure raises a Critical work order');
  await check(store.select(op, 'checklist_submissions').length === 2, 'operator sees own checks');

  await check(one("select note from asset_status_log where asset_id = ? and status = 'Out of Service'", RT01).note === 'Locked out: critical defect on pre-use check',
    'lockout reason is in the status history');
  await check(store.row('assets', RT01).current_meter === 270, 'checklist meter reading updates the hour meter');
  await check(one('select body from wo_activity where work_order_id = ? order by id limit 1', store.row('checklist_submissions', CK2).work_order_id).body
    === 'Raised automatically by a failed pre-use check', 'auto work order explains its origin');

  // ------------------------------------------------------------ asset status
  store.rpc(tech, 'set_asset_status', { p_asset: RT01, p_status: 'Operational', p_note: 'Brake bled and tested' });
  await check(one('select note from asset_status_log where asset_id = ? order by id desc limit 1', RT01).note === 'Brake bled and tested', 'manual status change keeps its reason');
  await rejects(() => store.rpc(op, 'set_asset_status', { p_asset: RT01, p_status: 'Decommissioned' }), /do not have permission/i, 'requester cannot change asset status');

  // ------------------------------------------------------------- compliance
  store.insert(admin, 'compliance_items', { id: ITEM, name: 'BFP FSIC', frequency_months: 12, next_due: '2026-01-15' });
  store.insert(admin, 'compliance_events', { item_id: ITEM, done_date: '2026-01-10' });
  await check(store.row('compliance_items', ITEM).next_due === '2027-01-10', 'renewal rolls the due date by the frequency');
  await rejects(() => store.insert(tech, 'compliance_events', { item_id: ITEM, done_date: '2026-02-01' }), /permission/i, 'technician cannot record renewals');

  admin = accounts.profile(admin.id);
  db.close();
});

test('more rules: floating schedules, cancellations, reasons and deletes', async t => {
  const db = new Database(':memory:');
  const store = new Store(db);
  const accounts = new Accounts(store);
  const admin = await accounts.create({ email: 'boss@hlpi.test', password: 'password-1' });
  const op = await accounts.create({ email: 'req@hlpi.test', password: 'password-2' });
  const site = store.insert(admin, 'sites', { code: 'PLD', name: 'Plaridel DC' });
  const asset = store.insert(admin, 'assets', { name: 'Genset', site_id: site.id });
  const today = store.today();

  await t.test('floating schedule counts from the completion date', () => {
    const pm = store.insert(admin, 'pm_schedules', {
      title: 'Genset weekly run', asset_id: asset.id, trigger_type: 'Calendar', schedule_mode: 'Floating',
      interval_value: 1, interval_unit: 'week', next_due: addDays(today, -20), lead_days: 0
    });
    assert.equal(store.rpc(admin, 'generate_pm_work_orders'), 1);
    const wo = db.get('select id from work_orders where pm_schedule_id = ?', pm.id);
    store.update(admin, 'work_orders', wo.id, { status: 'Completed', action_taken: 'Ran 30 min' });
    assert.equal(store.row('pm_schedules', pm.id).next_due, addDays(today, 7));
    assert.ok(store.row('pm_schedules', pm.id).last_completed_at);
  });

  await t.test('cancelling a PM work order moves the schedule on without a completion', () => {
    const pm = store.insert(admin, 'pm_schedules', {
      title: 'Monthly check', asset_id: asset.id, trigger_type: 'Calendar', interval_value: 1, interval_unit: 'month', next_due: today, lead_days: 3
    });
    store.rpc(admin, 'generate_pm_work_orders');
    const wo = db.get('select id from work_orders where pm_schedule_id = ?', pm.id);
    store.update(admin, 'work_orders', wo.id, { status: 'Cancelled' });
    const after = store.row('pm_schedules', pm.id);
    assert.equal(after.next_due, addInterval(today, 1, 'month'));
    assert.equal(after.last_completed_at, null);
  });

  await t.test('month-end dates clamp like Postgres', () => {
    assert.equal(addInterval('2026-01-31', 1, 'month'), '2026-02-28');
    assert.equal(addInterval('2028-01-31', 1, 'month'), '2028-02-29');
    assert.equal(addInterval('2028-02-29', 1, 'year'), '2029-02-28');
    assert.equal(addInterval('2026-12-15', 2, 'week'), '2026-12-29');
  });

  await t.test('hold and reject reasons land in the activity log', () => {
    const w = store.insert(admin, 'work_orders', { title: 'Door stuck', site_id: site.id });
    store.update(admin, 'work_orders', w.id, { status: 'On Hold', hold_reason: 'Waiting for parts' });
    assert.ok(db.get('select 1 from wo_activity where work_order_id = ? and body = ?', w.id, 'Open → On Hold: Waiting for parts'));
    const r = store.insert(op, 'work_orders', { title: 'Light flickers', status: 'Requested', site_id: site.id });
    store.update(admin, 'work_orders', r.id, { status: 'Rejected', reject_reason: 'Duplicate' });
    assert.ok(db.get('select 1 from wo_activity where work_order_id = ? and body = ?', r.id, 'Requested → Rejected: Duplicate'));
    assert.throws(() => store.update(admin, 'work_orders', r.id, { status: 'Requested' }), /cannot be turned back/);
  });

  await t.test('requesters can only set request fields', () => {
    assert.throws(() => store.insert(op, 'work_orders', { title: 'x', status: 'Requested', site_id: site.id, assigned_to: admin.id }), /can't be set/);
    assert.throws(() => store.insert(op, 'work_orders', { title: 'x', status: 'Requested', requested_by: admin.id, site_id: site.id }), /permission/);
    assert.throws(() => store.insert(admin, 'work_orders', { title: 'x', bogus: 1 }), /Unknown field/);
    assert.throws(() => store.update(op, 'profiles', admin.id, { full_name: 'Hacked' }), /permission/);
    store.update(op, 'profiles', op.id, { full_name: 'Rosa Ops', phone: '0917' });
    assert.equal(accounts.profile(op.id).full_name, 'Rosa Ops');
    assert.equal(store.select(op, 'asset_status_log').length, 0);
    assert.equal(store.select(op, 'wo_summary').length, 0);
  });

  await t.test('deleting a work order removes its tasks and log; only admins may', () => {
    const w = store.insert(admin, 'work_orders', { title: 'Temp', site_id: site.id });
    store.insert(admin, 'wo_tasks', { work_order_id: w.id, seq: 1, description: 'Check' });
    store.remove(admin, 'work_orders', w.id);
    assert.equal(db.get('select count(*) n from wo_tasks where work_order_id = ?', w.id).n, 0);
    assert.equal(db.get('select count(*) n from wo_activity where work_order_id = ?', w.id).n, 0);
  });

  await t.test('friendly messages for duplicates and records still in use', () => {
    store.insert(admin, 'assets', { code: 'GEN-01', name: 'Genset 1', site_id: site.id });
    assert.throws(() => store.insert(admin, 'assets', { code: 'gen-01', name: 'Genset 2', site_id: site.id }), /asset tag is already in use/);
    assert.throws(() => store.remove(admin, 'sites', site.id), /still used elsewhere/);
    assert.throws(() => store.insert(admin, 'pm_schedules', { title: 'Bad', trigger_type: 'Calendar' }), /need an interval and a next due date/);
    assert.throws(() => store.insert(admin, 'wo_labor', { work_order_id: '00000000-0000-0000-0000-000000000000', hours: 1 }), /linked record no longer exists/);
    assert.throws(() => store.insert(admin, 'assets', { name: 'No site' }), /Site is required/);
    assert.throws(() => store.insert(admin, 'wo_labor', { hours: 'lots' }), /must be a number/);
  });

  await t.test('changes report the tables they touched', () => {
    const seen = [];
    store.onChange = tables => seen.push(...tables);
    const w = store.insert(admin, 'work_orders', { title: 'Report me', site_id: site.id });
    assert.ok(seen.includes('work_orders') && seen.includes('wo_activity'));
    seen.length = 0;
    store.remove(admin, 'work_orders', w.id);
    assert.ok(seen.includes('work_orders') && seen.includes('wo_tasks') && seen.includes('checklist_submissions'));
  });

  db.close();
});
