-- =====================================================================
-- HLPI Facilities CMMS — database schema
--
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run: every statement is idempotent, so you can run it again
-- after an update to pick up new tables, functions and rules.
--
-- Scope: facilities and material handling equipment (MHE). Delivery
-- fleet (trucks, trailers, reefer units) is intentionally not modelled.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 0. Older "Work Order Monitor" app
-- ---------------------------------------------------------------------
-- The previous app kept work orders in a simpler work_orders table. If it
-- exists in this project it is renamed to work_orders_legacy so the new
-- table can be created. import_legacy.sql copies those rows across.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'work_orders' and column_name = 'facility')
     and not exists (select 1 from information_schema.tables
                     where table_schema = 'public' and table_name = 'work_orders_legacy') then
    alter table public.work_orders rename to work_orders_legacy;
  end if;
end $$;

-- =====================================================================
-- 1. Tables
-- =====================================================================

-- People ---------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'requester' check (role in ('admin','technician','requester')),
  trade text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists app_settings (
  id int primary key default 1 check (id = 1),
  org_name text not null default 'HAVI Logistics Philippines Inc.',
  currency text not null default 'PHP',
  timezone text not null default 'Asia/Manila',
  labor_rate numeric(10,2) not null default 0,
  updated_at timestamptz not null default now()
);
insert into app_settings (id) values (1) on conflict (id) do nothing;

-- "Today" in the site's time zone (Supabase servers run on UTC).
create or replace function local_today() returns date
language sql stable set search_path = public as $$
  select (now() at time zone coalesce((select timezone from app_settings where id = 1), 'Asia/Manila'))::date
$$;

-- Places -----------------------------------------------------------------
create table if not exists sites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  parent_id uuid references locations(id) on delete set null,
  name text not null,
  kind text,
  temp_zone text check (temp_zone in ('Ambient','Chiller','Freezer')),
  created_at timestamptz not null default now()
);
create index if not exists locations_site_idx on locations(site_id);

-- Suppliers ------------------------------------------------------------
create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  service_type text,
  contact_person text,
  phone text,
  email text,
  address text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  site_id uuid references sites(id) on delete set null,
  title text not null,
  scope text,
  start_date date,
  end_date date,
  value numeric(14,2),
  billing text check (billing in ('Monthly','Quarterly','Semi-annual','Annual','Per service','One-time')),
  renewal_notice_days int not null default 60 check (renewal_notice_days >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Assets ------------------------------------------------------------------
create table if not exists asset_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_mhe boolean not null default false,
  sort int not null default 100
);

create sequence if not exists asset_code_seq;
create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category_id uuid references asset_categories(id) on delete set null,
  site_id uuid not null references sites(id) on delete restrict,
  location_id uuid references locations(id) on delete set null,
  parent_id uuid references assets(id) on delete set null,
  status text not null default 'Operational'
    check (status in ('Operational','Needs Attention','Out of Service','Decommissioned')),
  criticality text not null default 'Medium' check (criticality in ('Low','Medium','High','Critical')),
  make text,
  model text,
  serial_no text,
  install_date date,
  warranty_expiry date,
  purchase_cost numeric(14,2),
  vendor_id uuid references vendors(id) on delete set null,
  -- Material handling equipment
  mhe_type text,
  capacity_kg numeric(10,1),
  lift_height_mm numeric(10,1),
  power_type text,
  battery_ref text,
  ownership text check (ownership in ('Owned','Leased','Rented')),
  current_meter numeric(12,1),
  meter_updated_at timestamptz,
  cert_expiry date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists assets_site_idx on assets(site_id);
create index if not exists assets_location_idx on assets(location_id);

create table if not exists asset_status_log (
  id bigint generated always as identity primary key,
  asset_id uuid not null references assets(id) on delete cascade,
  status text not null,
  note text,
  changed_by uuid references profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists asset_status_log_asset_idx on asset_status_log(asset_id, changed_at);

create table if not exists meter_readings (
  id bigint generated always as identity primary key,
  asset_id uuid not null references assets(id) on delete cascade,
  reading numeric(12,1) not null check (reading >= 0),
  source text not null default 'Manual' check (source in ('Manual','Pre-use check','Work order')),
  recorded_by uuid references profiles(id) on delete set null default auth.uid(),
  recorded_at timestamptz not null default now()
);
create index if not exists meter_readings_asset_idx on meter_readings(asset_id, recorded_at);

-- Preventive maintenance schedules -----------------------------------------
create table if not exists pm_schedules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  instructions text,
  site_id uuid references sites(id) on delete cascade,
  asset_id uuid references assets(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  type text not null default 'Preventive' check (type in ('Preventive','Inspection','Safety')),
  priority text not null default 'Medium' check (priority in ('Low','Medium','High','Critical')),
  assigned_to uuid references profiles(id) on delete set null,
  vendor_id uuid references vendors(id) on delete set null,
  trigger_type text not null default 'Calendar' check (trigger_type in ('Calendar','Meter')),
  -- Calendar trigger
  interval_value int check (interval_value > 0),
  interval_unit text check (interval_unit in ('day','week','month','year')),
  schedule_mode text not null default 'Fixed' check (schedule_mode in ('Fixed','Floating')),
  next_due date,
  lead_days int not null default 7 check (lead_days >= 0),
  -- Meter trigger (hour meter on the asset)
  meter_interval numeric(12,1) check (meter_interval > 0),
  meter_last numeric(12,1) not null default 0,
  meter_lead numeric(12,1) not null default 0 check (meter_lead >= 0),
  tasks jsonb not null default '[]'::jsonb,
  estimated_hours numeric(8,2),
  active boolean not null default true,
  last_generated_at timestamptz,
  last_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pm_calendar_fields check (
    trigger_type <> 'Calendar' or (interval_value is not null and interval_unit is not null and next_due is not null)),
  constraint pm_meter_fields check (
    trigger_type <> 'Meter' or (asset_id is not null and meter_interval is not null))
);

-- Work orders -------------------------------------------------------------
create sequence if not exists wo_code_seq;
create table if not exists work_orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  type text not null default 'Corrective'
    check (type in ('Corrective','Preventive','Inspection','Emergency','Safety','Improvement')),
  priority text not null default 'Medium' check (priority in ('Low','Medium','High','Critical')),
  status text not null default 'Open'
    check (status in ('Requested','Open','In Progress','On Hold','Completed','Cancelled','Rejected')),
  site_id uuid references sites(id) on delete set null,
  location_id uuid references locations(id) on delete set null,
  asset_id uuid references assets(id) on delete set null,
  pm_schedule_id uuid references pm_schedules(id) on delete set null,
  assigned_to uuid references profiles(id) on delete set null,
  vendor_id uuid references vendors(id) on delete set null,
  requested_by uuid references profiles(id) on delete set null,
  requester_name text,
  asset_down boolean not null default false,
  due_date date,
  estimated_hours numeric(8,2),
  started_at timestamptz,
  completed_at timestamptz,
  hold_reason text,
  failure_cause text,
  action_taken text,
  downtime_hours numeric(10,2) check (downtime_hours >= 0),
  meter_at_completion numeric(12,1),
  external_cost numeric(14,2) not null default 0 check (external_cost >= 0),
  approved_by uuid references profiles(id) on delete set null,
  approved_at timestamptz,
  reject_reason text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists work_orders_status_idx on work_orders(status);
create index if not exists work_orders_asset_idx on work_orders(asset_id);
create index if not exists work_orders_pm_idx on work_orders(pm_schedule_id);
create index if not exists work_orders_requested_by_idx on work_orders(requested_by);

create table if not exists wo_tasks (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references work_orders(id) on delete cascade,
  seq int not null default 0,
  description text not null,
  result text check (result in ('OK','Fail','N/A')),
  note text,
  done_by uuid references profiles(id) on delete set null,
  done_at timestamptz
);
create index if not exists wo_tasks_wo_idx on wo_tasks(work_order_id);

create table if not exists wo_labor (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references work_orders(id) on delete cascade,
  technician_id uuid references profiles(id) on delete set null,
  work_date date not null default local_today(),
  hours numeric(6,2) not null check (hours > 0 and hours <= 24),
  rate numeric(10,2),
  notes text,
  created_by uuid references profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists wo_labor_wo_idx on wo_labor(work_order_id);

create table if not exists wo_activity (
  id bigint generated always as identity primary key,
  work_order_id uuid not null references work_orders(id) on delete cascade,
  kind text not null default 'comment' check (kind in ('comment','status','system')),
  body text not null,
  author_id uuid references profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists wo_activity_wo_idx on wo_activity(work_order_id, created_at);

-- Spare parts & MRO stock -------------------------------------------------
create sequence if not exists part_no_seq;
create table if not exists parts (
  id uuid primary key default gen_random_uuid(),
  part_no text not null unique,
  name text not null,
  description text,
  category text,
  unit text not null default 'pc',
  site_id uuid references sites(id) on delete set null,
  bin_location text,
  qty_on_hand numeric(12,2) not null default 0,
  min_qty numeric(12,2) not null default 0 check (min_qty >= 0),
  max_qty numeric(12,2) check (max_qty >= 0),
  unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
  vendor_id uuid references vendors(id) on delete set null,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists part_transactions (
  id bigint generated always as identity primary key,
  part_id uuid not null references parts(id) on delete cascade,
  kind text not null check (kind in ('Receive','Issue','Return','Adjust')),
  qty numeric(12,2) not null check (qty <> 0),
  unit_cost numeric(12,2),
  work_order_id uuid references work_orders(id) on delete set null,
  reference text,
  notes text,
  created_by uuid references profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists part_transactions_part_idx on part_transactions(part_id, created_at);
create index if not exists part_transactions_wo_idx on part_transactions(work_order_id);

-- MHE pre-use checklists ------------------------------------------------------
create table if not exists checklist_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  applies_to text[] not null default '{}',
  items jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists checklist_submissions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id) on delete cascade,
  template_id uuid references checklist_templates(id) on delete set null,
  template_name text,
  operator_name text,
  shift text,
  meter_reading numeric(12,1) check (meter_reading >= 0),
  results jsonb not null default '[]'::jsonb,
  fail_count int not null default 0,
  critical_fail boolean not null default false,
  remarks text,
  work_order_id uuid references work_orders(id) on delete set null,
  submitted_by uuid references profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists checklist_submissions_asset_idx on checklist_submissions(asset_id, created_at);

-- Statutory & regulatory compliance -----------------------------------------
create table if not exists compliance_items (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references sites(id) on delete cascade,
  name text not null,
  category text not null default 'Permit'
    check (category in ('Permit','License','Certificate','Inspection','Testing','Audit','Training','Report')),
  authority text,
  reference text,
  frequency_months int check (frequency_months > 0),
  last_done date,
  next_due date,
  responsible_id uuid references profiles(id) on delete set null,
  vendor_id uuid references vendors(id) on delete set null,
  document_url text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists compliance_events (
  id bigint generated always as identity primary key,
  item_id uuid not null references compliance_items(id) on delete cascade,
  done_date date not null,
  next_due date,
  notes text,
  document_url text,
  recorded_by uuid references profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- Per-work-order roll-up of tasks, labour and cost. security_invoker makes
-- the view respect each user's row-level security.
drop view if exists wo_summary;
create view wo_summary with (security_invoker = true) as
select w.id as work_order_id,
       coalesce(t.total, 0)::int  as task_total,
       coalesce(t.done, 0)::int   as task_done,
       coalesce(t.failed, 0)::int as task_failed,
       coalesce(l.hours, 0)       as labor_hours,
       coalesce(l.cost, 0)        as labor_cost,
       coalesce(p.cost, 0)        as parts_cost,
       w.external_cost,
       coalesce(l.cost, 0) + coalesce(p.cost, 0) + w.external_cost as total_cost
from work_orders w
left join (select work_order_id, count(*) as total, count(result) as done,
                  count(*) filter (where result = 'Fail') as failed
           from wo_tasks group by work_order_id) t on t.work_order_id = w.id
left join (select work_order_id, sum(hours) as hours, sum(hours * coalesce(rate, 0)) as cost
           from wo_labor group by work_order_id) l on l.work_order_id = w.id
left join (select work_order_id, sum(-qty * coalesce(unit_cost, 0)) as cost
           from part_transactions
           where work_order_id is not null and kind in ('Issue','Return')
           group by work_order_id) p on p.work_order_id = w.id;

-- =====================================================================
-- 2. Role helpers
-- =====================================================================
-- security definer so they can read profiles without tripping its own RLS.

create or replace function app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and active
$$;

create or replace function is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active)
$$;

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active and role in ('admin','technician'))
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active and role = 'admin')
$$;

create or replace function add_interval(d date, n int, unit text) returns date
language sql immutable as $$
  select (d + case unit
                when 'day'   then make_interval(days => n)
                when 'week'  then make_interval(weeks => n)
                when 'month' then make_interval(months => n)
                when 'year'  then make_interval(years => n)
              end)::date
$$;

-- =====================================================================
-- 3. Triggers
-- =====================================================================

create or replace function cmms_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['app_settings','vendors','contracts','assets','pm_schedules','work_orders','parts','compliance_items'] loop
    execute format('drop trigger if exists touch_updated_at on %I', t);
    execute format('create trigger touch_updated_at before update on %I for each row execute function cmms_touch_updated_at()', t);
  end loop;
end $$;

-- New sign-ups get a profile. The very first account becomes the admin;
-- everyone after that starts as a requester until an admin promotes them.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name, role)
  values (new.id, new.email,
          coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
          case when exists (select 1 from profiles where role = 'admin') then 'requester' else 'admin' end)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Accounts that already existed before this schema was installed.
insert into profiles (id, email, full_name)
select u.id, u.email, split_part(u.email, '@', 1) from auth.users u
on conflict (id) do nothing;
update profiles set role = 'admin'
where id = (select p.id from profiles p join auth.users u on u.id = p.id order by u.created_at limit 1)
  and not exists (select 1 from profiles where role = 'admin');

-- Only admins change roles or deactivate accounts, and the last admin stays.
create or replace function guard_profile_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.active is distinct from old.active)
     and auth.uid() is not null and not is_admin() then
    raise exception 'Only an admin can change roles or deactivate accounts';
  end if;
  if old.role = 'admin' and old.active and (new.role <> 'admin' or not new.active)
     and not exists (select 1 from profiles where role = 'admin' and active and id <> old.id) then
    raise exception 'At least one active admin is required';
  end if;
  new.id := old.id;
  new.email := old.email;
  return new;
end $$;

drop trigger if exists guard_profile_update on profiles;
create trigger guard_profile_update before update on profiles
  for each row execute function guard_profile_update();

-- Readable codes: AST-0001, P-0001, WO-2609-0001 --------------------------
create or replace function assign_codes() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_table_name = 'assets' then
    new.code := upper(trim(coalesce(nullif(trim(new.code), ''), 'AST-' || lpad(nextval('asset_code_seq')::text, 4, '0'))));
  elsif tg_table_name = 'parts' then
    new.part_no := upper(trim(coalesce(nullif(trim(new.part_no), ''), 'P-' || lpad(nextval('part_no_seq')::text, 4, '0'))));
  end if;
  return new;
end $$;

drop trigger if exists assign_code on assets;
create trigger assign_code before insert or update of code on assets
  for each row execute function assign_codes();
drop trigger if exists assign_code on parts;
create trigger assign_code before insert or update of part_no on parts
  for each row execute function assign_codes();

-- Asset status history (feeds MHE availability and downtime reporting) ------
create or replace function asset_log_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into asset_status_log (asset_id, status, note, changed_by)
    values (new.id, new.status, nullif(current_setting('cmms.status_note', true), ''), auth.uid());
  end if;
  return null;
end $$;

drop trigger if exists log_status on assets;
create trigger log_status after insert or update of status on assets
  for each row execute function asset_log_status();

-- Change an asset's status with a reason that lands in its history.
create or replace function set_asset_status(p_asset uuid, p_status text, p_note text default null) returns void
language plpgsql set search_path = public as $$
begin
  perform set_config('cmms.status_note', coalesce(p_note, ''), true);
  update assets set status = p_status where id = p_asset;
  if not found then
    raise exception 'Asset not found, or you do not have permission to change it';
  end if;
  perform set_config('cmms.status_note', '', true);
end $$;

-- Hour meter readings keep the asset's current meter up to date -----------
create or replace function meter_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update assets
     set current_meter = new.reading, meter_updated_at = new.recorded_at
   where id = new.asset_id and (current_meter is null or new.reading >= current_meter);
  return null;
end $$;

drop trigger if exists meter_after_insert on meter_readings;
create trigger meter_after_insert after insert on meter_readings
  for each row execute function meter_after_insert();

-- Work orders: codes, defaults, approvals and timestamps ---------------------
create or replace function wo_before_write() returns trigger
language plpgsql set search_path = public as $$
declare
  a_site uuid;
  a_loc uuid;
begin
  if tg_op = 'INSERT' then
    if new.code is null or trim(new.code) = '' then
      new.code := 'WO-' || to_char(now() at time zone coalesce((select timezone from app_settings where id = 1), 'Asia/Manila'), 'YYMM')
                  || '-' || lpad(nextval('wo_code_seq')::text, 4, '0');
    end if;
    new.requested_by := coalesce(new.requested_by, auth.uid());
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;

  if new.asset_id is not null and (new.site_id is null or new.location_id is null) then
    select site_id, location_id into a_site, a_loc from assets where id = new.asset_id;
    new.site_id := coalesce(new.site_id, a_site);
    new.location_id := coalesce(new.location_id, a_loc);
  end if;
  if new.site_id is null and new.location_id is not null then
    select site_id into a_site from locations where id = new.location_id;
    new.site_id := a_site;
  end if;

  if tg_op = 'UPDATE' then
    if old.status = 'Requested' and new.status <> 'Requested' then
      if auth.uid() is not null and not is_admin() then
        raise exception 'Only an admin can approve or reject a request';
      end if;
      new.approved_by := coalesce(auth.uid(), new.approved_by);
      new.approved_at := now();
    elsif new.status = 'Requested' and old.status <> 'Requested' then
      raise exception 'A work order cannot be turned back into a request';
    end if;
  end if;

  if new.status = 'In Progress' and new.started_at is null then
    new.started_at := now();
  end if;
  if new.status = 'Completed' then
    new.completed_at := coalesce(new.completed_at, now());
  elsif tg_op = 'UPDATE' and old.status = 'Completed' then
    new.completed_at := null;
  end if;
  return new;
end $$;

drop trigger if exists wo_before_write on work_orders;
create trigger wo_before_write before insert or update on work_orders
  for each row execute function wo_before_write();

-- Work orders: activity log, meter capture and PM roll-forward --------------
create or replace function wo_after_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s pm_schedules%rowtype;
  nd date;
  m numeric;
  origin text;
begin
  if tg_op = 'INSERT' then
    origin := nullif(current_setting('cmms.wo_origin', true), '');
    insert into wo_activity (work_order_id, kind, body, author_id)
    values (new.id, 'system',
            coalesce(origin, case when new.status = 'Requested' then 'Request submitted'
                                  when new.pm_schedule_id is not null then 'Generated from PM schedule'
                                  else 'Work order created' end),
            auth.uid());
    perform set_config('cmms.wo_origin', '', true);
    return null;
  end if;

  if new.status is distinct from old.status then
    insert into wo_activity (work_order_id, kind, body, author_id)
    values (new.id, 'status',
            old.status || ' → ' || new.status ||
            case when new.status = 'On Hold' and coalesce(new.hold_reason, '') <> '' then ': ' || new.hold_reason
                 when new.status = 'Rejected' and coalesce(new.reject_reason, '') <> '' then ': ' || new.reject_reason
                 else '' end,
            auth.uid());
  end if;

  if new.assigned_to is distinct from old.assigned_to then
    insert into wo_activity (work_order_id, kind, body, author_id)
    values (new.id, 'system',
            coalesce('Assigned to ' || (select coalesce(full_name, email) from profiles where id = new.assigned_to), 'Unassigned'),
            auth.uid());
  end if;

  if new.status = 'Completed' and old.status <> 'Completed' and new.asset_id is not null and new.meter_at_completion is not null then
    insert into meter_readings (asset_id, reading, source, recorded_by)
    values (new.asset_id, new.meter_at_completion, 'Work order', auth.uid());
  end if;

  -- Roll a PM schedule forward once its work order is closed out.
  if new.pm_schedule_id is not null
     and new.status in ('Completed','Cancelled') and old.status not in ('Completed','Cancelled') then
    select * into s from pm_schedules where id = new.pm_schedule_id;
    if found then
      if s.trigger_type = 'Calendar' then
        if s.schedule_mode = 'Floating' and new.status = 'Completed' then
          nd := add_interval((new.completed_at at time zone coalesce((select timezone from app_settings where id = 1), 'Asia/Manila'))::date,
                             s.interval_value, s.interval_unit);
        else
          nd := add_interval(s.next_due, s.interval_value, s.interval_unit);
          while nd <= local_today() loop
            nd := add_interval(nd, s.interval_value, s.interval_unit);
          end loop;
        end if;
        update pm_schedules
           set next_due = nd,
               last_completed_at = case when new.status = 'Completed' then new.completed_at else last_completed_at end
         where id = s.id;
      else
        select current_meter into m from assets where id = s.asset_id;
        update pm_schedules
           set meter_last = coalesce(new.meter_at_completion, m, meter_last + meter_interval),
               last_completed_at = case when new.status = 'Completed' then new.completed_at else last_completed_at end
         where id = s.id;
      end if;
    end if;
  end if;
  return null;
end $$;

drop trigger if exists wo_after_write on work_orders;
create trigger wo_after_write after insert or update on work_orders
  for each row execute function wo_after_write();

-- Task sign-off stamps -----------------------------------------------------
create or replace function wo_task_stamp() returns trigger
language plpgsql as $$
begin
  if new.result is null then
    new.done_by := null;
    new.done_at := null;
  elsif tg_op = 'INSERT' or new.result is distinct from old.result then
    new.done_by := auth.uid();
    new.done_at := now();
  end if;
  return new;
end $$;

drop trigger if exists wo_task_stamp on wo_tasks;
create trigger wo_task_stamp before insert or update on wo_tasks
  for each row execute function wo_task_stamp();

-- Labour picks up the standard rate from settings -----------------------------
create or replace function wo_labor_rate() returns trigger
language plpgsql set search_path = public as $$
begin
  new.rate := coalesce(new.rate, (select labor_rate from app_settings where id = 1), 0);
  return new;
end $$;

drop trigger if exists wo_labor_rate on wo_labor;
create trigger wo_labor_rate before insert on wo_labor
  for each row execute function wo_labor_rate();

-- Stock ledger: every stock movement goes through part_transactions ---------
create or replace function part_txn_before_insert() returns trigger
language plpgsql set search_path = public as $$
declare
  p parts%rowtype;
  issued numeric;
begin
  select * into p from parts where id = new.part_id for update;
  if not found then
    raise exception 'Part not found';
  end if;
  if new.kind = 'Adjust' and auth.uid() is not null and not is_admin() then
    raise exception 'Only an admin can adjust stock counts';
  end if;

  if new.kind in ('Receive','Return') then
    new.qty := abs(new.qty);
  elsif new.kind = 'Issue' then
    new.qty := -abs(new.qty);
  end if;

  if new.kind = 'Return' and new.work_order_id is not null then
    select coalesce(-sum(qty), 0) into issued from part_transactions
     where part_id = new.part_id and work_order_id = new.work_order_id and kind in ('Issue','Return');
    if new.qty > issued then
      raise exception 'Only % % of % was issued to this work order', trim_scale(issued), p.unit, p.name;
    end if;
    new.unit_cost := coalesce(new.unit_cost,
      (select unit_cost from part_transactions
        where part_id = new.part_id and work_order_id = new.work_order_id and kind = 'Issue'
        order by created_at desc limit 1));
  end if;

  if p.qty_on_hand + new.qty < 0 then
    raise exception 'Not enough stock of %: % % on hand', p.name, trim_scale(p.qty_on_hand), p.unit;
  end if;

  new.unit_cost := coalesce(new.unit_cost, p.unit_cost);

  perform set_config('cmms.stock_sync', 'on', true);
  update parts
     set qty_on_hand = qty_on_hand + new.qty,
         unit_cost = case when new.kind = 'Receive' and new.unit_cost > 0 then new.unit_cost else unit_cost end
   where id = new.part_id;
  perform set_config('cmms.stock_sync', 'off', true);
  return new;
end $$;

drop trigger if exists part_txn_before_insert on part_transactions;
create trigger part_txn_before_insert before insert on part_transactions
  for each row execute function part_txn_before_insert();

create or replace function parts_guard_qty() returns trigger
language plpgsql as $$
begin
  if new.qty_on_hand is distinct from old.qty_on_hand
     and coalesce(current_setting('cmms.stock_sync', true), 'off') <> 'on' then
    raise exception 'Stock on hand changes only through a stock movement (receive, issue, return or adjust)';
  end if;
  return new;
end $$;

drop trigger if exists parts_guard_qty on parts;
create trigger parts_guard_qty before update on parts
  for each row execute function parts_guard_qty();

-- Pre-use checks: failures raise a work order; critical failures lock the unit out
create or replace function checklist_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  a assets%rowtype;
  failed text;
  wo_id uuid;
begin
  select * into a from assets where id = new.asset_id;
  if not found then
    raise exception 'Asset not found';
  end if;
  if auth.uid() is not null then
    new.submitted_by := auth.uid();
  end if;
  if new.template_name is null and new.template_id is not null then
    select name into new.template_name from checklist_templates where id = new.template_id;
  end if;

  select count(*), coalesce(bool_or(coalesce((r->>'critical')::boolean, false)), false)
    into new.fail_count, new.critical_fail
    from jsonb_array_elements(new.results) r
   where r->>'result' = 'Fail';

  if new.meter_reading is not null then
    insert into meter_readings (asset_id, reading, source, recorded_by)
    values (new.asset_id, new.meter_reading, 'Pre-use check', new.submitted_by);
  end if;

  if new.fail_count > 0 then
    select string_agg('• ' || (r->>'text')
                      || case when coalesce((r->>'critical')::boolean, false) then ' [CRITICAL]' else '' end
                      || case when coalesce(r->>'note', '') <> '' then ' — ' || (r->>'note') else '' end, E'\n')
      into failed
      from jsonb_array_elements(new.results) r
     where r->>'result' = 'Fail';

    perform set_config('cmms.wo_origin', 'Raised automatically by a failed pre-use check', true);
    insert into work_orders (title, description, type, priority, status, site_id, location_id, asset_id,
                             requested_by, requester_name, asset_down, due_date)
    values ('Pre-use check failed: ' || a.code || ' (' || new.fail_count
              || case when new.fail_count = 1 then ' item)' else ' items)' end,
            'Reported by ' || coalesce(nullif(new.operator_name, ''), 'operator')
              || coalesce(' · ' || nullif(new.shift, ''), '')
              || E'\n\nFailed items:\n' || failed
              || coalesce(E'\n\nRemarks: ' || nullif(new.remarks, ''), ''),
            'Corrective',
            case when new.critical_fail then 'Critical' else 'High' end,
            'Open', a.site_id, a.location_id, a.id,
            new.submitted_by, new.operator_name, new.critical_fail,
            local_today() + case when new.critical_fail then 0 else 2 end)
    returning id into wo_id;
    new.work_order_id := wo_id;

    if new.critical_fail and a.status <> 'Decommissioned' then
      perform set_config('cmms.status_note', 'Locked out: critical defect on pre-use check', true);
      update assets set status = 'Out of Service' where id = a.id and status <> 'Out of Service';
      perform set_config('cmms.status_note', '', true);
    elsif a.status = 'Operational' then
      perform set_config('cmms.status_note', 'Defect reported on pre-use check', true);
      update assets set status = 'Needs Attention' where id = a.id;
      perform set_config('cmms.status_note', '', true);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists checklist_before_insert on checklist_submissions;
create trigger checklist_before_insert before insert on checklist_submissions
  for each row execute function checklist_before_insert();

-- Compliance renewals roll the register forward ------------------------------
create or replace function compliance_event_apply() returns trigger
language plpgsql set search_path = public as $$
declare
  freq int;
begin
  select frequency_months into freq from compliance_items where id = new.item_id;
  if new.next_due is null and freq is not null then
    new.next_due := (new.done_date + make_interval(months => freq))::date;
  end if;
  update compliance_items
     set last_done = new.done_date,
         next_due = coalesce(new.next_due, next_due),
         document_url = coalesce(nullif(new.document_url, ''), document_url)
   where id = new.item_id;
  return new;
end $$;

drop trigger if exists compliance_event_apply on compliance_events;
create trigger compliance_event_apply before insert on compliance_events
  for each row execute function compliance_event_apply();

-- =====================================================================
-- 4. Preventive maintenance generator
-- =====================================================================
-- Creates a work order for every active schedule that is due (calendar
-- date within its lead time, or hour meter within its lead) and has no
-- work order still open. Safe to call as often as you like. The app calls
-- it whenever a technician or admin opens it; cron.sql can also run it daily.
create or replace function generate_pm_work_orders() returns int
language plpgsql security definer set search_path = public as $$
declare
  s record;
  due date;
  wo_id uuid;
  created int := 0;
  today date := local_today();
begin
  if auth.uid() is not null and not is_staff() then
    raise exception 'Only technicians and admins can generate PM work orders';
  end if;
  perform pg_advisory_xact_lock(hashtext('generate_pm_work_orders'));

  for s in
    select p.*, a.current_meter, a.site_id as asset_site, a.location_id as asset_location, a.status as asset_status
      from pm_schedules p
      left join assets a on a.id = p.asset_id
     where p.active
  loop
    continue when s.asset_status = 'Decommissioned';
    continue when exists (select 1 from work_orders w
                           where w.pm_schedule_id = s.id
                             and w.status not in ('Completed','Cancelled','Rejected'));
    due := null;
    if s.trigger_type = 'Calendar' then
      if s.next_due - s.lead_days <= today then
        due := s.next_due;
      end if;
    elsif s.current_meter is not null
          and s.current_meter >= s.meter_last + s.meter_interval - s.meter_lead then
      due := today + 7;
    end if;
    continue when due is null;

    insert into work_orders (title, description, type, priority, status, site_id, location_id, asset_id,
                             pm_schedule_id, assigned_to, vendor_id, due_date, estimated_hours)
    values (s.title, s.instructions, s.type, s.priority, 'Open',
            coalesce(s.site_id, s.asset_site), coalesce(s.location_id, s.asset_location), s.asset_id,
            s.id, s.assigned_to, s.vendor_id, due, s.estimated_hours)
    returning id into wo_id;

    insert into wo_tasks (work_order_id, seq, description)
    select wo_id, t.ord, t.val
      from jsonb_array_elements_text(s.tasks) with ordinality as t(val, ord)
     where trim(t.val) <> '';

    update pm_schedules set last_generated_at = now() where id = s.id;
    created := created + 1;
  end loop;
  return created;
end $$;

-- =====================================================================
-- 5. Row-level security
-- =====================================================================
-- Roles:  admin      – everything, including approvals, users and settings
--         technician – work orders, PM, assets, parts and checklists
--         requester  – submit requests and pre-use checks, follow their own
-- Each row below reads: table, who can SELECT, INSERT, UPDATE, DELETE.
-- null means nobody through the app (triggers still write where noted).
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('profiles',              'is_member()', null,
                                'id = auth.uid() or is_admin()', null),
      ('app_settings',          'is_member()', null, 'is_admin()', null),
      ('sites',                 'is_member()', 'is_admin()', 'is_admin()', 'is_admin()'),
      ('locations',             'is_member()', 'is_admin()', 'is_admin()', 'is_admin()'),
      ('asset_categories',      'is_member()', 'is_admin()', 'is_admin()', 'is_admin()'),
      ('vendors',               'is_staff()',  'is_admin()', 'is_admin()', 'is_admin()'),
      ('contracts',             'is_staff()',  'is_admin()', 'is_admin()', 'is_admin()'),
      ('assets',                'is_member()', 'is_staff()', 'is_staff()', 'is_admin()'),
      ('asset_status_log',      'is_staff()',  null, null, null),
      ('meter_readings',        'is_staff()',  'is_staff()', null, 'is_admin()'),
      ('pm_schedules',          'is_staff()',  'is_staff()', 'is_staff()', 'is_admin()'),
      ('work_orders',           'is_staff() or requested_by = auth.uid()',
                                'is_staff() or (is_member() and status = ''Requested'' and requested_by = auth.uid())',
                                'is_staff()', 'is_admin()'),
      ('wo_tasks',              'is_staff() or exists (select 1 from work_orders w where w.id = work_order_id)',
                                'is_staff()', 'is_staff()', 'is_staff()'),
      ('wo_labor',              'is_staff()',  'is_staff()', 'is_staff()', 'is_staff()'),
      ('wo_activity',           'is_staff() or exists (select 1 from work_orders w where w.id = work_order_id)',
                                'is_staff() or (kind = ''comment'' and author_id = auth.uid() and exists (select 1 from work_orders w where w.id = work_order_id))',
                                null, 'is_admin()'),
      ('parts',                 'is_staff()',  'is_staff()', 'is_staff()', 'is_admin()'),
      ('part_transactions',     'is_staff()',  'is_staff()', null, null),
      ('checklist_templates',   'is_member()', 'is_admin()', 'is_admin()', 'is_admin()'),
      ('checklist_submissions', 'is_staff() or submitted_by = auth.uid()', 'is_member()', null, 'is_admin()'),
      ('compliance_items',      'is_staff()',  'is_admin()', 'is_admin()', 'is_admin()'),
      ('compliance_events',     'is_staff()',  'is_admin()', null, 'is_admin()')
    ) as t(tbl, sel, ins, upd, del)
  loop
    execute format('alter table %I enable row level security', r.tbl);
    execute format('drop policy if exists %I on %I', r.tbl || '_select', r.tbl);
    execute format('drop policy if exists %I on %I', r.tbl || '_insert', r.tbl);
    execute format('drop policy if exists %I on %I', r.tbl || '_update', r.tbl);
    execute format('drop policy if exists %I on %I', r.tbl || '_delete', r.tbl);
    if r.sel is not null then
      execute format('create policy %I on %I for select to authenticated using (%s)', r.tbl || '_select', r.tbl, r.sel);
    end if;
    if r.ins is not null then
      execute format('create policy %I on %I for insert to authenticated with check (%s)', r.tbl || '_insert', r.tbl, r.ins);
    end if;
    if r.upd is not null then
      execute format('create policy %I on %I for update to authenticated using (%s) with check (%s)', r.tbl || '_update', r.tbl, r.upd, r.upd);
    end if;
    if r.del is not null then
      execute format('create policy %I on %I for delete to authenticated using (%s)', r.tbl || '_delete', r.tbl, r.del);
    end if;
  end loop;
end $$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke execute on function generate_pm_work_orders() from public, anon;
grant execute on function generate_pm_work_orders() to authenticated;
revoke execute on function set_asset_status(uuid, text, text) from public, anon;
grant execute on function set_asset_status(uuid, text, text) to authenticated;

-- =====================================================================
-- 6. Live updates (Supabase Realtime)
-- =====================================================================
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['profiles','app_settings','sites','locations','asset_categories','vendors','contracts',
                             'assets','asset_status_log','meter_readings','pm_schedules','work_orders','wo_tasks',
                             'wo_labor','wo_activity','parts','part_transactions','checklist_templates',
                             'checklist_submissions','compliance_items','compliance_events'] loop
      if not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- =====================================================================
-- 7. Reference data (edit freely in Settings)
-- =====================================================================
insert into asset_categories (name, is_mhe, sort) values
  ('Material Handling Equipment (MHE)', true, 10),
  ('MHE Batteries & Chargers', true, 20),
  ('Refrigeration & Cold Rooms', false, 30),
  ('HVAC & Ventilation', false, 40),
  ('Electrical & Lighting', false, 50),
  ('Power Generation & UPS', false, 60),
  ('Dock Equipment', false, 70),
  ('Doors & Gates', false, 80),
  ('Racking & Storage', false, 90),
  ('Fire Protection & Life Safety', false, 100),
  ('Plumbing, Water & Wastewater', false, 110),
  ('Compressed Air', false, 120),
  ('Building & Civil', false, 130),
  ('Security & CCTV', false, 140),
  ('Weighing & Measuring', false, 150),
  ('Cleaning Equipment', false, 160)
on conflict (name) do nothing;

insert into checklist_templates (name, description, applies_to, items) values
(
  'Electric Forklift / Reach Truck – Daily Pre-Use',
  'Before the first lift of every shift. A failed critical item means the unit must not be used.',
  array['Reach Truck','Counterbalance Forklift (Electric)','VNA Truck'],
  '[
    {"text":"Forks, fork pins and carriage – no cracks, bends or heavy wear","critical":true},
    {"text":"Mast, lift chains and cylinders – no damage, chains lubricated","critical":true},
    {"text":"No hydraulic oil leaks on hoses, fittings or floor","critical":true},
    {"text":"Overhead guard and load backrest secure","critical":true},
    {"text":"Tyres and wheels – no missing chunks or embedded debris","critical":false},
    {"text":"Battery charged; connector and cables undamaged","critical":true},
    {"text":"Battery electrolyte level OK, no spillage","critical":false},
    {"text":"Seat and seatbelt / operator restraint work","critical":true},
    {"text":"Horn works","critical":true},
    {"text":"Service brake stops the truck smoothly","critical":true},
    {"text":"Parking brake holds","critical":true},
    {"text":"Steering responds normally","critical":true},
    {"text":"Lift, lower, tilt and reach are smooth","critical":true},
    {"text":"Travel alarm and blue spot / warning lights work","critical":true},
    {"text":"Emergency disconnect (battery isolator) works","critical":true},
    {"text":"Capacity plate legible; hour meter and battery gauge work","critical":false}
  ]'::jsonb
),
(
  'LPG / Diesel Forklift – Daily Pre-Use',
  'Before the first lift of every shift. A failed critical item means the unit must not be used.',
  array['Counterbalance Forklift (LPG)','Counterbalance Forklift (Diesel)'],
  '[
    {"text":"Forks, fork pins and carriage – no cracks, bends or heavy wear","critical":true},
    {"text":"Mast, lift chains and cylinders – no damage, chains lubricated","critical":true},
    {"text":"No hydraulic oil leaks on hoses, fittings or floor","critical":true},
    {"text":"LPG cylinder secured, no gas smell – or no diesel leaks","critical":true},
    {"text":"Engine oil, coolant and hydraulic oil levels OK","critical":false},
    {"text":"Tyres and wheels – no missing chunks or embedded debris","critical":false},
    {"text":"Overhead guard and load backrest secure","critical":true},
    {"text":"Seatbelt works","critical":true},
    {"text":"Horn works","critical":true},
    {"text":"Service brake stops the truck smoothly","critical":true},
    {"text":"Parking brake holds","critical":true},
    {"text":"Steering responds normally","critical":true},
    {"text":"Lift, lower and tilt are smooth","critical":true},
    {"text":"Lights, reverse alarm and beacon work","critical":true},
    {"text":"No excessive exhaust smoke","critical":false},
    {"text":"Capacity plate legible","critical":false}
  ]'::jsonb
),
(
  'Electric Pallet Truck / Stacker – Daily Pre-Use',
  'Before first use each shift.',
  array['Electric Pallet Truck','Electric Stacker','Tow Tractor'],
  '[
    {"text":"Forks / platform – no cracks or bends","critical":true},
    {"text":"Load wheels and drive wheel – no damage, no wrapped stretch film","critical":false},
    {"text":"Battery charged; connector and cables undamaged","critical":true},
    {"text":"No hydraulic oil leaks","critical":true},
    {"text":"Tiller buttons work and tiller springs back up (brake on)","critical":true},
    {"text":"Belly (anti-crush) reverse button works","critical":true},
    {"text":"Emergency stop button works","critical":true},
    {"text":"Horn works","critical":true},
    {"text":"Brake stops the truck smoothly","critical":true},
    {"text":"Lift and lower are smooth","critical":true},
    {"text":"Stackers: mast and chains undamaged (N/A for pallet trucks)","critical":true},
    {"text":"Covers and guards secure","critical":false},
    {"text":"Capacity plate legible","critical":false}
  ]'::jsonb
),
(
  'Order Picker – Daily Pre-Use',
  'Before first use each shift. Never operate without the harness attached.',
  array['Order Picker'],
  '[
    {"text":"Harness, lanyard and anchor point in good condition","critical":true},
    {"text":"Platform gates / guardrails close and interlock","critical":true},
    {"text":"Forks and pallet clamp undamaged","critical":true},
    {"text":"Mast and chains undamaged","critical":true},
    {"text":"No hydraulic oil leaks","critical":true},
    {"text":"Battery charged; connector and cables undamaged","critical":true},
    {"text":"Emergency stop and emergency lowering work","critical":true},
    {"text":"Horn, lights and travel alarm work","critical":true},
    {"text":"Brakes stop the truck smoothly","critical":true},
    {"text":"Steering responds normally","critical":true},
    {"text":"Lift and lower controls are smooth","critical":true},
    {"text":"Tyres and wheels in good condition","critical":false},
    {"text":"Aisle guidance / height limit sensors work (if fitted)","critical":false}
  ]'::jsonb
),
(
  'Manual Pallet Jack – Weekly Check',
  'Weekly, or before use if the jack has been idle.',
  array['Manual Pallet Jack'],
  '[
    {"text":"Forks – no cracks or bends","critical":true},
    {"text":"Handle and release lever work; forks lower under control","critical":true},
    {"text":"Wheels and rollers turn freely, no wrapped stretch film","critical":false},
    {"text":"No hydraulic oil leaks","critical":false},
    {"text":"Pump raises forks to full height","critical":false}
  ]'::jsonb
),
(
  'Scissor / Boom Lift (MEWP) – Pre-Use',
  'Before every use. Harness required in boom lifts.',
  array['Scissor Lift','Boom Lift'],
  '[
    {"text":"Guardrails, gate and toe boards secure","critical":true},
    {"text":"Harness anchor points in good condition","critical":true},
    {"text":"Emergency stop works (platform and ground controls)","critical":true},
    {"text":"Emergency lowering works","critical":true},
    {"text":"Tilt alarm and descent alarm work","critical":true},
    {"text":"No hydraulic oil leaks","critical":true},
    {"text":"Controls return to neutral when released","critical":true},
    {"text":"Pothole protection / outriggers deploy","critical":true},
    {"text":"Tyres and wheels in good condition","critical":false},
    {"text":"Battery charged; cables undamaged","critical":false},
    {"text":"Operating manual and warning decals present","critical":false}
  ]'::jsonb
)
on conflict (name) do nothing;
