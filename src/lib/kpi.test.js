import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backlogAging, mheAvailability, mttr, pmCompliance, weeklyThroughput } from './kpi.js';
import { addInterval, daysUntil } from './format.js';
import { dueInfo, pmForecast, pmNextInfo, stockInfo } from './domain.js';

const now = new Date('2026-09-29T10:00:00');

test('addInterval clamps month ends like Postgres', () => {
  assert.equal(addInterval('2026-01-31', 1, 'month'), '2026-02-28');
  assert.equal(addInterval('2028-02-29', 1, 'year'), '2029-02-28');
  assert.equal(addInterval('2026-09-29', 2, 'week'), '2026-10-13');
  assert.equal(addInterval('2026-12-15', 3, 'month'), '2027-03-15');
});

test('daysUntil counts calendar days', () => {
  assert.equal(daysUntil('2026-09-29', now), 0);
  assert.equal(daysUntil('2026-09-30', now), 1);
  assert.equal(daysUntil('2026-09-20', now), -9);
});

test('PM compliance counts on-time completions of planned work due in the window', () => {
  const wos = [
    { type: 'Preventive', status: 'Completed', due_date: '2026-09-20', completed_at: '2026-09-19T08:00:00' },
    { type: 'Preventive', status: 'Completed', due_date: '2026-09-20', completed_at: '2026-09-22T08:00:00' }, // late
    { type: 'Inspection', status: 'Open', due_date: '2026-09-25' },                                          // missed
    { type: 'Preventive', status: 'Open', due_date: '2026-10-05' },                                          // not due yet
    { type: 'Corrective', status: 'Completed', due_date: '2026-09-20', completed_at: '2026-09-19T08:00:00' },// not planned
    { type: 'Preventive', status: 'Cancelled', due_date: '2026-09-21' }                                      // excluded
  ];
  assert.deepEqual(pmCompliance(wos, 30, now), { total: 3, onTime: 1, pct: 33 });
});

test('MTTR averages reactive repair hours', () => {
  const wos = [
    { type: 'Corrective', status: 'Completed', created_at: '2026-09-20T08:00:00', completed_at: '2026-09-20T12:00:00' },
    { type: 'Emergency', status: 'Completed', created_at: '2026-09-21T08:00:00', completed_at: '2026-09-21T10:00:00' },
    { type: 'Preventive', status: 'Completed', created_at: '2026-09-21T08:00:00', completed_at: '2026-09-25T10:00:00' }
  ];
  assert.deepEqual(mttr(wos, 30, now), { hours: 3, count: 2 });
});

test('weekly throughput buckets by Monday-based weeks', () => {
  const wos = [
    { status: 'Completed', created_at: '2026-09-28T09:00:00', completed_at: '2026-09-29T09:00:00' }, // this week
    { status: 'Open', created_at: '2026-09-27T09:00:00' },                                          // Sunday = last week
    { status: 'Requested', created_at: '2026-09-28T09:00:00' }                                      // not counted
  ];
  const w = weeklyThroughput(wos, 2, now);
  assert.deepEqual(w, [
    { start: '2026-09-21', created: 1, completed: 0 },
    { start: '2026-09-28', created: 1, completed: 1 }
  ]);
});

test('backlog aging only counts active work', () => {
  const wos = [
    { status: 'Open', created_at: '2026-09-27T00:00:00' },
    { status: 'On Hold', created_at: '2026-08-01T00:00:00' },
    { status: 'Completed', created_at: '2026-01-01T00:00:00' }
  ];
  assert.deepEqual(backlogAging(wos, now).map(b => b.count), [1, 0, 1, 0]);
});

test('MHE availability subtracts time locked out', () => {
  const assets = [
    { id: 'a', mhe_type: 'Reach Truck', status: 'Operational' },
    { id: 'b', mhe_type: 'Reach Truck', status: 'Out of Service' },
    { id: 'c', mhe_type: 'Traction Battery', status: 'Out of Service' } // not a unit
  ];
  const log = [
    { asset_id: 'a', status: 'Operational', changed_at: '2025-01-01T00:00:00' },
    { asset_id: 'b', status: 'Operational', changed_at: '2025-01-01T00:00:00' },
    { asset_id: 'b', status: 'Out of Service', changed_at: new Date(now.getTime() - 3 * 86400000).toISOString() }
  ];
  const r = mheAvailability(assets, log, 30, now);
  assert.equal(r.units, 2);
  assert.equal(r.pct, 95); // 3 of 60 unit-days down
});

test('due labels', () => {
  assert.equal(dueInfo({ status: 'Open', due_date: '2026-09-27' }, now).label, '2d overdue');
  assert.equal(dueInfo({ status: 'Open', due_date: '2026-09-29' }, now).label, 'Due today');
  assert.equal(dueInfo({ status: 'Requested' }, now).tone, 'violet');
});

test('meter PM position', () => {
  const s = { trigger_type: 'Meter', meter_last: 6250, meter_interval: 250, meter_lead: 20 };
  assert.equal(pmNextInfo(s, { current_meter: 6490 }, now).tone, 'warn');
  assert.equal(pmNextInfo(s, { current_meter: 6510 }, now).sub, '10 h over');
  assert.equal(pmNextInfo(s, { current_meter: 6500 }, now).sub, 'Due now');
});

test('forecast repeats calendar schedules inside the horizon', () => {
  const s = { id: 1, active: true, trigger_type: 'Calendar', next_due: '2026-10-01', interval_value: 1, interval_unit: 'month' };
  assert.deepEqual(pmForecast([s], 90, now).map(o => o.date), ['2026-10-01', '2026-11-01', '2026-12-01']);
});

test('stock status', () => {
  assert.equal(stockInfo({ qty_on_hand: 0, min_qty: 2 }).label, 'Out of stock');
  assert.equal(stockInfo({ qty_on_hand: 2, min_qty: 2 }).label, 'Reorder');
  assert.equal(stockInfo({ qty_on_hand: 3, min_qty: 2 }).low, false);
});
