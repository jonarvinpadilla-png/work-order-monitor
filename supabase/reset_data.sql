-- =====================================================================
-- HLPI Facilities CMMS — clear all operational data
--
-- Deletes sites, locations, assets, work orders, PM schedules, parts,
-- vendors, contracts, checklists and the compliance register. Use it to
-- remove the sample data before you enter your real asset register.
--
-- Keeps: user accounts and roles, general settings, asset categories and
-- checklist templates. THIS CANNOT BE UNDONE.
-- =====================================================================

truncate table
  compliance_events, compliance_items,
  checklist_submissions,
  part_transactions, parts,
  wo_activity, wo_labor, wo_tasks, work_orders,
  pm_schedules,
  meter_readings, asset_status_log, assets,
  contracts, vendors,
  locations, sites
restart identity cascade;

alter sequence wo_code_seq restart;
alter sequence asset_code_seq restart;
alter sequence part_no_seq restart;
