import { useMemo, useState } from 'react';
import { useData } from '../data/DataProvider';
import { AssetStatusBadge, AssetTag, Badge, DataTable, LocationSelect, Options, PageHead, SearchBox } from '../components/ui';
import { Icon } from '../lib/icons';
import { navigate } from '../lib/router';
import { ASSET_STATUSES, CRITICALITY, PRIORITY_RANK } from '../lib/constants';
import { isActive, locationPath, pmNextInfo } from '../lib/domain';
import { downloadCsv } from '../lib/csv';
import AssetForm from './AssetForm';

export default function Assets() {
  const { assets, categories, lookup, inSite, workOrders, pm, siteId } = useData();
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ search: '', category: '', location: '', status: '', criticality: '' });
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));

  const openJobs = useMemo(() => {
    const m = {};
    workOrders.forEach(w => { if (w.asset_id && isActive(w)) m[w.asset_id] = (m[w.asset_id] || 0) + 1; });
    return m;
  }, [workOrders]);
  const nextPm = useMemo(() => {
    const m = {};
    pm.filter(s => s.active && s.asset_id).forEach(s => {
      const info = pmNextInfo(s, lookup.asset[s.asset_id]);
      if (!m[s.asset_id] || info.sortKey < m[s.asset_id].sortKey) m[s.asset_id] = info;
    });
    return m;
  }, [pm, lookup]);

  // Include child locations when filtering by a parent location.
  const locIds = useMemo(() => {
    if (!f.location) return null;
    const ids = new Set([f.location]);
    let grew = true;
    while (grew) {
      grew = false;
      Object.values(lookup.location).forEach(l => { if (l.parent_id && ids.has(l.parent_id) && !ids.has(l.id)) { ids.add(l.id); grew = true; } });
    }
    return ids;
  }, [f.location, lookup.location]);

  const rows = useMemo(() => {
    const s = f.search.trim().toLowerCase();
    return assets.filter(a => {
      if (!inSite(a)) return false;
      if (f.category && a.category_id !== f.category) return false;
      if (locIds && !locIds.has(a.location_id)) return false;
      if (f.status ? a.status !== f.status : a.status === 'Decommissioned') return false;
      if (f.criticality && a.criticality !== f.criticality) return false;
      if (s && !`${a.code} ${a.name} ${a.make || ''} ${a.model || ''} ${a.serial_no || ''} ${a.mhe_type || ''}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [assets, f, inSite, locIds]);

  const columns = [
    { key: 'code', label: 'Tag', sort: a => a.code, render: a => <AssetTag asset={a} /> },
    { key: 'name', label: 'Asset', sort: a => a.name, render: a => <><div className="cell-title">{a.name}</div><div className="cell-sub">{[a.make, a.model].filter(Boolean).join(' ') || lookup.category[a.category_id]?.name}</div></> },
    { key: 'loc', label: 'Location', sort: a => lookup.location[a.location_id]?.name, render: a => lookup.location[a.location_id]?.name || <span className="mute">—</span> },
    { key: 'status', label: 'Status', sort: a => a.status, render: a => <AssetStatusBadge status={a.status} /> },
    { key: 'crit', label: 'Criticality', sort: a => PRIORITY_RANK[a.criticality], render: a => a.criticality },
    { key: 'jobs', label: 'Open jobs', right: true, sort: a => openJobs[a.id] || 0, render: a => openJobs[a.id] || <span className="mute">0</span> },
    { key: 'pm', label: 'Next PM', sort: a => nextPm[a.id]?.sortKey ?? 1e9, render: a => nextPm[a.id] ? <Badge tone={nextPm[a.id].tone === 'muted' ? 'plain' : nextPm[a.id].tone}>{nextPm[a.id].label}</Badge> : <span className="mute">None</span> }
  ];

  function exportCsv() {
    downloadCsv(`assets-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Tag', 'Name', 'Category', 'Location', 'Status', 'Criticality', 'Make', 'Model', 'Serial', 'Installed', 'Warranty ends', 'MHE type', 'Capacity kg', 'Power', 'Ownership', 'Hour meter', 'Certificate valid to', 'Open jobs'],
      rows.map(a => [a.code, a.name, lookup.category[a.category_id]?.name, locationPath(lookup.location[a.location_id], lookup.location), a.status, a.criticality,
        a.make, a.model, a.serial_no, a.install_date, a.warranty_expiry, a.mhe_type, a.capacity_kg, a.power_type, a.ownership, a.current_meter, a.cert_expiry, openJobs[a.id] || 0]));
  }

  return (
    <>
      <PageHead eyebrow="Equipment" title="Assets" sub="Every maintainable item in the facility, from reach trucks to roof gutters."
                actions={<>
                  <button className="btn" onClick={exportCsv}><Icon.Download />Export CSV</button>
                  <button className="btn btn-primary" onClick={() => setAdding(true)}><Icon.Plus />Add asset</button>
                </>} />
      <div className="toolbar">
        <SearchBox value={f.search} onChange={v => set('search', v)} placeholder="Tag, name, make, serial" />
        <select className="select" value={f.category} onChange={e => set('category', e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div style={{ minWidth: 180 }}><LocationSelect value={f.location} onChange={v => set('location', v)} siteId={siteId} emptyLabel="All locations" /></div>
        <select className="select" value={f.status} onChange={e => set('status', e.target.value)} aria-label="Status"><Options values={ASSET_STATUSES} empty="In use (any status)" /></select>
        <select className="select" value={f.criticality} onChange={e => set('criticality', e.target.value)} aria-label="Criticality"><Options values={CRITICALITY} empty="Any criticality" /></select>
      </div>
      <div className="card">
        <DataTable columns={columns} rows={rows} onRowClick={a => navigate(`/assets/${a.id}`)} initialSort={{ key: 'code', dir: 'asc' }}
                   empty="No assets match. Add your first asset, or clear the filters." />
      </div>
      {adding && <AssetForm onClose={() => setAdding(false)} />}
    </>
  );
}
