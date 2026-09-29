import { useMemo, useState } from 'react';
import { useData } from '../data/DataProvider';
import { useGlobalActions } from '../components/GlobalActions';
import { AssetStatusBadge, AssetTag, Badge, DataTable, EmptyState, HourMeter, Options, PageHead, SearchBox, Tabs, Tile } from '../components/ui';
import { Icon } from '../lib/icons';
import { href, navigate } from '../lib/router';
import { MHE_SUPPORT_TYPES } from '../lib/constants';
import { expiryInfo, isActive, isMheUnit, pmNextInfo } from '../lib/domain';
import { fmtDateTime, fmtTime, parseDate, todayStr } from '../lib/format';

export default function MheHub() {
  const d = useData();
  const { lookup, inSite, isStaff } = d;
  const [tab, setTab] = useState('units');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const today = todayStr();

  const mhe = useMemo(() => d.assets.filter(a => inSite(a) && a.mhe_type && a.status !== 'Decommissioned'), [d.assets, inSite]);
  const units = mhe.filter(isMheUnit);
  const support = mhe.filter(a => MHE_SUPPORT_TYPES.includes(a.mhe_type));
  const types = [...new Set(units.map(a => a.mhe_type))].sort();

  const lastCheck = useMemo(() => {
    const m = {};
    for (const c of d.checks) if (!m[c.asset_id] || c.created_at > m[c.asset_id].created_at) m[c.asset_id] = c;
    return m;
  }, [d.checks]);
  const checkedToday = a => lastCheck[a.id] && todayStr(parseDate(lastCheck[a.id].created_at)) === today;

  const s = search.trim().toLowerCase();
  const shown = units
    .filter(a => !type || a.mhe_type === type)
    .filter(a => !s || `${a.code} ${a.name} ${a.make || ''} ${a.model || ''} ${lookup.location[a.location_id]?.name || ''}`.toLowerCase().includes(s));

  const checkable = units.filter(a => a.mhe_type !== 'Manual Pallet Jack');
  const locked = units.filter(a => a.status === 'Out of Service');
  const certSoon = units.filter(a => a.cert_expiry && expiryInfo(a.cert_expiry, 30).tone !== 'good');

  return (
    <>
      <PageHead eyebrow="Equipment" title="Material handling equipment"
                sub={isStaff ? 'Reach trucks, forklifts, pallet trucks and lifts: status, hour meters, pre-use checks and service due.' : 'Pick your unit and run the pre-use check before you drive it.'} />

      <div className="tiles">
        <Tile label="Units in service" icon={Icon.Forklift} value={`${units.filter(a => a.status === 'Operational').length}/${units.length}`} tone={locked.length ? 'warn' : 'good'} />
        <Tile label="Locked out" icon={Icon.Lock} value={locked.length} tone={locked.length ? 'danger' : null} sub={locked.map(a => a.code).join(', ') || 'None'} />
        <Tile label="Pre-use checks today" icon={Icon.Clipboard} value={`${checkable.filter(checkedToday).length}/${checkable.length}`}
              sub={`${checkable.filter(a => !checkedToday(a)).length} not checked yet`} />
        {isStaff && <Tile label="Certificates due ≤ 30 days" icon={Icon.Shield} value={certSoon.length} tone={certSoon.length ? 'warn' : null} sub="Third-party inspection / load test" />}
      </div>

      <Tabs value={tab} onChange={setTab} items={[
        { value: 'units', label: 'Units', count: units.length },
        ...(isStaff ? [{ value: 'support', label: 'Batteries & chargers', count: support.length }] : []),
        { value: 'log', label: isStaff ? 'Check log' : 'My checks' }
      ]} />

      {tab === 'units' && (
        <>
          <div className="toolbar">
            <SearchBox value={search} onChange={setSearch} placeholder="Unit number, model or area" />
            <select className="select" value={type} onChange={e => setType(e.target.value)} aria-label="Type"><Options values={types} empty="All types" /></select>
          </div>
          {shown.length === 0 ? <div className="card"><EmptyState title="No MHE units">{isStaff ? 'Add units under Assets using an MHE category.' : 'No units match.'}</EmptyState></div> : (
            <div className="unit-grid">
              {shown.map(a => <UnitCard key={a.id} asset={a} check={lastCheck[a.id]} checkedToday={checkedToday(a)} />)}
            </div>
          )}
        </>
      )}

      {tab === 'support' && (
        <div className="card">
          <DataTable rows={support} onRowClick={a => navigate(`/assets/${a.id}`)} initialSort={{ key: 'code', dir: 'asc' }}
            columns={[
              { key: 'code', label: 'Tag', sort: a => a.code, render: a => <AssetTag asset={a} /> },
              { key: 'name', label: 'Name', sort: a => a.name, render: a => <><div className="cell-title">{a.name}</div><div className="cell-sub">{[a.make, a.model].filter(Boolean).join(' ')}</div></> },
              { key: 'type', label: 'Type', sort: a => a.mhe_type, render: a => a.mhe_type },
              { key: 'parent', label: 'Fitted to', render: a => a.parent_id ? <AssetTag asset={lookup.asset[a.parent_id]} /> : <span className="mute">—</span> },
              { key: 'status', label: 'Status', sort: a => a.status, render: a => <AssetStatusBadge status={a.status} /> }
            ]} />
        </div>
      )}

      {tab === 'log' && <CheckLog />}
    </>
  );
}

function UnitCard({ asset: a, check, checkedToday }) {
  const { lookup, pm, workOrders, isStaff } = useData();
  const { newRequest } = useGlobalActions();
  const locked = a.status === 'Out of Service';
  const meterPm = pm.find(s => s.active && s.asset_id === a.id && s.trigger_type === 'Meter');
  const next = meterPm ? pmNextInfo(meterPm, a) : null;
  const openJobs = workOrders.filter(w => w.asset_id === a.id && isActive(w)).length;
  const cert = a.cert_expiry ? expiryInfo(a.cert_expiry, 30) : null;
  const manual = a.mhe_type === 'Manual Pallet Jack';

  let checkLine;
  if (manual) checkLine = <span className="mute">Weekly check</span>;
  else if (checkedToday && check.fail_count === 0) checkLine = <Badge tone="good" icon={Icon.Check}>Passed {fmtTime(check.created_at)}</Badge>;
  else if (checkedToday && check.critical_fail) checkLine = <Badge tone="danger" icon={Icon.Octagon}>Failed {fmtTime(check.created_at)}</Badge>;
  else if (checkedToday) checkLine = <Badge tone="warn" icon={Icon.Alert}>{check.fail_count} defect{check.fail_count > 1 ? 's' : ''} {fmtTime(check.created_at)}</Badge>;
  else checkLine = <Badge tone="plain" icon={Icon.Clock}>Not checked today</Badge>;

  return (
    <article className={`unit ${locked ? 'locked' : ''}`}>
      {locked && <div className="lockout-band" aria-hidden="true" />}
      <div className="unit-top">
        <div className="unit-no">{isStaff ? <a href={href(`/assets/${a.id}`)}>{a.code}</a> : a.code}</div>
        <AssetStatusBadge status={a.status} />
      </div>
      <div className="unit-type">{a.mhe_type} · {[a.make, a.model].filter(Boolean).join(' ')}</div>
      <div className="unit-body">
        <div className="unit-line"><span className="k">Area</span><span>{lookup.location[a.location_id]?.name || '—'}</span></div>
        {!manual && <div className="unit-line"><span className="k">Hour meter</span><HourMeter value={a.current_meter} /></div>}
        <div className="unit-line"><span className="k">Pre-use</span>{checkLine}</div>
        {isStaff && next && <div className="unit-line"><span className="k">Next service</span><span title={next.label}><Badge tone={next.tone === 'muted' ? 'plain' : next.tone}>{next.sub}</Badge></span></div>}
        {isStaff && cert && <div className="unit-line"><span className="k">Certificate</span><Badge tone={cert.tone === 'good' ? 'plain' : cert.tone}>{cert.tone === 'good' ? `to ${a.cert_expiry}` : cert.label}</Badge></div>}
        {isStaff && openJobs > 0 && <div className="unit-line"><span className="k">Open jobs</span><a href={href(`/assets/${a.id}`)}>{openJobs}</a></div>}
      </div>
      <div className="unit-foot">
        {locked
          ? <button className="btn btn-sm" disabled title="Locked out until repaired"><Icon.Lock />Locked out</button>
          : !manual && <a className={`btn btn-sm ${checkedToday ? '' : 'btn-primary'}`} href={href(`/mhe/${a.id}/check`)}><Icon.Clipboard />{checkedToday ? 'Check again' : 'Pre-use check'}</a>}
        {manual && !locked && <a className="btn btn-sm" href={href(`/mhe/${a.id}/check`)}><Icon.Clipboard />Weekly check</a>}
        <button className="btn btn-sm" onClick={() => newRequest({ asset_id: a.id, site_id: a.site_id, location_id: a.location_id || '' })}><Icon.Wrench />Report issue</button>
      </div>
    </article>
  );
}

function CheckLog() {
  const { checks, workOrders, lookup, inSite, isStaff } = useData();
  const rows = checks.filter(c => inSite(lookup.asset[c.asset_id] || {}));
  const woCode = useMemo(() => Object.fromEntries(workOrders.map(w => [w.id, w.code])), [workOrders]);
  return (
    <div className="card">
      <DataTable rows={rows} initialSort={{ key: 'when', dir: 'desc' }} empty="No pre-use checks in the last 60 days."
        onRowClick={c => c.work_order_id && navigate(`/work-orders/${c.work_order_id}`)}
        columns={[
          { key: 'when', label: 'When', sort: c => c.created_at, render: c => <span className="nowrap">{fmtDateTime(c.created_at)}</span> },
          { key: 'unit', label: 'Unit', sort: c => lookup.asset[c.asset_id]?.code, render: c => <AssetTag asset={lookup.asset[c.asset_id]} link={isStaff} /> },
          { key: 'op', label: 'Operator', sort: c => c.operator_name, render: c => <>{c.operator_name || '—'}{c.shift && <div className="cell-sub">{c.shift}</div>}</> },
          { key: 'meter', label: 'Hour meter', right: true, sort: c => Number(c.meter_reading), render: c => c.meter_reading ?? '—' },
          {
            key: 'result', label: 'Result', sort: c => (c.critical_fail ? 2 : c.fail_count ? 1 : 0),
            render: c => c.critical_fail ? <Badge tone="danger" icon={Icon.Octagon}>Critical fail</Badge>
              : c.fail_count ? <Badge tone="warn" icon={Icon.Alert}>{c.fail_count} defect{c.fail_count > 1 ? 's' : ''}</Badge>
              : <Badge tone="good" icon={Icon.Check}>Pass</Badge>
          },
          { key: 'wo', label: 'Work order', render: c => c.work_order_id ? <a className="tag wo" href={href(`/work-orders/${c.work_order_id}`)}>{woCode[c.work_order_id] || 'View'}</a> : <span className="mute">—</span> }
        ]} />
    </div>
  );
}
