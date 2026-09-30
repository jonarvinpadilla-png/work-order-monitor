import { useEffect, useMemo, useState } from 'react';
import { useData } from '../data/DataProvider';
import { db } from '../data/api';
import { useAction } from '../components/Toast';
import { useGlobalActions } from '../components/GlobalActions';
import {
  AssetStatusBadge, AssetTag, Badge, Card, ConfirmButton, DataTable, DueBadge, EmptyState, Field, FormModal, HourMeter,
  Lockout, Options, PageHead, Person, PriorityBadge, StatusBadge, Tabs, Tile, WoCode
} from '../components/ui';
import { Icon } from '../lib/icons';
import { href, navigate } from '../lib/router';
import { ASSET_STATUSES } from '../lib/constants';
import { describeTrigger, expiryInfo, isActive, isMheUnit, locationPath, pmNextInfo } from '../lib/domain';
import { fmtDate, fmtDateTime, fmtMoney, fmtNum, parseDate } from '../lib/format';
import AssetForm from './AssetForm';
import MheArt from '../illustrations/Mhe';
import PmForm from './PmForm';

export default function AssetDetail({ id }) {
  const d = useData();
  const { lookup, isAdmin, refreshTables } = d;
  const { newWorkOrder } = useGlobalActions();
  const [run] = useAction();
  const [tab, setTab] = useState('overview');
  const [modal, setModal] = useState(null); // edit | status | meter | pm
  const asset = lookup.asset[id];

  const wos = useMemo(() => d.workOrders.filter(w => w.asset_id === id), [d.workOrders, id]);
  const schedules = useMemo(() => d.pm.filter(s => s.asset_id === id), [d.pm, id]);
  const checks = useMemo(() => d.checks.filter(c => c.asset_id === id), [d.checks, id]);
  const log = useMemo(() => d.statusLog.filter(e => e.asset_id === id).sort((a, b) => b.changed_at.localeCompare(a.changed_at)), [d.statusLog, id]);
  const children = useMemo(() => d.assets.filter(a => a.parent_id === id), [d.assets, id]);

  if (!asset) return <EmptyState title="Asset not found" action={<a className="btn" href={href('/assets')}>Back to assets</a>}>It may have been deleted.</EmptyState>;

  const cat = lookup.category[asset.category_id];
  const mhe = isMheUnit(asset);
  const yearAgo = Date.now() - 365 * 86400000;
  const lastYear = wos.filter(w => parseDate(w.created_at).getTime() >= yearAgo);
  const cost12 = lastYear.reduce((s, w) => s + Number(lookup.summary[w.id]?.total_cost || 0), 0);
  const down12 = lastYear.reduce((s, w) => s + Number(w.downtime_hours || 0), 0);
  const repairs12 = lastYear.filter(w => ['Corrective', 'Emergency'].includes(w.type)).length;
  const open = wos.filter(isActive);
  const lockNote = asset.status === 'Out of Service' ? log.find(e => e.status === 'Out of Service')?.note : null;

  return (
    <>
      <PageHead back={mhe ? { to: '/mhe', label: 'MHE' } : { to: '/assets', label: 'Assets' }}
        eyebrow={cat?.name || 'Asset'}
        title={<><AssetTag asset={asset} link={false} size="lg" /> {asset.name}</>}
        sub={[asset.make, asset.model, locationPath(lookup.location[asset.location_id], lookup.location)].filter(Boolean).join(' · ')}
        actions={<>
          {mhe && asset.status !== 'Out of Service' && <a className="btn" href={href(`/mhe/${asset.id}/check`)}><Icon.Clipboard />Pre-use check</a>}
          {(mhe || asset.current_meter !== null) && <button className="btn" onClick={() => setModal('meter')}><Icon.Gauge />Record hours</button>}
          <button className="btn" onClick={() => setModal('status')}><Icon.Refresh />Change status</button>
          <a className="btn" href={href(`/labels?asset=${asset.id}`)}><Icon.Tag />QR label</a>
          <button className="btn btn-primary" onClick={() => newWorkOrder({ asset_id: asset.id, site_id: asset.site_id, location_id: asset.location_id || '' })}><Icon.Plus />Work order</button>
          <button className="icon-btn" aria-label="Edit asset" title="Edit asset" onClick={() => setModal('edit')}><Icon.Edit /></button>
        </>} />

      <div className="detail-head" style={{ marginTop: -8, marginBottom: 16 }}>
        <AssetStatusBadge status={asset.status} />
        <Badge tone="outline">Criticality: {asset.criticality}</Badge>
        {asset.mhe_type && <Badge tone="outline">{asset.mhe_type}</Badge>}
        {asset.ownership && <Badge tone="outline">{asset.ownership}</Badge>}
      </div>

      {asset.status === 'Out of Service' && (
        <div style={{ marginBottom: 16 }}><Lockout title="Out of service — do not operate">{lockNote || 'Locked out until repaired.'}</Lockout></div>
      )}

      <div className="tiles">
        <Tile label="Open work orders" value={open.length} tone={open.some(w => w.priority === 'Critical') ? 'danger' : null} />
        <Tile label="Repairs · 12 months" value={repairs12} />
        <Tile label="Maintenance cost · 12 months" value={fmtMoney(cost12)} />
        <Tile label="Downtime · 12 months" value={fmtNum(down12)} unit=" h" />
        {asset.current_meter !== null && <Tile label="Hour meter" value={fmtNum(asset.current_meter)} unit=" h" sub={asset.meter_updated_at ? `Read ${fmtDate(asset.meter_updated_at)}` : undefined} />}
      </div>

      <Tabs value={tab} onChange={setTab} items={[
        { value: 'overview', label: 'Overview' },
        { value: 'work', label: 'Work history', count: wos.length },
        { value: 'pm', label: 'PM schedules', count: schedules.length },
        ...(asset.mhe_type ? [{ value: 'checks', label: 'Pre-use checks', count: checks.length }] : []),
        { value: 'history', label: 'Status & hours' }
      ]} />

      {tab === 'overview' && (
        <div className="grid grid-2">
          <Card title="Details">
            <dl className="kv">
              <dt>Tag</dt><dd className="mono">{asset.code}</dd>
              <dt>Category</dt><dd>{cat?.name || '—'}</dd>
              <dt>Location</dt><dd>{locationPath(lookup.location[asset.location_id], lookup.location) || '—'}</dd>
              {d.sites.length > 1 && <><dt>Site</dt><dd>{lookup.site[asset.site_id]?.name}</dd></>}
              {asset.parent_id && <><dt>Part of</dt><dd><AssetTag asset={lookup.asset[asset.parent_id]} /> {lookup.asset[asset.parent_id]?.name}</dd></>}
              <dt>Make / model</dt><dd>{[asset.make, asset.model].filter(Boolean).join(' ') || '—'}</dd>
              <dt>Serial no.</dt><dd className="mono">{asset.serial_no || '—'}</dd>
              <dt>In service since</dt><dd>{fmtDate(asset.install_date)}</dd>
              <dt>Warranty</dt><dd>{asset.warranty_expiry ? <Badge tone={expiryInfo(asset.warranty_expiry, 60).tone}>{expiryInfo(asset.warranty_expiry, 60).label}</Badge> : '—'}</dd>
              <dt>Purchase cost</dt><dd>{fmtMoney(asset.purchase_cost)}</dd>
              <dt>Service contractor</dt><dd>{lookup.vendor[asset.vendor_id]?.name || '—'}</dd>
              {asset.notes && <><dt>Notes</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{asset.notes}</dd></>}
            </dl>
          </Card>
          <div className="stack">
            {asset.mhe_type && (
              <Card title="MHE specification">
                <MheArt type={asset.mhe_type} className={`spec-art ${asset.status === 'Out of Service' ? 'is-locked' : ''}`} />
                <dl className="kv">
                  <dt>Type</dt><dd>{asset.mhe_type}</dd>
                  <dt>Rated capacity</dt><dd>{asset.capacity_kg ? `${fmtNum(asset.capacity_kg)} kg` : '—'}</dd>
                  <dt>Max lift height</dt><dd>{asset.lift_height_mm ? `${fmtNum(asset.lift_height_mm)} mm` : '—'}</dd>
                  <dt>Power</dt><dd>{asset.power_type || '—'}</dd>
                  <dt>Battery / charger</dt><dd>{asset.battery_ref || '—'}</dd>
                  <dt>Ownership</dt><dd>{asset.ownership || '—'}</dd>
                  <dt>Hour meter</dt><dd><HourMeter value={asset.current_meter} /></dd>
                  <dt>Inspection certificate</dt><dd>{asset.cert_expiry ? <Badge tone={expiryInfo(asset.cert_expiry, 30).tone}>{expiryInfo(asset.cert_expiry, 30).label}</Badge> : '—'}</dd>
                </dl>
              </Card>
            )}
            {children.length > 0 && (
              <Card title="Components">
                <ul className="rows">{children.map(c => <li key={c.id}><AssetTag asset={c} /><span className="grow">{c.name}</span><AssetStatusBadge status={c.status} /></li>)}</ul>
              </Card>
            )}
            <Card title="Open work">
              {open.length === 0 ? <p className="mute" style={{ margin: 0 }}>No open work orders.</p> : (
                <ul className="rows">
                  {open.map(w => (
                    <li key={w.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/work-orders/${w.id}`)}>
                      <div className="grow"><div className="title">{w.title}</div><div className="sub"><WoCode code={w.code} /> · {w.type}</div></div>
                      <DueBadge wo={w} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            {isAdmin && (
              <div style={{ textAlign: 'right' }}>
                <ConfirmButton confirmLabel="Delete asset and its history" onConfirm={() => run(async () => {
                  await db.remove('assets', asset.id);
                  await refreshTables('assets', 'work_orders', 'pm_schedules');
                  navigate('/assets');
                }, `${asset.code} deleted.`)}><Icon.Trash />Delete asset</ConfirmButton>
                <div className="mute" style={{ fontSize: 12.5, marginTop: 6 }}>To keep the history, change the status to Decommissioned instead.</div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'work' && (
        <div className="card">
          <DataTable rows={wos} onRowClick={w => navigate(`/work-orders/${w.id}`)} initialSort={{ key: 'created', dir: 'desc' }} empty="No work recorded for this asset yet."
            columns={[
              { key: 'title', label: 'Work order', sort: w => w.code, render: w => <><div className="cell-title">{w.title}</div><div className="cell-sub"><WoCode code={w.code} /> · {w.type}</div></> },
              { key: 'priority', label: 'Priority', render: w => <PriorityBadge priority={w.priority} /> },
              { key: 'status', label: 'Status', sort: w => w.status, render: w => <StatusBadge status={w.status} /> },
              { key: 'created', label: 'Raised', sort: w => w.created_at, render: w => fmtDate(w.created_at) },
              { key: 'action', label: 'Action taken', render: w => <span className="dim">{w.action_taken || '—'}</span> },
              { key: 'cost', label: 'Cost', right: true, sort: w => Number(lookup.summary[w.id]?.total_cost || 0), render: w => fmtMoney(lookup.summary[w.id]?.total_cost || 0) }
            ]} />
        </div>
      )}

      {tab === 'pm' && (
        <Card title="Preventive maintenance" actions={<button className="btn btn-sm" onClick={() => setModal('pm')}><Icon.Plus />Add schedule</button>}>
          {schedules.length === 0 ? <p className="mute">No PM schedules for this asset yet.</p> : (
            <ul className="rows">
              {schedules.map(s => {
                const n = pmNextInfo(s, asset);
                return (
                  <li key={s.id}>
                    <div className="grow"><div className="title">{s.title}</div><div className="sub">{describeTrigger(s)} · <Person id={s.assigned_to} /> {s.active ? '' : '· paused'}</div></div>
                    <div style={{ textAlign: 'right' }}><div>{n.label}</div><Badge tone={n.tone === 'muted' ? 'plain' : n.tone}>{n.sub}</Badge></div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {tab === 'checks' && (
        <div className="card">
          <DataTable rows={checks} initialSort={{ key: 'when', dir: 'desc' }} empty="No pre-use checks in the last 60 days."
            onRowClick={c => c.work_order_id && navigate(`/work-orders/${c.work_order_id}`)}
            columns={[
              { key: 'when', label: 'When', sort: c => c.created_at, render: c => fmtDateTime(c.created_at) },
              { key: 'op', label: 'Operator', render: c => <>{c.operator_name || '—'}<div className="cell-sub">{c.shift}</div></> },
              { key: 'meter', label: 'Hours', right: true, render: c => c.meter_reading ?? '—' },
              { key: 'res', label: 'Result', render: c => c.critical_fail ? <Badge tone="danger" icon={Icon.Octagon}>Critical fail</Badge> : c.fail_count ? <Badge tone="warn" icon={Icon.Alert}>{c.fail_count} defect(s)</Badge> : <Badge tone="good" icon={Icon.Check}>Pass</Badge> },
              { key: 'defects', label: 'Defects', render: c => <span className="dim">{c.results.filter(r => r.result === 'Fail').map(r => r.text + (r.note ? ` — ${r.note}` : '')).join('; ') || '—'}</span> }
            ]} />
        </div>
      )}

      {tab === 'history' && <History asset={asset} log={log} />}

      {modal === 'edit' && <AssetForm asset={asset} onClose={() => setModal(null)} />}
      {modal === 'status' && <StatusModal asset={asset} onClose={() => setModal(null)} />}
      {modal === 'meter' && <MeterModal asset={asset} onClose={() => setModal(null)} />}
      {modal === 'pm' && <PmForm prefill={{ asset_id: asset.id, site_id: asset.site_id }} onClose={() => setModal(null)} />}
    </>
  );
}

function History({ asset, log }) {
  const [readings, setReadings] = useState(null);
  useEffect(() => {
    db.select('meter_readings', q => q.eq('asset_id', asset.id).order('recorded_at', { ascending: false }).limit(50)).then(setReadings).catch(() => setReadings([]));
  }, [asset.id, asset.current_meter]);
  return (
    <div className="grid grid-2">
      <Card title="Status history">
        <ul className="rows">
          {log.length === 0 && <li className="mute">No changes recorded.</li>}
          {log.map(e => (
            <li key={e.id}>
              <AssetStatusBadge status={e.status} />
              <div className="grow"><div>{e.note || <span className="mute">—</span>}</div><div className="sub">{fmtDateTime(e.changed_at)} · <Person id={e.changed_by} fallback="system" /></div></div>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Hour meter readings">
        {!readings ? <p className="mute">Loading…</p> : readings.length === 0 ? <p className="mute">No readings yet.</p> : (
          <ul className="rows">
            {readings.map(r => (
              <li key={r.id}><span className="num" style={{ fontWeight: 700, minWidth: 80 }}>{fmtNum(r.reading)} h</span><div className="grow"><div className="sub">{fmtDateTime(r.recorded_at)} · {r.source} · <Person id={r.recorded_by} fallback="—" /></div></div></li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StatusModal({ asset, onClose }) {
  const { refreshTables } = useData();
  const [run, busy] = useAction();
  const [status, setStatus] = useState(asset.status);
  const [note, setNote] = useState('');
  return (
    <FormModal title={`Change status of ${asset.code}`} onClose={onClose} busy={busy} submitLabel="Change status"
               onSubmit={() => run(async () => {
                 await db.rpc('set_asset_status', { p_asset: asset.id, p_status: status, p_note: note.trim() || null });
                 await refreshTables('assets', 'asset_status_log');
                 onClose();
               }, `${asset.code} is now ${status}.`)}>
      <div className="form-grid">
        <Field label="New status" span><select className="select" value={status} onChange={e => setStatus(e.target.value)}><Options values={ASSET_STATUSES} /></select></Field>
        <Field label="Reason" hint="Kept in the status history." span>
          <input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder={status === 'Out of Service' ? 'e.g. Brake failure — tagged out at MHE bay' : 'e.g. Repaired and tested'} />
        </Field>
      </div>
      {status === 'Out of Service' && <div className="form-note" style={{ marginTop: 14 }}>Operators will see the unit as locked out and can't start a pre-use check on it.</div>}
    </FormModal>
  );
}

function MeterModal({ asset, onClose }) {
  const { refreshTables } = useData();
  const [run, busy] = useAction();
  const [reading, setReading] = useState('');
  const [error, setError] = useState('');
  return (
    <FormModal title={`Record hours · ${asset.code}`} onClose={onClose} busy={busy} error={error} submitLabel="Save reading"
               onSubmit={() => {
                 if (asset.current_meter !== null && Number(reading) < Number(asset.current_meter)) { setError(`The reading can't be below the last one (${fmtNum(asset.current_meter)} h). If the meter was replaced, an admin can correct it by editing the asset.`); return; }
                 run(async () => {
                   await db.insert('meter_readings', { asset_id: asset.id, reading, source: 'Manual' });
                   await refreshTables('assets', 'meter_readings');
                   onClose();
                 }, 'Reading saved.');
               }}>
      <Field label="Hour meter reading" required hint={asset.current_meter !== null ? `Last reading: ${fmtNum(asset.current_meter)} h` : undefined}>
        <input className="input" type="number" min="0" step="0.1" required value={reading} onChange={e => setReading(e.target.value)} />
      </Field>
    </FormModal>
  );
}
