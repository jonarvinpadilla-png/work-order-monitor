import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../data/DataProvider';
import { db } from '../data/api';
import { useAction, useToast } from '../components/Toast';
import { useGlobalActions } from '../components/GlobalActions';
import {
  AssetStatusBadge, AssetTag, Avatar, Badge, Card, Combobox, ConfirmButton, DueBadge, EmptyState, Field, FormModal,
  Loading, Lockout, Options, PageHead, Person, PersonSelect, PriorityBadge, StatusBadge, personName
} from '../components/ui';
import { Icon } from '../lib/icons';
import { href, navigate } from '../lib/router';
import { FAILURE_CAUSES, PRIORITIES, WO_TYPES } from '../lib/constants';
import { isActive, isMheUnit, locationPath } from '../lib/domain';
import { fmtAgo, fmtDate, fmtDateTime, fmtMoney, fmtNum, parseDate, todayStr } from '../lib/format';

export default function WorkOrderDetail({ id }) {
  const d = useData();
  const { lookup, isStaff, isAdmin, subscribe, refreshTables, settings } = d;
  const { editWorkOrder } = useGlobalActions();
  const toast = useToast();
  const [run, busy] = useAction();
  const wo = d.workOrders.find(w => w.id === id);
  const [detail, setDetail] = useState(null);
  const [modal, setModal] = useState(null); // hold | complete | approve | reject
  const timer = useRef(null);

  const load = useCallback(async () => {
    const [tasks, labor, parts, activity] = await Promise.all([
      db.select('wo_tasks', q => q.eq('work_order_id', id).order('seq').order('id')),
      isStaff ? db.select('wo_labor', q => q.eq('work_order_id', id).order('work_date').order('created_at')) : [],
      isStaff ? db.select('part_transactions', q => q.eq('work_order_id', id).order('created_at')) : [],
      db.select('wo_activity', q => q.eq('work_order_id', id).order('created_at').order('id'))
    ]);
    setDetail({ tasks, labor, parts, activity });
  }, [id, isStaff]);

  useEffect(() => {
    load().catch(e => toast(e.message, 'error'));
    return subscribe(table => {
      if (!['wo_tasks', 'wo_labor', 'part_transactions', 'wo_activity', 'work_orders'].includes(table)) return;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => load().catch(() => {}), 250);
    });
  }, [load, subscribe, toast]);

  const after = async (...tables) => { await Promise.all([load(), refreshTables('work_orders', ...tables)]); };

  if (!wo) {
    return d.loading ? <Loading /> : (
      <EmptyState title="Work order not found" action={<a className="btn" href={href(isStaff ? '/work-orders' : '/')}>Back</a>}>
        It may have been deleted, or it belongs to someone else.
      </EmptyState>
    );
  }

  const asset = lookup.asset[wo.asset_id];
  const loc = lookup.location[wo.location_id];
  const summary = lookup.summary[wo.id];
  const canWork = isStaff && isActive(wo);
  const setStatus = (status, extra = {}, msg) => run(async () => { await db.update('work_orders', wo.id, { status, ...extra }); await after(); }, msg);
  const pendingTasks = detail ? detail.tasks.filter(t => !t.result).length : 0;

  const actions = [];
  if (isStaff) {
    if (wo.status === 'Requested') {
      if (isAdmin) {
        actions.push(<button key="rej" className="btn btn-danger" onClick={() => setModal('reject')}><Icon.X />Reject</button>);
        actions.push(<button key="app" className="btn btn-primary" onClick={() => setModal('approve')}><Icon.Check />Approve</button>);
      }
    } else if (wo.status === 'Open') {
      actions.push(<button key="start" className="btn btn-dark" disabled={busy} onClick={() => setStatus('In Progress', {}, 'Work started.')}><Icon.Play />Start work</button>);
    } else if (wo.status === 'On Hold') {
      actions.push(<button key="resume" className="btn btn-dark" disabled={busy} onClick={() => setStatus('In Progress', {}, 'Work resumed.')}><Icon.Play />Resume</button>);
    }
    if (wo.status === 'Open' || wo.status === 'In Progress') actions.push(<button key="hold" className="btn" onClick={() => setModal('hold')}><Icon.Pause />Put on hold</button>);
    if (isActive(wo)) actions.push(<button key="done" className="btn btn-primary" onClick={() => setModal('complete')}><Icon.Check />Complete</button>);
    if (['Completed', 'Cancelled', 'Rejected'].includes(wo.status)) actions.push(<button key="reopen" className="btn" disabled={busy} onClick={() => setStatus('Open', {}, 'Work order reopened.')}><Icon.Undo />Reopen</button>);
  }

  return (
    <>
      <div className="print-only" style={{ marginBottom: 12 }}>
        <b>{settings.org_name}</b> — Job card
      </div>
      <PageHead
        back={{ to: isStaff ? '/work-orders' : '/', label: isStaff ? 'Work orders' : 'My requests' }}
        eyebrow={<><span className="mono">{wo.code}</span> · {wo.type}</>}
        title={wo.title}
        actions={<>
          {actions}
          {isStaff && <button className="icon-btn" title="Edit" aria-label="Edit" onClick={() => editWorkOrder(wo)}><Icon.Edit /></button>}
          <button className="icon-btn" title="Print job card" aria-label="Print job card" onClick={() => window.print()}><Icon.Printer /></button>
        </>} />

      <div className="detail-head" style={{ marginTop: -8, marginBottom: 16 }}>
        <StatusBadge status={wo.status} />
        <PriorityBadge priority={wo.priority} />
        <DueBadge wo={wo} />
        {wo.asset_down && isActive(wo) && <Badge tone="danger" icon={Icon.Zap}>Equipment down</Badge>}
        {wo.status === 'Requested' && !isAdmin && <span className="mute" style={{ fontSize: 13.5 }}>An admin will review this request.</span>}
      </div>

      {asset?.status === 'Out of Service' && (
        <div style={{ marginBottom: 16 }}>
          <Lockout title={`${asset.code} is out of service`}>Do not operate until this work order is completed and the unit is returned to service.</Lockout>
        </div>
      )}

      <div className="split">
        <div className="stack">
          <Card title="What needs doing">
            {wo.description ? <p className="desc-text">{wo.description}</p> : <p className="mute">No description.</p>}
            {wo.status === 'On Hold' && wo.hold_reason && <div className="form-note" style={{ marginTop: 12 }}><b>On hold:</b> {wo.hold_reason}</div>}
            {wo.status === 'Rejected' && wo.reject_reason && <div className="form-error" style={{ marginTop: 12 }}><b>Rejected:</b> {wo.reject_reason}</div>}
          </Card>

          {!detail ? <Loading /> : (
            <>
              <Tasks wo={wo} tasks={detail.tasks} canEdit={canWork} after={after} />
              {isStaff && <Labour wo={wo} labor={detail.labor} canEdit={isStaff && wo.status !== 'Requested'} after={after} />}
              {isStaff && <PartsUsed wo={wo} txns={detail.parts} canEdit={isStaff && wo.status !== 'Requested'} after={after} />}
              <Activity wo={wo} activity={detail.activity} after={after} />
            </>
          )}
        </div>

        <div className="stack">
          <Card title="Details">
            <dl className="kv">
              <dt>Asset</dt>
              <dd>{asset ? <div style={{ display: 'grid', gap: 4 }}><span><AssetTag asset={asset} link={isStaff} /> {asset.name}</span><span><AssetStatusBadge status={asset.status} /></span></div> : <span className="mute">None</span>}</dd>
              <dt>Location</dt><dd>{loc ? locationPath(loc, lookup.location) : <span className="mute">—</span>}</dd>
              {d.sites.length > 1 && <><dt>Site</dt><dd>{lookup.site[wo.site_id]?.name || '—'}</dd></>}
              <dt>Assigned to</dt>
              <dd>{isStaff && isActive(wo)
                ? <PersonSelect value={wo.assigned_to} onChange={v => run(async () => { await db.update('work_orders', wo.id, { assigned_to: v || null }); await after(); }, 'Assignment updated.')} />
                : <Person id={wo.assigned_to} />}</dd>
              {wo.vendor_id && <><dt>Contractor</dt><dd>{lookup.vendor[wo.vendor_id]?.name}</dd></>}
              <dt>Due</dt><dd>{wo.due_date ? fmtDate(wo.due_date) : <span className="mute">—</span>}</dd>
              <dt>Requested by</dt><dd>{personName(lookup.profile[wo.requested_by]) || wo.requester_name || <span className="mute">—</span>}{wo.requester_name && wo.requested_by ? <div className="mute" style={{ fontSize: 12.5 }}>for {wo.requester_name}</div> : null}</dd>
              <dt>Raised</dt><dd>{fmtDateTime(wo.created_at)}</dd>
              {wo.approved_at && <><dt>{wo.status === 'Rejected' ? 'Rejected' : 'Approved'}</dt><dd>{fmtDate(wo.approved_at)} by <Person id={wo.approved_by} fallback="—" /></dd></>}
              {wo.started_at && <><dt>Started</dt><dd>{fmtDateTime(wo.started_at)}</dd></>}
              {wo.completed_at && <><dt>Completed</dt><dd>{fmtDateTime(wo.completed_at)}</dd></>}
              {wo.pm_schedule_id && <><dt>PM schedule</dt><dd><a href={href('/pm')}>{lookup.pm[wo.pm_schedule_id]?.title || 'View schedules'}</a></dd></>}
              {wo.estimated_hours && <><dt>Estimate</dt><dd>{fmtNum(wo.estimated_hours)} h</dd></>}
            </dl>
          </Card>

          {wo.status === 'Completed' && (
            <Card title="Close-out">
              <dl className="kv">
                <dt>Action taken</dt><dd>{wo.action_taken || '—'}</dd>
                {wo.failure_cause && <><dt>Cause</dt><dd>{wo.failure_cause}</dd></>}
                {wo.downtime_hours !== null && <><dt>Downtime</dt><dd>{fmtNum(wo.downtime_hours)} h</dd></>}
                {wo.meter_at_completion !== null && <><dt>Hour meter</dt><dd>{fmtNum(wo.meter_at_completion)} h</dd></>}
              </dl>
            </Card>
          )}

          {isStaff && summary && (
            <Card title="Cost">
              <dl className="kv">
                <dt>Labour</dt><dd className="num">{fmtNum(summary.labor_hours)} h · {fmtMoney(summary.labor_cost)}</dd>
                <dt>Parts</dt><dd className="num">{fmtMoney(summary.parts_cost)}</dd>
                <dt>Contractor</dt><dd className="num">{fmtMoney(summary.external_cost)}</dd>
              </dl>
              <div className="totals"><span>Total</span><span className="num">{fmtMoney(summary.total_cost)}</span></div>
            </Card>
          )}

          {isAdmin && (
            <div className="no-print" style={{ textAlign: 'right' }}>
              <ConfirmButton confirmLabel="Delete permanently" onConfirm={() => run(async () => {
                await db.remove('work_orders', wo.id);
                await refreshTables('work_orders');
                navigate('/work-orders');
              }, `${wo.code} deleted.`)}><Icon.Trash />Delete work order</ConfirmButton>
            </div>
          )}
        </div>
      </div>

      {modal === 'hold' && <HoldModal wo={wo} onClose={() => setModal(null)} after={after} />}
      {modal === 'complete' && <CompleteModal wo={wo} asset={asset} pendingTasks={pendingTasks} onClose={() => setModal(null)} after={after} />}
      {modal === 'approve' && <ApproveModal wo={wo} onClose={() => setModal(null)} after={after} />}
      {modal === 'reject' && <RejectModal wo={wo} onClose={() => setModal(null)} after={after} />}
    </>
  );
}

// ------------------------------------------------------------------- tasks
function Tasks({ wo, tasks, canEdit, after }) {
  const [run] = useAction();
  const [text, setText] = useState('');
  const done = tasks.filter(t => t.result).length;
  const setResult = (t, result) => run(async () => { await db.update('wo_tasks', t.id, { result: t.result === result ? null : result }); await after('wo_tasks'); });
  const add = e => {
    e.preventDefault();
    if (!text.trim()) return;
    run(async () => {
      await db.insert('wo_tasks', { work_order_id: wo.id, seq: (tasks.at(-1)?.seq || 0) + 1, description: text.trim() });
      setText('');
      await after('wo_tasks');
    });
  };
  if (!tasks.length && !canEdit) return null;
  return (
    <Card title={`Tasks${tasks.length ? ` · ${done}/${tasks.length}` : ''}`}>
      {tasks.length > 0 && <div className="progress"><div style={{ width: `${(done / tasks.length) * 100}%` }} /></div>}
      <ul className="task-list">
        {tasks.map(t => (
          <li key={t.id} className="task">
            <span className={`desc ${t.result ? 'done' : ''}`}>
              {t.description}
              {t.note && <div className="who">{t.note}</div>}
              {t.done_at && <div className="who">{t.result} · <Person id={t.done_by} fallback="" /> · {fmtAgo(t.done_at)}</div>}
            </span>
            {canEdit ? (
              <>
                <span className="tri" role="group" aria-label={`Result for ${t.description}`}>
                  <button type="button" className={t.result === 'OK' ? 'on ok' : ''} aria-pressed={t.result === 'OK'} onClick={() => setResult(t, 'OK')}>OK</button>
                  <button type="button" className={t.result === 'Fail' ? 'on fail' : ''} aria-pressed={t.result === 'Fail'} onClick={() => setResult(t, 'Fail')}>Fail</button>
                  <button type="button" className={t.result === 'N/A' ? 'on na' : ''} aria-pressed={t.result === 'N/A'} onClick={() => setResult(t, 'N/A')}>N/A</button>
                </span>
                <button className="icon-btn no-print" aria-label="Remove task" onClick={() => run(async () => { await db.remove('wo_tasks', t.id); await after('wo_tasks'); })}><Icon.X /></button>
              </>
            ) : t.result && <Badge tone={t.result === 'OK' ? 'good' : t.result === 'Fail' ? 'danger' : 'muted'}>{t.result}</Badge>}
          </li>
        ))}
      </ul>
      {canEdit && (
        <form className="inline-form no-print" onSubmit={add} style={{ marginTop: 10 }}>
          <input className="input" style={{ flex: 1 }} value={text} onChange={e => setText(e.target.value)} placeholder="Add a task" aria-label="New task" />
          <button className="btn"><Icon.Plus />Add</button>
        </form>
      )}
    </Card>
  );
}

// ------------------------------------------------------------------ labour
function Labour({ wo, labor, canEdit, after }) {
  const { me } = useData();
  const [run, busy] = useAction();
  const [form, setForm] = useState({ technician_id: me.id, work_date: todayStr(), hours: '', notes: '' });
  const total = labor.reduce((s, l) => s + Number(l.hours), 0);
  const cost = labor.reduce((s, l) => s + Number(l.hours) * Number(l.rate || 0), 0);
  const add = e => {
    e.preventDefault();
    if (!(Number(form.hours) > 0)) return;
    run(async () => {
      await db.insert('wo_labor', { work_order_id: wo.id, technician_id: form.technician_id || null, work_date: form.work_date, hours: form.hours, notes: form.notes || null });
      setForm(f => ({ ...f, hours: '', notes: '' }));
      await after('wo_labor');
    }, 'Time logged.');
  };
  return (
    <Card title="Labour">
      {labor.length === 0 ? <p className="mute" style={{ marginTop: 0 }}>No time logged yet.</p> : (
        <table className="table">
          <thead><tr><th>Date</th><th>Technician</th><th>Notes</th><th className="right">Hours</th><th className="right">Cost</th>{canEdit && <th />}</tr></thead>
          <tbody>
            {labor.map(l => (
              <tr key={l.id}>
                <td className="nowrap">{fmtDate(l.work_date)}</td>
                <td><Person id={l.technician_id} fallback="—" /></td>
                <td className="dim">{l.notes}</td>
                <td className="right num">{fmtNum(l.hours)}</td>
                <td className="right num">{fmtMoney(Number(l.hours) * Number(l.rate || 0))}</td>
                {canEdit && <td className="right"><button className="icon-btn" aria-label="Remove entry" onClick={() => run(async () => { await db.remove('wo_labor', l.id); await after('wo_labor'); })}><Icon.X /></button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {labor.length > 0 && <div className="totals"><span>{fmtNum(total)} hours</span><span className="num">{fmtMoney(cost)}</span></div>}
      {canEdit && (
        <form className="inline-form no-print" onSubmit={add} style={{ marginTop: 12 }}>
          <Field label="Technician"><PersonSelect value={form.technician_id} onChange={v => setForm(f => ({ ...f, technician_id: v }))} emptyLabel="—" /></Field>
          <Field label="Date"><input className="input" type="date" value={form.work_date} onChange={e => setForm(f => ({ ...f, work_date: e.target.value }))} /></Field>
          <Field label="Hours"><input className="input" type="number" min="0.25" max="24" step="0.25" value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} required /></Field>
          <Field label="Notes"><input className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></Field>
          <button className="btn" disabled={busy}><Icon.Plus />Log time</button>
        </form>
      )}
    </Card>
  );
}

// ------------------------------------------------------------------- parts
function PartsUsed({ wo, txns, canEdit, after }) {
  const { parts, lookup } = useData();
  const [run, busy] = useAction();
  const [partId, setPartId] = useState('');
  const [qty, setQty] = useState('1');
  const lines = useMemo(() => {
    const m = {};
    for (const t of txns) {
      if (t.kind !== 'Issue' && t.kind !== 'Return') continue;
      const l = (m[t.part_id] ||= { part_id: t.part_id, qty: 0, cost: 0 });
      l.qty += -Number(t.qty);
      l.cost += -Number(t.qty) * Number(t.unit_cost || 0);
    }
    return Object.values(m).filter(l => l.qty > 0);
  }, [txns]);
  const options = parts.filter(p => p.active).map(p => ({
    value: p.id, label: `${p.part_no} — ${p.name}`, name: p.name,
    tag: <span className="tag part">{p.part_no}</span>,
    sub: `${fmtNum(p.qty_on_hand)} ${p.unit} in stock`
  }));
  const issue = e => {
    e.preventDefault();
    if (!partId || !(Number(qty) > 0)) return;
    run(async () => {
      await db.insert('part_transactions', { part_id: partId, kind: 'Issue', qty: Number(qty), work_order_id: wo.id });
      setPartId(''); setQty('1');
      await after('part_transactions');
    }, 'Part issued from stock.');
  };
  const returnPart = l => run(async () => {
    await db.insert('part_transactions', { part_id: l.part_id, kind: 'Return', qty: 1, work_order_id: wo.id, notes: 'Returned unused' });
    await after('part_transactions');
  }, `Returned 1 ${lookup.part[l.part_id]?.unit || ''} to stock.`);
  const total = lines.reduce((s, l) => s + l.cost, 0);
  return (
    <Card title="Parts used">
      {lines.length === 0 ? <p className="mute" style={{ marginTop: 0 }}>No parts issued to this job.</p> : (
        <table className="table">
          <thead><tr><th>Part</th><th className="right">Qty</th><th className="right">Cost</th>{canEdit && <th />}</tr></thead>
          <tbody>
            {lines.map(l => {
              const p = lookup.part[l.part_id];
              return (
                <tr key={l.part_id}>
                  <td><span className="tag part">{p?.part_no}</span> {p?.name}</td>
                  <td className="right num nowrap">{fmtNum(l.qty)} {p?.unit}</td>
                  <td className="right num">{fmtMoney(l.cost)}</td>
                  {canEdit && <td className="right"><button className="btn btn-sm btn-quiet" onClick={() => returnPart(l)} title="Return one unit to stock"><Icon.Undo />Return 1</button></td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {lines.length > 0 && <div className="totals"><span>Parts total</span><span className="num">{fmtMoney(total)}</span></div>}
      {canEdit && (
        <form className="inline-form no-print" onSubmit={issue} style={{ marginTop: 12 }}>
          <Field label="Part"><Combobox options={options} value={partId} onChange={setPartId} placeholder="Search part number or name" /></Field>
          <Field label="Quantity"><input className="input" type="number" min="0.01" step="any" value={qty} onChange={e => setQty(e.target.value)} style={{ maxWidth: 110 }} /></Field>
          <button className="btn" disabled={busy || !partId}><Icon.Package />Issue from stock</button>
        </form>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- activity
function Activity({ wo, activity, after }) {
  const { lookup } = useData();
  const [run, busy] = useAction();
  const [text, setText] = useState('');
  const post = e => {
    e.preventDefault();
    if (!text.trim()) return;
    run(async () => {
      await db.insert('wo_activity', { work_order_id: wo.id, kind: 'comment', body: text.trim() });
      setText('');
      await after();
    });
  };
  return (
    <Card title="Activity">
      <ul className="feed">
        {activity.map(a => {
          const who = personName(lookup.profile[a.author_id]);
          return (
            <li key={a.id}>
              <Avatar name={who} system={!who} />
              <div style={{ minWidth: 0 }}>
                <div className={a.kind === 'comment' ? '' : 'sys'}>
                  {a.kind === 'comment' ? <><b>{who || 'Someone'}</b> {a.body}</> : <>{a.body}{who ? <> · <span className="mute">{who}</span></> : null}</>}
                </div>
                <div className="when" title={fmtDateTime(a.created_at)}>{fmtAgo(a.created_at)}</div>
              </div>
            </li>
          );
        })}
      </ul>
      <form className="inline-form no-print" onSubmit={post} style={{ marginTop: 10 }}>
        <input className="input" style={{ flex: 1 }} value={text} onChange={e => setText(e.target.value)} placeholder="Add a comment or update" aria-label="Comment" />
        <button className="btn" disabled={busy}><Icon.Message />Post</button>
      </form>
    </Card>
  );
}

// ------------------------------------------------------------------ modals
function HoldModal({ wo, onClose, after }) {
  const [reason, setReason] = useState('');
  const [run, busy] = useAction();
  return (
    <FormModal title="Put on hold" onClose={onClose} busy={busy} submitLabel="Put on hold"
               onSubmit={() => run(async () => { await db.update('work_orders', wo.id, { status: 'On Hold', hold_reason: reason.trim() || null }); await after(); onClose(); }, 'Work order on hold.')}>
      <Field label="Why is it on hold?" hint="Shown on the work order, e.g. waiting for parts, contractor or a shutdown window.">
        <input className="input" value={reason} onChange={e => setReason(e.target.value)} required placeholder="Waiting for parts from supplier" />
      </Field>
    </FormModal>
  );
}

function localDateTime(d = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CompleteModal({ wo, asset, pendingTasks, onClose, after }) {
  const { refreshTables } = useData();
  const [run, busy] = useAction();
  const reactive = ['Corrective', 'Emergency', 'Safety'].includes(wo.type);
  const tracksMeter = asset && (isMheUnit(asset) || asset.current_meter !== null);
  const [f, setF] = useState({
    action_taken: '',
    failure_cause: '',
    downtime_hours: wo.asset_down ? Math.round(((Date.now() - parseDate(wo.created_at)) / 3600000) * 10) / 10 : '',
    meter: '',
    completed_at: localDateTime(),
    returnToService: asset ? asset.status !== 'Operational' && asset.status !== 'Decommissioned' : false
  });
  const [error, setError] = useState('');
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const submit = () => {
    if (!f.action_taken.trim()) { setError('Describe what was done — it becomes the asset history.'); return; }
    if (f.meter && asset?.current_meter && Number(f.meter) < Number(asset.current_meter)) { setError(`Hour meter can't be below the last reading (${fmtNum(asset.current_meter)} h).`); return; }
    run(async () => {
      await db.update('work_orders', wo.id, {
        status: 'Completed',
        action_taken: f.action_taken.trim(),
        failure_cause: f.failure_cause || null,
        downtime_hours: f.downtime_hours === '' ? null : f.downtime_hours,
        meter_at_completion: f.meter === '' ? null : f.meter,
        completed_at: new Date(f.completed_at).toISOString()
      });
      if (f.returnToService && asset) {
        await db.rpc('set_asset_status', { p_asset: asset.id, p_status: 'Operational', p_note: `Returned to service on completion of ${wo.code}` });
      }
      await after('assets', 'asset_status_log', 'pm_schedules');
      refreshTables('assets');
      onClose();
    }, `${wo.code} completed.`);
  };
  return (
    <FormModal title={`Complete ${wo.code}`} onClose={onClose} onSubmit={submit} busy={busy} error={error} submitLabel="Complete work order">
      {pendingTasks > 0 && <div className="form-note" style={{ marginBottom: 14 }}>{pendingTasks} {pendingTasks === 1 ? 'task is' : 'tasks are'} not marked yet. You can still complete the job.</div>}
      <div className="form-grid">
        <Field label="What was done" required span>
          <textarea className="textarea" value={f.action_taken} onChange={e => set('action_taken', e.target.value)} placeholder="e.g. Replaced lip cylinder seal kit, bled hydraulics, tested 10 cycles." />
        </Field>
        {reactive && (
          <Field label="Cause">
            <select className="select" value={f.failure_cause} onChange={e => set('failure_cause', e.target.value)}><Options values={FAILURE_CAUSES} empty="— Select —" /></select>
          </Field>
        )}
        <Field label="Downtime (hours)" hint="How long the equipment couldn't be used.">
          <input className="input" type="number" min="0" step="0.1" value={f.downtime_hours} onChange={e => set('downtime_hours', e.target.value)} />
        </Field>
        {tracksMeter && (
          <Field label="Hour meter reading" hint={asset.current_meter ? `Last reading ${fmtNum(asset.current_meter)} h` : 'Optional'}>
            <input className="input" type="number" min="0" step="0.1" value={f.meter} onChange={e => set('meter', e.target.value)} />
          </Field>
        )}
        <Field label="Completed at">
          <input className="input" type="datetime-local" value={f.completed_at} onChange={e => set('completed_at', e.target.value)} />
        </Field>
        {asset && asset.status !== 'Operational' && asset.status !== 'Decommissioned' && (
          <label className="check span-2">
            <input type="checkbox" checked={f.returnToService} onChange={e => set('returnToService', e.target.checked)} />
            <span>Return <b>{asset.code}</b> to service (currently <i>{asset.status}</i>)</span>
          </label>
        )}
      </div>
    </FormModal>
  );
}

function ApproveModal({ wo, onClose, after }) {
  const [run, busy] = useAction();
  const [f, setF] = useState({ assigned_to: wo.assigned_to || '', priority: wo.priority, type: wo.type, due_date: wo.due_date || '' });
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  return (
    <FormModal title={`Approve ${wo.code}`} onClose={onClose} busy={busy} submitLabel="Approve and open work order"
               onSubmit={() => run(async () => {
                 await db.update('work_orders', wo.id, { status: 'Open', assigned_to: f.assigned_to || null, priority: f.priority, type: f.type, due_date: f.due_date || null });
                 await after();
                 onClose();
               }, `${wo.code} approved.`)}>
      <div className="form-grid">
        <Field label="Assign to"><PersonSelect value={f.assigned_to} onChange={v => set('assigned_to', v)} /></Field>
        <Field label="Due date"><input className="input" type="date" value={f.due_date} onChange={e => set('due_date', e.target.value)} /></Field>
        <Field label="Priority"><select className="select" value={f.priority} onChange={e => set('priority', e.target.value)}><Options values={PRIORITIES} /></select></Field>
        <Field label="Type"><select className="select" value={f.type} onChange={e => set('type', e.target.value)}><Options values={WO_TYPES} /></select></Field>
      </div>
    </FormModal>
  );
}

function RejectModal({ wo, onClose, after }) {
  const [run, busy] = useAction();
  const [reason, setReason] = useState('');
  return (
    <FormModal title={`Reject ${wo.code}`} onClose={onClose} busy={busy} submitLabel="Reject request"
               onSubmit={() => run(async () => {
                 await db.update('work_orders', wo.id, { status: 'Rejected', reject_reason: reason.trim() || null });
                 await after();
                 onClose();
               }, `${wo.code} rejected.`)}>
      <Field label="Reason" hint="The requester sees this.">
        <input className="input" value={reason} onChange={e => setReason(e.target.value)} required placeholder="e.g. Duplicate of WO-2609-0012" />
      </Field>
    </FormModal>
  );
}
