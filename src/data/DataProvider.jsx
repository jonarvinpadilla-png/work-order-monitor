import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { fetchAll } from './api';

// Everything the screens list is loaded once, kept in memory and refreshed
// when Supabase Realtime reports a change (or right after the user saves).
const DATASETS = {
  settings: { table: 'app_settings' },
  profiles: { table: 'profiles', order: 'full_name' },
  sites: { table: 'sites', order: 'name' },
  locations: { table: 'locations', order: 'name' },
  categories: { table: 'asset_categories', order: 'sort' },
  assets: { table: 'assets', order: 'code' },
  templates: { table: 'checklist_templates', order: 'name' },
  workOrders: { table: 'work_orders', order: 'created_at', desc: true },
  checks: { table: 'checklist_submissions', order: 'created_at', desc: true, sinceDays: 60 },
  woSummary: { table: 'wo_summary', key: 'work_order_id', staff: true },
  statusLog: { table: 'asset_status_log', order: 'changed_at', staff: true },
  pm: { table: 'pm_schedules', order: 'title', staff: true },
  parts: { table: 'parts', order: 'name', staff: true },
  vendors: { table: 'vendors', order: 'name', staff: true },
  contracts: { table: 'contracts', order: 'end_date', staff: true },
  compliance: { table: 'compliance_items', order: 'next_due', staff: true }
};

const TABLE_KEYS = {
  app_settings: ['settings'], profiles: ['profiles'], sites: ['sites'], locations: ['locations'],
  asset_categories: ['categories'], assets: ['assets'], meter_readings: ['assets'], asset_status_log: ['statusLog'],
  checklist_templates: ['templates'], checklist_submissions: ['checks'],
  work_orders: ['workOrders', 'woSummary'], wo_tasks: ['woSummary'], wo_labor: ['woSummary'],
  part_transactions: ['woSummary', 'parts'], pm_schedules: ['pm'], parts: ['parts'],
  vendors: ['vendors'], contracts: ['contracts'], compliance_items: ['compliance'], compliance_events: ['compliance']
};

const DataContext = createContext(null);
export const useData = () => useContext(DataContext);

const byId = (rows, key = 'id') => Object.fromEntries(rows.map(r => [r[key], r]));

function readSite() {
  try { return localStorage.getItem('cmms.site') || ''; } catch { return ''; }
}

export function DataProvider({ profile, children }) {
  const isStaff = profile.role === 'admin' || profile.role === 'technician';
  const keys = useMemo(() => Object.keys(DATASETS).filter(k => isStaff || !DATASETS[k].staff), [isStaff]);
  const [data, setData] = useState(() => Object.fromEntries(Object.keys(DATASETS).map(k => [k, []])));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [siteId, setSiteIdState] = useState(readSite);
  const listeners = useRef(new Set());
  const pending = useRef(new Set());
  const timer = useRef(null);

  const load = useCallback(async (which) => {
    const wanted = which.filter(k => keys.includes(k));
    const results = await Promise.all(wanted.map(async k => [k, await fetchAll(DATASETS[k])]));
    setData(prev => ({ ...prev, ...Object.fromEntries(results) }));
  }, [keys]);

  const reload = useCallback((which = keys) => load(which).catch(e => console.error('Refresh failed', e)), [load, keys]);

  // Refresh after a save without waiting for Realtime (which may be off).
  const refreshTables = useCallback((...tables) => {
    const ks = new Set(tables.flatMap(t => TABLE_KEYS[t] || []));
    return reload([...ks]);
  }, [reload]);

  useEffect(() => {
    let alive = true;
    load(keys)
      .then(() => alive && setLoading(false))
      .catch(e => { if (alive) { setError(e.message); setLoading(false); } });

    const channel = supabase
      .channel('cmms-live')
      .on('postgres_changes', { event: '*', schema: 'public' }, payload => {
        (TABLE_KEYS[payload.table] || []).forEach(k => pending.current.add(k));
        listeners.current.forEach(fn => fn(payload.table, payload));
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          const which = [...pending.current];
          pending.current.clear();
          reload(which);
        }, 300);
      })
      .subscribe();
    return () => { alive = false; clearTimeout(timer.current); supabase.removeChannel(channel); };
  }, [keys, load, reload]);

  const subscribe = useCallback(fn => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  const setSiteId = useCallback(id => {
    setSiteIdState(id);
    try { localStorage.setItem('cmms.site', id); } catch { /* storage unavailable */ }
  }, []);

  const value = useMemo(() => {
    const me = data.profiles.find(p => p.id === profile.id) || profile;
    const activeSite = data.sites.some(s => s.id === siteId) ? siteId : '';
    return {
      ...data,
      settings: data.settings[0] || {},
      loading, error, reload, refreshTables, subscribe,
      me,
      isAdmin: me.role === 'admin',
      isStaff: me.role === 'admin' || me.role === 'technician',
      siteId: activeSite,
      setSiteId,
      inSite: rec => !activeSite || !rec.site_id || rec.site_id === activeSite,
      lookup: {
        asset: byId(data.assets),
        location: byId(data.locations),
        profile: byId(data.profiles),
        category: byId(data.categories),
        vendor: byId(data.vendors),
        site: byId(data.sites),
        pm: byId(data.pm),
        part: byId(data.parts),
        template: byId(data.templates),
        summary: byId(data.woSummary, 'work_order_id')
      }
    };
  }, [data, loading, error, reload, refreshTables, subscribe, profile, siteId, setSiteId]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
