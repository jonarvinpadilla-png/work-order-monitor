import { useState } from 'react';
import { useData } from '../data/DataProvider';
import { db } from '../data/api';
import { useToast } from '../components/Toast';
import { AssetPicker, ConfirmButton, Field, FormModal, LocationSelect, Options, PersonSelect, Segmented, SiteSelect, VendorSelect } from '../components/ui';
import { INTERVAL_UNITS, PM_TYPES, PRIORITIES } from '../lib/constants';
import { addDays, fmtNum, todayStr } from '../lib/format';

export default function PmForm({ schedule, prefill = {}, onClose }) {
  const { sites, siteId, lookup, isAdmin, refreshTables } = useData();
  const toast = useToast();
  const editing = !!schedule;
  const [f, setF] = useState(() => {
    const init = {
    title: '', instructions: '', asset_id: '', location_id: '', site_id: siteId || sites[0]?.id || '',
    type: 'Preventive', priority: 'Medium', assigned_to: '', vendor_id: '',
    trigger_type: 'Calendar', interval_value: 1, interval_unit: 'month', schedule_mode: 'Fixed',
    next_due: addDays(todayStr(), 7), lead_days: 7,
    meter_interval: 250, meter_last: '', meter_lead: 20, estimated_hours: '', active: true,
    ...(schedule || {}),
    ...prefill,
    tasksText: (schedule?.tasks || []).join('\n')
    };
    if (!schedule && init.asset_id && init.meter_last === '') init.meter_last = lookup.asset[init.asset_id]?.current_meter ?? '';
    return init;
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const asset = lookup.asset[f.asset_id];

  const pickAsset = id => {
    const a = lookup.asset[id];
    setF(x => ({
      ...x, asset_id: id,
      ...(a ? { site_id: a.site_id, location_id: '' } : {}),
      ...(a && x.meter_last === '' && a.current_meter !== null ? { meter_last: a.current_meter } : {})
    }));
  };

  async function save() {
    setError('');
    if (!f.title.trim()) { setError('Give the schedule a title.'); return; }
    if (!f.asset_id && !f.location_id) { setError('Choose the asset, or a location for area-wide rounds.'); return; }
    if (f.trigger_type === 'Meter' && !f.asset_id) { setError('Hour-meter schedules need an asset with an hour meter.'); return; }
    const row = {
      title: f.title.trim(),
      instructions: f.instructions?.trim() || null,
      asset_id: f.asset_id || null,
      location_id: f.asset_id ? null : (f.location_id || null),
      site_id: asset?.site_id || f.site_id || null,
      type: f.type, priority: f.priority,
      assigned_to: f.assigned_to || null,
      vendor_id: f.vendor_id || null,
      trigger_type: f.trigger_type,
      interval_value: f.trigger_type === 'Calendar' ? Number(f.interval_value) : null,
      interval_unit: f.trigger_type === 'Calendar' ? f.interval_unit : null,
      schedule_mode: f.schedule_mode,
      next_due: f.trigger_type === 'Calendar' ? f.next_due : null,
      lead_days: Number(f.lead_days) || 0,
      meter_interval: f.trigger_type === 'Meter' ? Number(f.meter_interval) : null,
      meter_last: f.trigger_type === 'Meter' ? Number(f.meter_last || 0) : 0,
      meter_lead: f.trigger_type === 'Meter' ? Number(f.meter_lead || 0) : 0,
      estimated_hours: f.estimated_hours === '' || f.estimated_hours === null ? null : f.estimated_hours,
      active: !!f.active,
      tasks: f.tasksText.split('\n').map(t => t.trim()).filter(Boolean)
    };
    setBusy(true);
    try {
      if (editing) await db.update('pm_schedules', schedule.id, row);
      else await db.insert('pm_schedules', row);
      // Create the first work order straight away if it is already due.
      const n = await db.rpc('generate_pm_work_orders');
      toast(`${editing ? 'Schedule updated' : 'Schedule created'}${n ? ` · ${n} work order${n > 1 ? 's' : ''} created` : ''}.`);
      refreshTables('pm_schedules', 'work_orders');
      onClose();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  async function remove() {
    try {
      await db.remove('pm_schedules', schedule.id);
      toast('Schedule deleted.');
      refreshTables('pm_schedules');
      onClose();
    } catch (e) { setError(e.message); }
  }

  const unit = INTERVAL_UNITS.find(u => u.value === f.interval_unit);
  return (
    <FormModal title={editing ? 'Edit PM schedule' : 'New PM schedule'} onClose={onClose} onSubmit={save} busy={busy} error={error} wide
               submitLabel={editing ? 'Save schedule' : 'Create schedule'}
               extraFooter={editing && isAdmin ? <ConfirmButton onConfirm={remove}>Delete schedule</ConfirmButton> : null}>
      <div className="form-grid">
        <Field label="Title" required span>
          <input className="input" value={f.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Dock levelers – monthly lubrication & inspection" />
        </Field>
        <Field label="Asset" hint="Or leave blank and pick a location for area rounds.">
          <AssetPicker value={f.asset_id} onChange={pickAsset} />
        </Field>
        {!f.asset_id ? (
          <Field label="Location"><LocationSelect value={f.location_id} onChange={v => set('location_id', v)} siteId={f.site_id} /></Field>
        ) : <div />}
        {!f.asset_id && sites.length > 1 && <Field label="Site"><SiteSelect value={f.site_id} onChange={v => set('site_id', v)} /></Field>}
        <Field label="Type"><select className="select" value={f.type} onChange={e => set('type', e.target.value)}><Options values={PM_TYPES} /></select></Field>
        <Field label="Priority"><select className="select" value={f.priority} onChange={e => set('priority', e.target.value)}><Options values={PRIORITIES} /></select></Field>
        <Field label="Assign to"><PersonSelect value={f.assigned_to} onChange={v => set('assigned_to', v)} /></Field>
        <Field label="Contractor" hint="If the PM is done by a vendor."><VendorSelect value={f.vendor_id} onChange={v => set('vendor_id', v)} /></Field>

        <div className="form-section">When is it due?</div>
        <div className="span-2">
          <Segmented label="Trigger" value={f.trigger_type} onChange={v => set('trigger_type', v)}
                     items={[{ value: 'Calendar', label: 'By calendar' }, { value: 'Meter', label: 'By hour meter' }]} />
        </div>
        {f.trigger_type === 'Calendar' ? <>
          <Field label="Repeat every">
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" type="number" min="1" style={{ maxWidth: 90 }} value={f.interval_value} onChange={e => set('interval_value', e.target.value)} />
              <select className="select" value={f.interval_unit} onChange={e => set('interval_unit', e.target.value)}>
                {INTERVAL_UNITS.map(u => <option key={u.value} value={u.value}>{Number(f.interval_value) === 1 ? u.one : u.many}</option>)}
              </select>
            </div>
          </Field>
          <Field label="Next due" required><input className="input" type="date" required value={f.next_due || ''} onChange={e => set('next_due', e.target.value)} /></Field>
          <Field label="Create the work order" hint="Days before the due date.">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input className="input" type="number" min="0" style={{ maxWidth: 90 }} value={f.lead_days} onChange={e => set('lead_days', e.target.value)} />
              <span className="dim">days ahead</span>
            </div>
          </Field>
          <Field label="After each completion" hint={f.schedule_mode === 'Fixed'
            ? `Next date stays on the ${unit?.one || ''} cycle, even if the job is done late.`
            : `Next date is counted from the day the job is actually done.`}>
            <select className="select" value={f.schedule_mode} onChange={e => set('schedule_mode', e.target.value)}>
              <option value="Fixed">Keep the fixed cycle</option>
              <option value="Floating">Count from completion date</option>
            </select>
          </Field>
        </> : <>
          <Field label="Every" hint={asset?.current_meter !== null && asset ? `Hour meter now: ${fmtNum(asset.current_meter)} h` : 'Pick an asset with an hour meter.'}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input className="input" type="number" min="1" style={{ maxWidth: 110 }} value={f.meter_interval} onChange={e => set('meter_interval', e.target.value)} />
              <span className="dim">running hours</span>
            </div>
          </Field>
          <Field label="Last serviced at" hint="Hour meter reading at the last service.">
            <input className="input" type="number" min="0" step="0.1" value={f.meter_last} onChange={e => set('meter_last', e.target.value)} />
          </Field>
          <Field label="Create the work order" hint="Hours before the service is due.">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input className="input" type="number" min="0" style={{ maxWidth: 90 }} value={f.meter_lead} onChange={e => set('meter_lead', e.target.value)} />
              <span className="dim">hours ahead</span>
            </div>
          </Field>
          <div className="field" style={{ justifyContent: 'center' }}>
            <span className="field-hint">Next service at <b>{fmtNum(Number(f.meter_last || 0) + Number(f.meter_interval || 0))} h</b>. The work order is due 7 days after it is created.</span>
          </div>
        </>}

        <div className="form-section">The job</div>
        <Field label="Task checklist" hint="One task per line. Each work order gets these as tick-off tasks." span>
          <textarea className="textarea" style={{ minHeight: 140 }} value={f.tasksText} onChange={e => set('tasksText', e.target.value)}
                    placeholder={'Lubricate hinge pins\nCheck hydraulic oil level\nTest full cycle'} />
        </Field>
        <Field label="Instructions" hint="Safety notes, isolation steps, references." span>
          <textarea className="textarea" value={f.instructions || ''} onChange={e => set('instructions', e.target.value)} />
        </Field>
        <Field label="Estimated hours"><input className="input" type="number" min="0" step="0.5" value={f.estimated_hours ?? ''} onChange={e => set('estimated_hours', e.target.value)} /></Field>
        <div className="field" style={{ justifyContent: 'flex-end' }}>
          <label className="check"><input type="checkbox" checked={!!f.active} onChange={e => set('active', e.target.checked)} /><span>Active (untick to pause without deleting)</span></label>
        </div>
      </div>
    </FormModal>
  );
}
