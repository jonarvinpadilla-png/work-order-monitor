import { supabase } from '../supabaseClient';

// Turns database errors into messages a technician can act on.
export function friendlyError(error) {
  const msg = error?.message || String(error);
  if (/row-level security|permission denied/i.test(msg)) return "You don't have permission to do that.";
  if (/duplicate key.*assets_code_key/i.test(msg)) return 'That asset tag is already in use.';
  if (/duplicate key.*parts_part_no_key/i.test(msg)) return 'That part number is already in use.';
  if (/duplicate key.*vendors_name_key/i.test(msg)) return 'A vendor with that name already exists.';
  if (/duplicate key.*sites_code_key/i.test(msg)) return 'That site code is already in use.';
  if (/duplicate key.*asset_categories_name_key/i.test(msg)) return 'That category already exists.';
  if (/duplicate key.*checklist_templates_name_key/i.test(msg)) return 'A checklist with that name already exists.';
  if (/duplicate key/i.test(msg)) return 'That value is already in use.';
  if (/violates foreign key constraint/i.test(msg)) return 'This record is still used elsewhere, so it cannot be deleted.';
  if (/pm_calendar_fields/.test(msg)) return 'Calendar schedules need an interval and a next due date.';
  if (/pm_meter_fields/.test(msg)) return 'Hour-meter schedules need an asset and an hour interval.';
  if (/violates check constraint/i.test(msg)) return 'One of the values is not allowed. Check the form and try again.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'Could not reach the server. Check your connection and try again.';
  return msg;
}

async function run(query) {
  const { data, error } = await query;
  if (error) throw new Error(friendlyError(error));
  return data;
}

function one(rows, what) {
  if (!rows || rows.length === 0) throw new Error(`You don't have permission to ${what} this record, or it no longer exists.`);
  return rows[0];
}

export const db = {
  select: (table, build = q => q) => run(build(supabase.from(table).select('*'))),
  insert: async (table, row) => one(await run(supabase.from(table).insert(row).select()), 'create'),
  insertMany: (table, rows) => run(supabase.from(table).insert(rows)),
  update: async (table, id, patch) => one(await run(supabase.from(table).update(patch).eq('id', id).select()), 'change'),
  remove: async (table, id) => one(await run(supabase.from(table).delete().eq('id', id).select()), 'delete'),
  rpc: (fn, args) => run(supabase.rpc(fn, args))
};

// Supabase returns at most 1000 rows per request; page through the rest.
export async function fetchAll(def) {
  const out = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    let q = supabase.from(def.table).select('*');
    if (def.order) q = q.order(def.order, { ascending: !def.desc, nullsFirst: false });
    q = q.order(def.key || 'id', { ascending: true });
    if (def.sinceDays) q = q.gte(def.sinceCol || 'created_at', new Date(Date.now() - def.sinceDays * 86400000).toISOString());
    const data = await run(q.range(from, from + size - 1));
    out.push(...data);
    if (data.length < size) break;
  }
  return out;
}
