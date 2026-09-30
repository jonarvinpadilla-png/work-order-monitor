import { useState } from 'react';
import { useData } from '../data/DataProvider';
import { db } from '../data/api';
import { useToast } from '../components/Toast';
import { AssetPicker, Field, FormModal, LocationSelect, Options, PersonSelect, SiteSelect, VendorSelect } from '../components/ui';
import { PRIORITIES, WO_TYPES } from '../lib/constants';
import { navigate } from '../lib/router';

const nullIfEmpty = v => (v === '' || v === undefined ? null : v);

export default function WorkOrderForm({ order, prefill = {}, onClose }) {
  const { sites, siteId, lookup, refreshTables } = useData();
  const toast = useToast();
  const editing = !!order;
  const [form, setForm] = useState(() => ({
    title: '', description: '', type: 'Corrective', priority: 'Medium',
    site_id: prefill.site_id || siteId || sites[0]?.id || '',
    asset_id: '', location_id: '', assigned_to: '', vendor_id: '',
    due_date: '', estimated_hours: '', external_cost: '', asset_down: false, tasksText: '',
    ...(order || {}),
    ...prefill
  }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const pickAsset = id => {
    const a = lookup.asset[id];
    setForm(f => ({ ...f, asset_id: id, ...(a ? { site_id: a.site_id, location_id: a.location_id || '' } : {}) }));
  };

  async function save() {
    setError('');
    if (!form.title.trim()) { setError('Give the work order a title.'); return; }
    if (!form.site_id) { setError('Choose a site. Admins can add sites under Settings.'); return; }
    const payload = {
      title: form.title.trim(),
      description: nullIfEmpty(form.description?.trim()),
      type: form.type,
      priority: form.priority,
      site_id: form.site_id,
      asset_id: nullIfEmpty(form.asset_id),
      location_id: nullIfEmpty(form.location_id),
      assigned_to: nullIfEmpty(form.assigned_to),
      vendor_id: nullIfEmpty(form.vendor_id),
      due_date: nullIfEmpty(form.due_date),
      estimated_hours: nullIfEmpty(form.estimated_hours),
      external_cost: form.external_cost === '' || form.external_cost === null ? 0 : form.external_cost,
      asset_down: !!form.asset_down
    };
    setBusy(true);
    try {
      if (editing) {
        await db.update('work_orders', order.id, payload);
        toast('Work order updated.');
      } else {
        const created = await db.insert('work_orders', payload);
        const tasks = form.tasksText.split('\n').map(t => t.trim()).filter(Boolean);
        if (tasks.length) await db.insertMany('wo_tasks', tasks.map((description, i) => ({ work_order_id: created.id, seq: i + 1, description })));
        toast(`Work order ${created.code} created.`);
        navigate(`/work-orders/${created.id}`);
      }
      refreshTables('work_orders');
      onClose();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  return (
    <FormModal title={editing ? `Edit ${order.code}` : 'New work order'} onClose={onClose} onSubmit={save} busy={busy} error={error}
               submitLabel={editing ? 'Save changes' : 'Create work order'} wide>
      <div className="form-grid">
        <Field label="Title" required span>
          <input className="input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Dock 3 leveler lip not extending" />
        </Field>
        <Field label="Type">
          <select className="select" value={form.type} onChange={e => set('type', e.target.value)}><Options values={WO_TYPES} /></select>
        </Field>
        <Field label="Priority">
          <select className="select" value={form.priority} onChange={e => set('priority', e.target.value)}><Options values={PRIORITIES} /></select>
        </Field>
        <Field label="Asset" hint="Leave blank for building or area work.">
          <AssetPicker value={form.asset_id} onChange={pickAsset} />
        </Field>
        <Field label="Location">
          <LocationSelect value={form.location_id} onChange={v => set('location_id', v)} siteId={form.site_id} />
        </Field>
        {sites.length > 1 && (
          <Field label="Site" required>
            <SiteSelect value={form.site_id} onChange={v => set('site_id', v)} />
          </Field>
        )}
        <Field label="Description" span>
          <textarea className="textarea" value={form.description || ''} onChange={e => set('description', e.target.value)} placeholder="What is wrong, where exactly, and anything already tried." />
        </Field>
        <Field label="Assigned to">
          <PersonSelect value={form.assigned_to} onChange={v => set('assigned_to', v)} />
        </Field>
        <Field label="Contractor" hint="If the job is outsourced.">
          <VendorSelect value={form.vendor_id} onChange={v => set('vendor_id', v)} />
        </Field>
        <Field label="Due date">
          <input className="input" type="date" value={form.due_date || ''} onChange={e => set('due_date', e.target.value)} />
        </Field>
        <Field label="Estimated hours">
          <input className="input" type="number" min="0" step="0.5" value={form.estimated_hours ?? ''} onChange={e => set('estimated_hours', e.target.value)} />
        </Field>
        <Field label="Contractor / external cost (₱)">
          <input className="input" type="number" min="0" step="0.01" value={form.external_cost ?? ''} onChange={e => set('external_cost', e.target.value)} />
        </Field>
        <div className="field" style={{ justifyContent: 'flex-end' }}>
          <label className="check">
            <input type="checkbox" checked={!!form.asset_down} onChange={e => set('asset_down', e.target.checked)} />
            <span>Equipment is down or unsafe to use</span>
          </label>
        </div>
        {!editing && (
          <Field label="Task checklist" hint="Optional. One task per line; technicians tick them off on the job." span>
            <textarea className="textarea" value={form.tasksText} onChange={e => set('tasksText', e.target.value)} placeholder={'Isolate power and lock out\nReplace seal kit\nTest full cycle'} />
          </Field>
        )}
      </div>
    </FormModal>
  );
}
