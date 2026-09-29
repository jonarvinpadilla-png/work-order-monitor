import { useMemo, useState } from 'react';
import { useData } from '../data/DataProvider';
import { db } from '../data/api';
import { AssetStatusBadge, AssetTag, Badge, Card, EmptyState, Field, HourMeter, Lockout, Options, PageHead, personName } from '../components/ui';
import { Icon } from '../lib/icons';
import { href } from '../lib/router';
import { SHIFTS } from '../lib/constants';
import { fmtNum, fmtTime } from '../lib/format';
import MheArt from '../illustrations/Mhe';

function defaultShift() {
  const h = new Date().getHours();
  return h >= 6 && h < 14 ? SHIFTS[0] : h >= 14 && h < 22 ? SHIFTS[1] : SHIFTS[2];
}

// Pre-use (pre-shift) inspection for one MHE unit. Built for a phone in the
// operator's hand: one question per row, big OK / Fail / N/A buttons, and no
// "mark all OK" shortcut on purpose.
export default function PreUseCheck({ assetId }) {
  const { lookup, templates, workOrders, me, refreshTables } = useData();
  const asset = lookup.asset[assetId];
  const matching = useMemo(() => templates.filter(t => t.active && asset && t.applies_to.includes(asset.mhe_type)), [templates, asset]);
  const [templateId, setTemplateId] = useState(() => matching[0]?.id || '');
  const template = lookup.template[templateId];
  const [answers, setAnswers] = useState({});
  const [meta, setMeta] = useState({ operator_name: personName(me) || '', shift: defaultShift(), meter_reading: '', remarks: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  if (!asset) return <EmptyState title="Unit not found" action={<a className="btn" href={href('/mhe')}>Back to MHE</a>} />;

  const items = template?.items || [];
  const answered = items.filter((_, i) => answers[i]?.result).length;
  const setAnswer = (i, patch) => setAnswers(a => ({ ...a, [i]: { ...a[i], ...patch } }));
  const tracksMeter = asset.mhe_type !== 'Manual Pallet Jack';

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (answered < items.length) { setError(`Answer every item — ${items.length - answered} left.`); return; }
    const missingNote = items.findIndex((_, i) => answers[i].result === 'Fail' && !answers[i].note?.trim());
    if (missingNote >= 0) { setError(`Describe the defect for “${items[missingNote].text}”.`); return; }
    if (meta.meter_reading && asset.current_meter && Number(meta.meter_reading) < Number(asset.current_meter)) {
      setError(`The hour meter can't be lower than the last reading (${fmtNum(asset.current_meter)} h). Check the reading.`);
      return;
    }
    setBusy(true);
    try {
      const saved = await db.insert('checklist_submissions', {
        asset_id: asset.id,
        template_id: template.id,
        template_name: template.name,
        operator_name: meta.operator_name.trim() || null,
        shift: meta.shift,
        meter_reading: meta.meter_reading === '' ? null : meta.meter_reading,
        remarks: meta.remarks.trim() || null,
        results: items.map((it, i) => ({ text: it.text, critical: !!it.critical, result: answers[i].result, note: answers[i].note?.trim() || undefined }))
      });
      setResult(saved);
      window.scrollTo(0, 0);
      refreshTables('checklist_submissions', 'assets', 'work_orders', 'asset_status_log');
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  if (result) {
    const wo = workOrders.find(w => w.id === result.work_order_id);
    return (
      <>
        <PageHead back={{ to: '/mhe', label: 'MHE' }} eyebrow="Pre-use check" title={`${asset.code} · ${asset.mhe_type}`}
                  actions={<MheArt type={asset.mhe_type} className={`head-art ${result.critical_fail ? 'is-locked' : ''}`} />} />
        {result.critical_fail ? (
          <div className="stack">
            <Lockout title={`${asset.code}: do not operate`}>
              A critical item failed, so this unit is now locked out. Park it safely, remove the key, and tell your supervisor.
            </Lockout>
            <Card><p style={{ margin: 0 }}>Maintenance has a work order{wo ? <> — <b className="mono">{wo.code}</b></> : ''}. The unit returns to service when a technician closes it.</p></Card>
          </div>
        ) : (
          <div className="card result-panel">
            {result.fail_count === 0
              ? <><Icon.CheckCircle className="huge" style={{ color: 'var(--good)' }} /><div className="big" style={{ color: 'var(--good)' }}>Cleared for use</div>
                  <p className="dim">{asset.code} passed all {items.length} checks at {fmtTime(result.created_at)}.</p></>
              : <><Icon.Alert className="huge" style={{ color: 'var(--warn)' }} /><div className="big" style={{ color: 'var(--warn)' }}>Defect reported</div>
                  <p className="dim">No critical item failed, so the unit can be used with care. Maintenance has a work order{wo ? ` (${wo.code})` : ''} to fix {result.fail_count === 1 ? 'the defect' : `the ${result.fail_count} defects`}.</p></>}
          </div>
        )}
        <div className="page-actions" style={{ marginTop: 16 }}>
          <a className="btn btn-primary" href={href('/mhe')}>Check another unit</a>
          {result.work_order_id && <a className="btn" href={href(`/work-orders/${result.work_order_id}`)}>View work order</a>}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead back={{ to: '/mhe', label: 'MHE' }} eyebrow="Pre-use check" title={<><AssetTag asset={asset} link={false} size="lg" /> {asset.mhe_type}</>}
                sub={[asset.make, asset.model, lookup.location[asset.location_id]?.name].filter(Boolean).join(' · ')}
                actions={<MheArt type={asset.mhe_type} className={`head-art ${asset.status === 'Out of Service' ? 'is-locked' : ''}`} />} />

      {asset.status === 'Out of Service' ? (
        <Lockout title={`${asset.code} is locked out`}>
          This unit failed a critical check or is under repair. Do not use it. A technician returns it to service after the repair.
        </Lockout>
      ) : !template ? (
        <div className="card">
          <EmptyState title="No checklist for this type">
            There is no active pre-use checklist for <b>{asset.mhe_type}</b>. An admin can add one under Settings → Checklists.
          </EmptyState>
        </div>
      ) : (
        <form onSubmit={submit} className="stack">
          {asset.status === 'Needs Attention' && <div className="form-note">This unit has an open defect report. Check it carefully.</div>}
          <Card>
            <div className="form-grid">
              <Field label="Operator" required>
                <input className="input" required value={meta.operator_name} onChange={e => setMeta(m => ({ ...m, operator_name: e.target.value }))} />
              </Field>
              <Field label="Shift">
                <select className="select" value={meta.shift} onChange={e => setMeta(m => ({ ...m, shift: e.target.value }))}><Options values={SHIFTS} /></select>
              </Field>
              {tracksMeter && (
                <Field label="Hour meter reading" hint={asset.current_meter ? <>Last reading <HourMeter value={asset.current_meter} /></> : 'Read it off the dashboard'}>
                  <input className="input" type="number" inputMode="decimal" min="0" step="0.1" value={meta.meter_reading} onChange={e => setMeta(m => ({ ...m, meter_reading: e.target.value }))} />
                </Field>
              )}
              {matching.length > 1 && (
                <Field label="Checklist">
                  <select className="select" value={templateId} onChange={e => { setTemplateId(e.target.value); setAnswers({}); }}>
                    {matching.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </Field>
              )}
            </div>
          </Card>

          <Card title={`${template.name} · ${answered}/${items.length}`}>
            {template.description && <p className="dim" style={{ marginTop: 0 }}>{template.description}</p>}
            <ol className="check-items">
              {items.map((it, i) => {
                const a = answers[i] || {};
                return (
                  <li key={i} className="check-item">
                    <div className="check-item-row">
                      <div className="check-item-text">
                        {it.text}
                        {it.critical && <span className="crit"><Badge tone="danger">Critical</Badge></span>}
                      </div>
                      <span className="tri" role="group" aria-label={it.text}>
                        <button type="button" className={a.result === 'OK' ? 'on ok' : ''} aria-pressed={a.result === 'OK'} onClick={() => setAnswer(i, { result: 'OK' })}>OK</button>
                        <button type="button" className={a.result === 'Fail' ? 'on fail' : ''} aria-pressed={a.result === 'Fail'} onClick={() => setAnswer(i, { result: 'Fail' })}>Fail</button>
                        <button type="button" className={a.result === 'N/A' ? 'on na' : ''} aria-pressed={a.result === 'N/A'} onClick={() => setAnswer(i, { result: 'N/A' })}>N/A</button>
                      </span>
                    </div>
                    {a.result === 'Fail' && (
                      <input className="input" autoFocus value={a.note || ''} onChange={e => setAnswer(i, { note: e.target.value })}
                             placeholder={it.critical ? 'What is wrong? The unit will be locked out.' : 'What is wrong?'} aria-label={`Defect for ${it.text}`} />
                    )}
                  </li>
                );
              })}
            </ol>
            <Field label="Other remarks">
              <input className="input" value={meta.remarks} onChange={e => setMeta(m => ({ ...m, remarks: e.target.value }))} placeholder="Optional" />
            </Field>
          </Card>

          {error && <div className="form-error">{error}</div>}
          <div className="page-actions">
            <button className="btn btn-primary" disabled={busy} style={{ minHeight: 48, padding: '0 22px', fontSize: 16 }}>
              {busy ? 'Submitting…' : 'Submit check'}
            </button>
            <span className="mute" style={{ fontSize: 13.5 }}>Status now: <AssetStatusBadge status={asset.status} /></span>
          </div>
        </form>
      )}
    </>
  );
}
