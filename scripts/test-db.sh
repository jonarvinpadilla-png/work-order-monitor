#!/usr/bin/env bash
# Runs the database schema, demo seed and behaviour tests against a local
# Postgres (not Supabase). Usage:
#   PGHOST=/tmp PGPORT=5432 PGUSER=postgres scripts/test-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."

DB=${TEST_DB:-cmms_test}
export PGOPTIONS='-c client_min_messages=warning'
PSQL="psql -X -q -v ON_ERROR_STOP=1"

$PSQL -d postgres -c "drop database if exists $DB" -c "create database $DB"
$PSQL -d "$DB" -f supabase/tests/supabase_stub.sql
$PSQL -d "$DB" -f supabase/schema.sql
$PSQL -d "$DB" -f supabase/schema.sql   # must be safe to re-run
echo "schema: ok (applied twice)"

$PSQL -d "$DB" -f supabase/tests/behaviour_test.sql 2>&1 | grep -E "pass:|FAILED|ERROR|PASSED" | sed 's/^psql:[^ ]* //'

$PSQL -d "$DB" -f supabase/seed_demo.sql
$PSQL -d "$DB" -f supabase/seed_demo.sql   # must be safe to re-run
echo "seed: ok (applied twice)"
$PSQL -d "$DB" -Atc "select 'seed counts: ' || (select count(*) from assets) || ' assets, ' || (select count(*) from work_orders) || ' work orders, ' || (select count(*) from pm_schedules) || ' PM schedules, ' || (select count(*) from parts) || ' parts'"

$PSQL -d "$DB" -f supabase/reset_data.sql
$PSQL -d "$DB" -Atc "select 'after reset: ' || (select count(*) from assets) || ' assets, ' || (select count(*) from checklist_templates) || ' checklist templates kept'"

# Upgrade path from the old Work Order Monitor (schema as of commit 30cc742).
LEG=${DB}_legacy
$PSQL -d postgres -c "drop database if exists $LEG" -c "create database $LEG"
$PSQL -d "$LEG" -f supabase/tests/supabase_stub.sql
git show 30cc742:supabase/schema.sql | $PSQL -d "$LEG"
$PSQL -d "$LEG" -c "insert into work_orders (title, type, facility, equipment, priority, status, assigned_to, due_date) values
  ('Replace dock light', 'Corrective', 'Dry Warehouse', 'Dock 2 light', 'High', 'Open', 'Ben', current_date + 3),
  ('Monthly FE check', 'PM', 'Cold Storage', null, 'Medium', 'Completed', null, current_date - 5)"
$PSQL -d "$LEG" -f supabase/schema.sql
$PSQL -d "$LEG" -c "insert into sites (code, name) values ('PLD', 'Plaridel DC')"
$PSQL -d "$LEG" -f supabase/import_legacy.sql
$PSQL -d "$LEG" -f supabase/import_legacy.sql   # must be safe to re-run
$PSQL -d "$LEG" -Atc "select 'legacy import: ' || count(*) || ' work orders, types ' || string_agg(distinct type, '/') || ', locations ' || (select string_agg(name, '/' order by name) from locations) from work_orders"
$PSQL -d "$LEG" -Atc "insert into work_orders (title) values ('new after import') returning 'next new code: ' || code"
