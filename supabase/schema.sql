-- Work Order Monitor — database schema
-- Run this once in your Supabase project's SQL Editor (Dashboard > SQL Editor > New query)

create extension if not exists "pgcrypto";

create sequence if not exists work_order_seq;

create table if not exists work_orders (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  title text not null,
  description text,
  type text not null check (type in ('PM','Corrective','Safety')),
  facility text not null,
  location text,
  equipment text,
  priority text not null check (priority in ('Low','Medium','High','Critical')),
  status text not null default 'Open' check (status in ('Open','In Progress','On Hold','Completed','Cancelled')),
  assigned_to text,
  reported_by text,
  date_reported date,
  due_date date,
  date_completed date,
  reference text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-generate a readable work order code like WO-2608-0001
create or replace function generate_wo_code()
returns trigger as $$
begin
  if new.code is null then
    new.code := 'WO-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('work_order_seq')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_wo_code on work_orders;
create trigger set_wo_code
  before insert on work_orders
  for each row execute function generate_wo_code();

-- Keep updated_at current on every edit
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists touch_updated_at on work_orders;
create trigger touch_updated_at
  before update on work_orders
  for each row execute function set_updated_at();

-- Row Level Security: any signed-in teammate can read and manage work orders.
-- (Everyone who has an account in this Supabase project is treated as trusted staff.)
alter table work_orders enable row level security;

drop policy if exists "Authenticated users can read work orders" on work_orders;
create policy "Authenticated users can read work orders"
  on work_orders for select
  using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can insert work orders" on work_orders;
create policy "Authenticated users can insert work orders"
  on work_orders for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can update work orders" on work_orders;
create policy "Authenticated users can update work orders"
  on work_orders for update
  using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can delete work orders" on work_orders;
create policy "Authenticated users can delete work orders"
  on work_orders for delete
  using (auth.role() = 'authenticated');

-- Enable realtime so everyone's board updates live when a colleague makes a change
alter publication supabase_realtime add table work_orders;
