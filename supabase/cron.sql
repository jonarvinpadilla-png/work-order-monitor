-- =====================================================================
-- HLPI Facilities CMMS — optional daily PM generation
--
-- The app already creates due PM work orders whenever a technician or
-- admin opens it. Run this once if you also want Supabase to do it every
-- morning, even on days nobody logs in.
--
-- Before running: Supabase Dashboard → Database → Extensions → enable
-- "pg_cron". Runs at 05:50 Philippine time (21:50 UTC the day before).
-- =====================================================================

create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname = 'cmms-generate-pm';
select cron.schedule('cmms-generate-pm', '50 21 * * *', $$select public.generate_pm_work_orders()$$);
