-- =====================================================================
-- HLPI Facilities CMMS — database schema (SQLite, schema version 1)
--
-- The server applies this automatically the first time it starts, so
-- there is nothing to run by hand. Business rules (codes, approvals, the
-- stock ledger, PM roll-forward, pre-use lockout) live in rules.js and
-- permissions live in access.js.
--
-- Column types keep their Postgres names (UUID, TIMESTAMPTZ, BOOLEAN,
-- JSONB, NUMERIC(p,s)…). SQLite stores them as text or numbers; db.js
-- reads the declared type to convert values on the way in and out.
-- Timestamps are ISO 8601 in UTC, dates are YYYY-MM-DD.
--
-- Scope: facilities and material handling equipment (MHE). Delivery
-- fleet (trucks, trailers, reefer units) is intentionally not modelled.
-- =====================================================================

-- People ---------------------------------------------------------------
create table users (
  id UUID not null primary key,
  email TEXT not null unique collate nocase,
  password_hash TEXT not null,
  must_change_password BOOLEAN not null default 0,
  created_at TIMESTAMPTZ not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_sign_in_at TIMESTAMPTZ
);

create table sessions (
  token_hash TEXT not null primary key,
  user_id UUID not null references users(id) on delete cascade,
  created_at TIMESTAMPTZ not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen_at TIMESTAMPTZ not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TIMESTAMPTZ not null,
  user_agent TEXT,
  ip TEXT
);
create index sessions_user_idx on sessions(user_id);

create table profiles (
  id UUID not null primary key references users(id) on delete cascade,
  email TEXT,
  full_name TEXT,
  role TEXT not null default 'requester' check (role in ('admin','technician','requester')),
  trade TEXT,
  phone TEXT,
  active BOOLEAN not null default 1,
  created_at TIMESTAMPTZ not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table app_settings (
  id INTEGER not null primary key default 1 check (id = 1),
  org_name TEXT not null default 'HAVI Logistics Philippines Inc.',
  currency TEXT not null default 'PHP',
  timezone TEXT not null default 'Asia/Manila',
  labor_rate NUMERIC(10,2) not null default 0 check (labor_rate >= 0),
  allow_signup BOOLEAN not null default 1,
  updated_at TIMESTAMPTZ not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
insert into app_settings (id) values (1);

-- Running numbers for AST-0001, P-0001 and WO-YYMM-0001.
create table counters (
  name TEXT not null primary key,
  value INTEGER not null default 0
);

-- Places -----------------------------------------------------------------
create table sites (
  id UUID not null primary key,
  code TEXT not null unique,
  name TEXT not null,
  address TEXT,
  created_at TIMESTAMPTZ not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table locations (
  id UUID not null primary key,
  site_id UUID not null references sites(id) on delete cascade,
  parent_id UUID references locations(id) on delete set null,
  name TEXT not null,
  kind TEXT,
  temp_zone TEXT check (temp_zone in ('Ambient','Chiller','Freezer')),
  created_at TIMESTAMPTZ not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create index locations_site_idx on locations(site_id);

-- Suppliers ------------------------------------------------------------
create table vendors (
  id UUID not null primary key,
  name TEXT not null unique,
  service_type TEXT,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  active BOOLEAN not null default 1,
  created_at TIMESTAMPTZ not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMPTZ not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table contracts (
  id UUID not null primary key,
  vendor_id UUID not null references vendors(id) on delete cascade,
  site_id UUID references sites(id) on delete set null,
  title TEXT not null,
  scope TEXT,
  start_date DATE,
  end_date DATE,
  value NUMERIC(14,2),
  billing TEXT check (billing in ('Monthly','Quarterly','Semi-annual','Annual','Per service','One-time')),
  renewal_notice_days INTEGER not null default 60 check (renewal_notice_days >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMPTZ not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Assets ------------------------------------------------------------------
create table asset_categories (
  id UUID not null primary key,
  name TEXT not null unique,
  is_mhe BOOLEAN not null default 0,
  sort INTEGER not null default 100
);

create table assets (
  id UUID not null primary key,
  code TEXT not null unique,
  name TEXT not null,
  category_id UUID references asset_categories(id) on delete set null,
  site_id UUID not null references sites(id) on delete restrict,
  location_id UUID references locations(id) on delete set null,
  parent_id UUID references assets(id) on delete set null,
  status TEXT not null default 'Operational'
    check (status in ('Operational','Needs Attention','Out of Service','Decommissioned')),
  criticality TEXT not null default 'Medium' check (criticality in ('Low','Medium','High','Critical')),
  make TEXT,
  model TEXT,
  serial_no TEXT,
  install_date DATE,
  warranty_expiry DATE,
  purchase_cost NUMERIC(14,2),
  vendor_id UUID references vendors(id) on delete set null,
  -- Material handling equipment
  mhe_type TEXT,
  capacity_kg NUMERIC(10,1),
  lift_height_mm NUMERIC(10,1),
  power_type TEXT,
  battery_ref TEXT,
  ownership TEXT check (ownership in ('Owned','Leased','Rented')),
  current_meter NUMERIC(12,1),
  meter_updated_at TIMESTAMPTZ,
  cert_expiry DATE,
  notes TEXT,
  created_at TIMESTAMPTZ not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMPTZ not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create index assets_site_idx on assets(site_id);
create index assets_location_idx on assets(location_id);

create table asset_status_log (
  id INTEGER primary key,
  asset_id UUID not null references assets(id) on delete cascade,
  status TEXT not null,
  note TEXT,
  changed_by UUID references profiles(id) on delete set null,
  changed_at TIMESTAMPTZ not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create index asset_status_log_asset_idx on asset_status_log(asset_id, changed_at);

create table meter_readings (
  id INTEGER primary key,
  asset_id UUID not null references assets(id) on delete cascade,
  reading NUMERIC(12,1) not null check (reading >= 0),
  source TEXT not null default 'Manual' check (source in ('Manual','Pre-use check','Work order')),
  recorded_by UUID references profiles(id) on delete set null,
  recorded_at TIMESTAMPTZ not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create index meter_readings_asset_idx on meter_readings(asset_id, recorded_at);

-- Preventive maintenance schedules -----------------------------------------
create table pm_schedules (
  id UUID not null primary key,
  title TEXT not null,
  instructions TEXT,
  site_id UUID references sites(id) on delete cascade,
  asset_id UUID references assets(id) on delete cascade,
  location_id UUID references locations(id) on delete set null,
  type TEXT not null default 'Preventive' check (type in ('Preventive','Inspection','Safety')),
  priority TEXT not null default 'Medium' check (priority in ('Low','Medium','High','Critical')),
  assigned_to UUID references profiles(id) on delete set null,
  vendor_id UUID references vendors(id) on delete set null,
  trigger_type TEXT not null default 'Calendar' check (trigger_type in ('Calendar','Meter')),
  -- Calendar trigger
  interval_value INTEGER check (interval_value > 0),
  interval_unit TEXT check (interval_unit in ('day','week','month','year')),
  schedule_mode TEXT not null default 'Fixed' check (schedule_mode in ('Fixed','Floating')),
  next_due DATE,
  lead_days INTEGER not null default 7 check (lead_days >= 0),
  -- Meter trigger (hour meter on the asset)
  meter_interval NUMERIC(12,1) check (meter_interval > 0),
  meter_last NUMERIC(12,1) not null default 0,
  meter_lead NUMERIC(12,1) not null default 0 check (meter_lead >= 0),
  tasks JSONB not null default '[]',
  estimated_hours NUMERIC(8,2),
  active BOOLEAN not null default 1,
  last_generated_at TIMESTAMPTZ,
  last_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMPTZ not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  constraint pm_calendar_fields check (
    trigger_type <> 'Calendar' or (interval_value is not null and interval_unit is not null and next_due is not null)),
  constraint pm_meter_fields check (
    trigger_type <> 'Meter' or (asset_id is not null and meter_interval is not null))
);

-- Work orders -------------------------------------------------------------
create table work_orders (
  id UUID not null primary key,
  code TEXT not null unique,
  title TEXT not null,
  description TEXT,
  type TEXT not null default 'Corrective'
    check (type in ('Corrective','Preventive','Inspection','Emergency','Safety','Improvement')),
  priority TEXT not null default 'Medium' check (priority in ('Low','Medium','High','Critical')),
  status TEXT not null default 'Open'
    check (status in ('Requested','Open','In Progress','On Hold','Completed','Cancelled','Rejected')),
  site_id UUID references sites(id) on delete set null,
  location_id UUID references locations(id) on delete set null,
  asset_id UUID references assets(id) on delete set null,
  pm_schedule_id UUID references pm_schedules(id) on delete set null,
  assigned_to UUID references profiles(id) on delete set null,
  vendor_id UUID references vendors(id) on delete set null,
  requested_by UUID references profiles(id) on delete set null,
  requester_name TEXT,
  asset_down BOOLEAN not null default 0,
  due_date DATE,
  estimated_hours NUMERIC(8,2),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  hold_reason TEXT,
  failure_cause TEXT,
  action_taken TEXT,
  downtime_hours NUMERIC(10,2) check (downtime_hours >= 0),
  meter_at_completion NUMERIC(12,1),
  external_cost NUMERIC(14,2) not null default 0 check (external_cost >= 0),
  approved_by UUID references profiles(id) on delete set null,
  approved_at TIMESTAMPTZ,
  reject_reason TEXT,
  created_by UUID references profiles(id) on delete set null,
  created_at TIMESTAMPTZ not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMPTZ not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create index work_orders_status_idx on work_orders(status);
create index work_orders_asset_idx on work_orders(asset_id);
create index work_orders_pm_idx on work_orders(pm_schedule_id);
create index work_orders_requested_by_idx on work_orders(requested_by);

create table wo_tasks (
  id UUID not null primary key,
  work_order_id UUID not null references work_orders(id) on delete cascade,
  seq INTEGER not null default 0,
  description TEXT not null,
  result TEXT check (result in ('OK','Fail','N/A')),
  note TEXT,
  done_by UUID references profiles(id) on delete set null,
  done_at TIMESTAMPTZ
);
create index wo_tasks_wo_idx on wo_tasks(work_order_id);

create table wo_labor (
  id UUID not null primary key,
  work_order_id UUID not null references work_orders(id) on delete cascade,
  technician_id UUID references profiles(id) on delete set null,
  work_date DATE not null,
  hours NUMERIC(6,2) not null check (hours > 0 and hours <= 24),
  rate NUMERIC(10,2),
  notes TEXT,
  created_by UUID references profiles(id) on delete set null,
  created_at TIMESTAMPTZ not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create index wo_labor_wo_idx on wo_labor(work_order_id);

create table wo_activity (
  id INTEGER primary key,
  work_order_id UUID not null references work_orders(id) on delete cascade,
  kind TEXT not null default 'comment' check (kind in ('comment','status','system')),
  body TEXT not null,
  author_id UUID references profiles(id) on delete set null,
  created_at TIMESTAMPTZ not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create index wo_activity_wo_idx on wo_activity(work_order_id, created_at);

-- Spare parts & MRO stock -------------------------------------------------
create table parts (
  id UUID not null primary key,
  part_no TEXT not null unique,
  name TEXT not null,
  description TEXT,
  category TEXT,
  unit TEXT not null default 'pc',
  site_id UUID references sites(id) on delete set null,
  bin_location TEXT,
  qty_on_hand NUMERIC(12,2) not null default 0,
  min_qty NUMERIC(12,2) not null default 0 check (min_qty >= 0),
  max_qty NUMERIC(12,2) check (max_qty >= 0),
  unit_cost NUMERIC(12,2) not null default 0 check (unit_cost >= 0),
  vendor_id UUID references vendors(id) on delete set null,
  active BOOLEAN not null default 1,
  notes TEXT,
  created_at TIMESTAMPTZ not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMPTZ not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table part_transactions (
  id INTEGER primary key,
  part_id UUID not null references parts(id) on delete cascade,
  kind TEXT not null check (kind in ('Receive','Issue','Return','Adjust')),
  qty NUMERIC(12,2) not null check (qty <> 0),
  unit_cost NUMERIC(12,2),
  work_order_id UUID references work_orders(id) on delete set null,
  reference TEXT,
  notes TEXT,
  created_by UUID references profiles(id) on delete set null,
  created_at TIMESTAMPTZ not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create index part_transactions_part_idx on part_transactions(part_id, created_at);
create index part_transactions_wo_idx on part_transactions(work_order_id);

-- MHE pre-use checklists ------------------------------------------------------
create table checklist_templates (
  id UUID not null primary key,
  name TEXT not null unique,
  description TEXT,
  applies_to TEXT[] not null default '[]',
  items JSONB not null default '[]',
  active BOOLEAN not null default 1,
  created_at TIMESTAMPTZ not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table checklist_submissions (
  id UUID not null primary key,
  asset_id UUID not null references assets(id) on delete cascade,
  template_id UUID references checklist_templates(id) on delete set null,
  template_name TEXT,
  operator_name TEXT,
  shift TEXT,
  meter_reading NUMERIC(12,1) check (meter_reading >= 0),
  results JSONB not null default '[]',
  fail_count INTEGER not null default 0,
  critical_fail BOOLEAN not null default 0,
  remarks TEXT,
  work_order_id UUID references work_orders(id) on delete set null,
  submitted_by UUID references profiles(id) on delete set null,
  created_at TIMESTAMPTZ not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create index checklist_submissions_asset_idx on checklist_submissions(asset_id, created_at);

-- Statutory & regulatory compliance -----------------------------------------
create table compliance_items (
  id UUID not null primary key,
  site_id UUID references sites(id) on delete cascade,
  name TEXT not null,
  category TEXT not null default 'Permit'
    check (category in ('Permit','License','Certificate','Inspection','Testing','Audit','Training','Report')),
  authority TEXT,
  reference TEXT,
  frequency_months INTEGER check (frequency_months > 0),
  last_done DATE,
  next_due DATE,
  responsible_id UUID references profiles(id) on delete set null,
  vendor_id UUID references vendors(id) on delete set null,
  document_url TEXT,
  notes TEXT,
  active BOOLEAN not null default 1,
  created_at TIMESTAMPTZ not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMPTZ not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table compliance_events (
  id INTEGER primary key,
  item_id UUID not null references compliance_items(id) on delete cascade,
  done_date DATE not null,
  next_due DATE,
  notes TEXT,
  document_url TEXT,
  recorded_by UUID references profiles(id) on delete set null,
  created_at TIMESTAMPTZ not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create index compliance_events_item_idx on compliance_events(item_id);

-- Per-work-order roll-up of tasks, labour and cost. Staff only (see access.js).
create view wo_summary as
select w.id as work_order_id,
       coalesce(t.total, 0)  as task_total,
       coalesce(t.done, 0)   as task_done,
       coalesce(t.failed, 0) as task_failed,
       round(coalesce(l.hours, 0), 2) as labor_hours,
       round(coalesce(l.cost, 0), 2)  as labor_cost,
       round(coalesce(p.cost, 0), 2)  as parts_cost,
       w.external_cost,
       round(coalesce(l.cost, 0) + coalesce(p.cost, 0) + w.external_cost, 2) as total_cost
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
