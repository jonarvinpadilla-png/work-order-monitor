-- Behaviour tests for schema.sql: roles, row-level security and triggers.
-- Run with scripts/test-db.sh (needs a local Postgres). Everything happens
-- inside one transaction that is rolled back at the end.
\set ON_ERROR_STOP 1
set client_min_messages = warning;
begin;

create function pg_temp.login(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
end $$;

create function pg_temp.check(ok boolean, msg text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAILED: %', msg; end if;
  raise notice 'pass: %', msg;
end $$;

create function pg_temp.expect_error(stmt text, pattern text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlerrm !~* pattern then
      raise exception 'FAILED: wrong error for [%]: % (wanted /%/)', stmt, sqlerrm, pattern;
    end if;
    raise notice 'pass: rejected [%] -> %', left(stmt, 70), sqlerrm;
    return;
  end;
  raise exception 'FAILED: expected an error /%/ from [%]', pattern, stmt;
end $$;

grant execute on all functions in schema pg_temp to authenticated;
set local client_min_messages = notice;

-- ---------------------------------------------------------------- people
insert into auth.users (id, email, created_at) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@hlpi.test', now() - interval '3 min'),
  ('00000000-0000-0000-0000-00000000000b', 'tech@hlpi.test',  now() - interval '2 min'),
  ('00000000-0000-0000-0000-00000000000c', 'op@hlpi.test',    now() - interval '1 min'),
  ('00000000-0000-0000-0000-00000000000d', 'op2@hlpi.test',   now());

select pg_temp.check((select role from profiles where email = 'admin@hlpi.test') = 'admin', 'first sign-up becomes admin');
select pg_temp.check((select role from profiles where email = 'op@hlpi.test') = 'requester', 'later sign-ups start as requester');
update profiles set role = 'technician' where email = 'tech@hlpi.test';
update app_settings set labor_rate = 250;

insert into sites (id, code, name) values ('10000000-0000-0000-0000-000000000001', 'PLD', 'Plaridel DC');
insert into locations (id, site_id, name, temp_zone) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Freezer Room', 'Freezer');
insert into assets (id, code, name, site_id, location_id, mhe_type, current_meter, category_id) values
  ('30000000-0000-0000-0000-000000000001', 'rt-01', 'Reach Truck 1', '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001', 'Reach Truck', 240,
   (select id from asset_categories where name = 'Material Handling Equipment (MHE)')),
  ('30000000-0000-0000-0000-000000000002', null, 'Dock Leveler 1', '10000000-0000-0000-0000-000000000001', null, null, null, null);

select pg_temp.check((select code from assets where id = '30000000-0000-0000-0000-000000000001') = 'RT-01', 'asset tags are upper-cased');
select pg_temp.check((select code from assets where id = '30000000-0000-0000-0000-000000000002') like 'AST-%', 'blank asset tag gets an AST- code');

-- ------------------------------------------------------- requester rules
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000c');

select pg_temp.expect_error($$update profiles set role = 'admin' where email = 'op@hlpi.test'$$, 'only an admin');
select pg_temp.expect_error($$insert into work_orders (title, status) values ('Light out', 'Open')$$, 'row-level security');
insert into work_orders (id, title, status, asset_id, priority)
  values ('40000000-0000-0000-0000-000000000001', 'Dock leveler lip not extending', 'Requested', '30000000-0000-0000-0000-000000000002', 'High');
select pg_temp.check((select requested_by from work_orders where id = '40000000-0000-0000-0000-000000000001') = '00000000-0000-0000-0000-00000000000c', 'request is stamped with the requester');
select pg_temp.check((select site_id from work_orders where id = '40000000-0000-0000-0000-000000000001') = '10000000-0000-0000-0000-000000000001', 'site is filled in from the asset');
select pg_temp.check((select count(*) from parts) = 0 and (select count(*) from vendors) = 0, 'requester cannot read parts or vendors');
insert into wo_activity (work_order_id, body) values ('40000000-0000-0000-0000-000000000001', 'It is dock 3');
select pg_temp.check((select count(*) from wo_activity where work_order_id = '40000000-0000-0000-0000-000000000001') = 2, 'requester sees and comments on own request');

select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select pg_temp.check((select count(*) from work_orders) = 0, 'another requester cannot see it');
select pg_temp.expect_error($$insert into wo_activity (work_order_id, body) values ('40000000-0000-0000-0000-000000000001', 'x')$$, 'row-level security');

-- ------------------------------------------------------------ approvals
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error($$update work_orders set status = 'Open' where id = '40000000-0000-0000-0000-000000000001'$$, 'only an admin can approve');
delete from work_orders where id = '40000000-0000-0000-0000-000000000001';
select pg_temp.check((select count(*) from work_orders where id = '40000000-0000-0000-0000-000000000001') = 1, 'technician delete is blocked by RLS (row still there)');

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
update work_orders set status = 'Open', assigned_to = '00000000-0000-0000-0000-00000000000b' where id = '40000000-0000-0000-0000-000000000001';
select pg_temp.check((select approved_by from work_orders where id = '40000000-0000-0000-0000-000000000001') = '00000000-0000-0000-0000-00000000000a', 'admin approval is recorded');
select pg_temp.check(exists (select 1 from wo_activity where work_order_id = '40000000-0000-0000-0000-000000000001' and body = 'Requested → Open'), 'status change is logged');
select pg_temp.check(exists (select 1 from wo_activity where work_order_id = '40000000-0000-0000-0000-000000000001' and body = 'Assigned to tech'), 'assignment is logged');
select pg_temp.expect_error($$update profiles set role = 'technician' where email = 'admin@hlpi.test'$$, 'at least one active admin');

-- ------------------------------------------------------ work & labour
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
update work_orders set status = 'In Progress' where id = '40000000-0000-0000-0000-000000000001';
select pg_temp.check((select started_at is not null from work_orders where id = '40000000-0000-0000-0000-000000000001'), 'start time is stamped');
insert into wo_labor (work_order_id, technician_id, hours) values ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 2.5);
select pg_temp.check((select labor_cost from wo_summary where work_order_id = '40000000-0000-0000-0000-000000000001') = 625, 'labour cost uses the standard rate');

-- --------------------------------------------------------------- stock
insert into parts (id, part_no, name, unit, min_qty) values ('50000000-0000-0000-0000-000000000001', null, 'Hydraulic oil ISO 46', 'L', 20);
select pg_temp.check((select part_no from parts where id = '50000000-0000-0000-0000-000000000001') like 'P-%', 'blank part number gets a P- code');
insert into part_transactions (part_id, kind, qty, unit_cost) values ('50000000-0000-0000-0000-000000000001', 'Receive', 40, 180);
insert into part_transactions (part_id, kind, qty, work_order_id) values ('50000000-0000-0000-0000-000000000001', 'Issue', 5, '40000000-0000-0000-0000-000000000001');
select pg_temp.check((select qty_on_hand from parts where id = '50000000-0000-0000-0000-000000000001') = 35, 'receive and issue move stock');
select pg_temp.expect_error($$insert into part_transactions (part_id, kind, qty, work_order_id) values ('50000000-0000-0000-0000-000000000001', 'Return', 6, '40000000-0000-0000-0000-000000000001')$$, 'only 5 L of hydraulic');
insert into part_transactions (part_id, kind, qty, work_order_id) values ('50000000-0000-0000-0000-000000000001', 'Return', 1, '40000000-0000-0000-0000-000000000001');
select pg_temp.check((select parts_cost from wo_summary where work_order_id = '40000000-0000-0000-0000-000000000001') = 720, 'parts cost nets returns (4 L × 180)');
select pg_temp.expect_error($$insert into part_transactions (part_id, kind, qty) values ('50000000-0000-0000-0000-000000000001', 'Issue', 100)$$, 'not enough stock');
select pg_temp.expect_error($$update parts set qty_on_hand = 999 where id = '50000000-0000-0000-0000-000000000001'$$, 'stock movement');
select pg_temp.expect_error($$insert into part_transactions (part_id, kind, qty) values ('50000000-0000-0000-0000-000000000001', 'Adjust', -1)$$, 'only an admin can adjust');

update work_orders set status = 'Completed', action_taken = 'Replaced seal' where id = '40000000-0000-0000-0000-000000000001';
select pg_temp.check((select completed_at is not null from work_orders where id = '40000000-0000-0000-0000-000000000001'), 'completion time is stamped');
update work_orders set status = 'Open' where id = '40000000-0000-0000-0000-000000000001';
select pg_temp.check((select completed_at is null from work_orders where id = '40000000-0000-0000-0000-000000000001'), 'reopening clears completion time');

-- ---------------------------------------------------------- PM: calendar
insert into pm_schedules (id, title, asset_id, site_id, trigger_type, interval_value, interval_unit, next_due, lead_days, tasks)
values ('60000000-0000-0000-0000-000000000001', 'Dock leveler monthly PM', '30000000-0000-0000-0000-000000000002',
        '10000000-0000-0000-0000-000000000001', 'Calendar', 1, 'month', local_today() + 3, 7,
        '["Lubricate hinge pins", "Check hydraulic level", " "]');
insert into pm_schedules (id, title, asset_id, site_id, trigger_type, interval_value, interval_unit, next_due, lead_days)
values ('60000000-0000-0000-0000-000000000003', 'Not due yet', '30000000-0000-0000-0000-000000000002',
        '10000000-0000-0000-0000-000000000001', 'Calendar', 1, 'year', local_today() + 60, 7);
-- ------------------------------------------------------------ PM: meter
insert into pm_schedules (id, title, asset_id, trigger_type, meter_interval, meter_last, meter_lead)
values ('60000000-0000-0000-0000-000000000002', 'RT-01 250-hour service', '30000000-0000-0000-0000-000000000001', 'Meter', 250, 0, 20);

select pg_temp.check(generate_pm_work_orders() = 2, 'generator creates the due calendar PM and the meter PM');
select pg_temp.check(generate_pm_work_orders() = 0, 'generator does not duplicate open PMs');
select pg_temp.check((select count(*) from wo_tasks t join work_orders w on w.id = t.work_order_id
                      where w.pm_schedule_id = '60000000-0000-0000-0000-000000000001') = 2, 'PM tasks copied (blank lines skipped)');
select pg_temp.check((select due_date from work_orders where pm_schedule_id = '60000000-0000-0000-0000-000000000001') = local_today() + 3, 'PM work order due on the schedule date');

update work_orders set status = 'Completed' where pm_schedule_id = '60000000-0000-0000-0000-000000000001';
select pg_temp.check((select next_due from pm_schedules where id = '60000000-0000-0000-0000-000000000001') = add_interval(local_today() + 3, 1, 'month'), 'fixed schedule rolls forward one interval');

update work_orders set status = 'Completed', meter_at_completion = 262 where pm_schedule_id = '60000000-0000-0000-0000-000000000002';
select pg_temp.check((select meter_last from pm_schedules where id = '60000000-0000-0000-0000-000000000002') = 262, 'meter schedule restarts from the completion reading');
select pg_temp.check((select current_meter from assets where id = '30000000-0000-0000-0000-000000000001') = 262, 'completion reading updates the hour meter');
select pg_temp.check(generate_pm_work_orders() = 0, 'nothing due right after completion');

-- Fixed schedules skip occurrences that are already in the past.
update pm_schedules set next_due = local_today() - 70, interval_value = 1, interval_unit = 'month' where id = '60000000-0000-0000-0000-000000000001';
select pg_temp.check(generate_pm_work_orders() = 1, 'overdue schedule generates');
update work_orders set status = 'Completed' where pm_schedule_id = '60000000-0000-0000-0000-000000000001' and status = 'Open';
select pg_temp.check((select next_due from pm_schedules where id = '60000000-0000-0000-0000-000000000001') > local_today(), 'late completion jumps to the next future date');

-- -------------------------------------------------- pre-use checklists
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
insert into checklist_submissions (id, asset_id, operator_name, shift, meter_reading, results)
values ('70000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Juan', 'Shift 1', 270,
        '[{"text":"Horn works","critical":true,"result":"OK"},
          {"text":"Tyres","critical":false,"result":"Fail","note":"chunk missing"}]');
select pg_temp.check((select fail_count from checklist_submissions where id = '70000000-0000-0000-0000-000000000001') = 1, 'fail count computed');
select pg_temp.check((select status from assets where id = '30000000-0000-0000-0000-000000000001') = 'Needs Attention', 'non-critical failure flags the unit');
select pg_temp.check((select count(*) from work_orders where asset_id = '30000000-0000-0000-0000-000000000001' and status = 'Open' and priority = 'High') = 1,
                     'non-critical failure raises a High work order the operator can see');

insert into checklist_submissions (id, asset_id, operator_name, results)
values ('70000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'Juan',
        '[{"text":"Service brake","critical":true,"result":"Fail","note":"spongy"}]');
select pg_temp.check((select status from assets where id = '30000000-0000-0000-0000-000000000001') = 'Out of Service', 'critical failure locks the unit out');
select pg_temp.check((select w.priority from checklist_submissions c join work_orders w on w.id = c.work_order_id
                      where c.id = '70000000-0000-0000-0000-000000000002') = 'Critical', 'critical failure raises a Critical work order');
select pg_temp.check((select count(*) from checklist_submissions) = 2, 'operator sees own checks');

reset role;
select pg_temp.check((select note from asset_status_log where asset_id = '30000000-0000-0000-0000-000000000001' and status = 'Out of Service')
                     = 'Locked out: critical defect on pre-use check', 'lockout reason is in the status history');
select pg_temp.check((select current_meter from assets where id = '30000000-0000-0000-0000-000000000001') = 270, 'checklist meter reading updates the hour meter');
select pg_temp.check((select body from wo_activity a join checklist_submissions c on c.work_order_id = a.work_order_id
                      where c.id = '70000000-0000-0000-0000-000000000002' order by a.id limit 1)
                     = 'Raised automatically by a failed pre-use check', 'auto work order explains its origin');

-- ------------------------------------------------------------ asset status
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select set_asset_status('30000000-0000-0000-0000-000000000001', 'Operational', 'Brake bled and tested');
reset role;
select pg_temp.check((select note from asset_status_log where asset_id = '30000000-0000-0000-0000-000000000001' order by id desc limit 1)
                     = 'Brake bled and tested', 'manual status change keeps its reason');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select pg_temp.expect_error($$select set_asset_status('30000000-0000-0000-0000-000000000001', 'Decommissioned')$$, 'do not have permission');

-- ------------------------------------------------------------- compliance
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into compliance_items (id, name, frequency_months, next_due) values ('80000000-0000-0000-0000-000000000001', 'BFP FSIC', 12, '2026-01-15');
insert into compliance_events (item_id, done_date) values ('80000000-0000-0000-0000-000000000001', '2026-01-10');
select pg_temp.check((select next_due from compliance_items where id = '80000000-0000-0000-0000-000000000001') = '2027-01-10', 'renewal rolls the due date by the frequency');
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error($$insert into compliance_events (item_id, done_date) values ('80000000-0000-0000-0000-000000000001', '2026-02-01')$$, 'row-level security');

reset role;
select 'ALL BEHAVIOUR TESTS PASSED' as result;
rollback;
