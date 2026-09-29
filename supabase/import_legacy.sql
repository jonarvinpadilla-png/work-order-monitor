-- =====================================================================
-- HLPI Facilities CMMS — copy work orders from the old Work Order Monitor
--
-- Only needed if you installed the new schema in the SAME Supabase project
-- the old app used. schema.sql renamed the old table to work_orders_legacy;
-- this copies its rows into the new work order register.
--
-- Before running: create at least one site in Settings → Sites & locations.
-- Old rows go to the first site. Each old "facility" becomes a location
-- (created if missing). Old free-text fields (equipment, assigned to,
-- reported by, reference, notes) are kept in the description.
-- Safe to run twice: rows already copied are skipped.
-- =====================================================================

do $$
declare
  target_site uuid := (select id from sites order by created_at limit 1);
  copied int;
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'work_orders_legacy') then
    raise notice 'No work_orders_legacy table found – nothing to import.';
    return;
  end if;
  if target_site is null then
    raise exception 'Create a site first (Settings → Sites & locations), then run this again.';
  end if;

  insert into locations (site_id, name, kind)
  select distinct target_site, l.facility, 'Imported'
    from work_orders_legacy l
   where coalesce(l.facility, '') <> ''
     and not exists (select 1 from locations x where x.site_id = target_site and x.name = l.facility);

  insert into work_orders (code, title, description, type, priority, status, site_id, location_id,
                           requester_name, due_date, completed_at, created_at, updated_at)
  select l.code,
         l.title,
         nullif(concat_ws(E'\n',
                  nullif(l.description, ''),
                  'Equipment: ' || nullif(l.equipment, ''),
                  'Location detail: ' || nullif(l.location, ''),
                  'Assigned to (old app): ' || nullif(l.assigned_to, ''),
                  'Reference: ' || nullif(l.reference, ''),
                  'Notes: ' || nullif(l.notes, '')), ''),
         case l.type when 'PM' then 'Preventive' when 'Safety' then 'Safety' else 'Corrective' end,
         l.priority,
         l.status,
         target_site,
         (select id from locations x where x.site_id = target_site and x.name = l.facility limit 1),
         nullif(l.reported_by, ''),
         l.due_date,
         case when l.status = 'Completed' then coalesce(l.date_completed::timestamptz, l.updated_at) end,
         coalesce(l.date_reported::timestamptz, l.created_at),
         l.updated_at
    from work_orders_legacy l
   where not exists (select 1 from work_orders w where w.code = l.code);
  get diagnostics copied = row_count;

  -- Keep new codes clear of the imported ones.
  perform setval('wo_code_seq', greatest(
    (select last_value from wo_code_seq),
    coalesce((select max(nullif(regexp_replace(split_part(code, '-', 3), '\D', '', 'g'), '')::int) from work_orders_legacy), 0)));

  raise notice 'Copied % work orders from the old app.', copied;
end $$;
