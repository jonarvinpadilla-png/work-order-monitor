import { useState } from 'react';
import { useData } from '../data/DataProvider';
import { db } from '../data/api';
import { useToast } from '../components/Toast';
import { AssetPicker, Field, FormModal, LocationSelect, SiteSelect } from '../components/ui';
import { navigate } from '../lib/router';

const URGENCY = [
  { value: 'Low', label: 'Low — when convenient' },
  { value: 'Medium', label: 'Medium — within the week' },
  { value: 'High', label: 'High — within 1–2 days' },
  { value: 'Critical', label: 'Critical — operations stopped or someone could get hurt' }
];

// Anyone can report a problem. It becomes a work order once an admin approves it.
export default function RequestForm({ prefill = {}, onClose }) {
  const { sites, siteId, lookup, me, isStaff, refreshTables } = useData();
  const toast = useToast();
  const [form, setForm] = useState({
    title: '', description: '', priority: 'Medium', asset_id: '', location_id: '',
    site_id: prefill.site_id || siteId || sites[0]?.id || '', asset_down: false, safety: false, requester_name: '',
    ...prefill
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const pickAsset = id => {
    const a = lookup.asset[id];
    setForm(f => ({ ...f, asset_id: id, ...(a ? { site_id: a.site_id, location_id: a.location_id || '' } : {}) }));
  };

  async function save() {
    setError('');
    if (!form.title.trim()) { setError('Say briefly what is wrong.'); return; }
    if (!form.asset_id && !form.location_id) { setError('Pick the equipment or the location so the team can find it.'); return; }
    setBusy(true);
    try {
      const created = await db.insert('work_orders', {
        title: form.title.trim(),
        description: form.description.trim() || null,
        type: form.safety ? 'Safety' : 'Corrective',
        priority: form.priority,
        status: 'Requested',
        site_id: form.site_id || null,
        asset_id: form.asset_id || null,
        location_id: form.location_id || null,
        asset_down: form.asset_down,
        requested_by: me.id,
        requester_name: form.requester_name.trim() || null
      });
      toast(`Request ${created.code} sent. You can follow it under My requests.`);
      refreshTables('work_orders');
      onClose();
      navigate(isStaff ? `/work-orders/${created.id}` : '/');
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  return (
    <FormModal title="Report a problem" onClose={onClose} onSubmit={save} busy={busy} error={error} submitLabel="Send request">
      <div className="form-grid">
        <Field label="What's wrong?" required span>
          <input className="input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Freezer door not closing fully" />
        </Field>
        <Field label="Equipment" hint="Search by tag, e.g. RT-03 or DL-02." span>
          <AssetPicker value={form.asset_id} onChange={pickAsset} />
        </Field>
        <Field label="Location" hint="If it's not a specific piece of equipment.">
          <LocationSelect value={form.location_id} onChange={v => set('location_id', v)} siteId={form.site_id} />
        </Field>
        {sites.length > 1 ? (
          <Field label="Site"><SiteSelect value={form.site_id} onChange={v => set('site_id', v)} /></Field>
        ) : <div />}
        <Field label="How urgent?" span>
          <select className="select" value={form.priority} onChange={e => set('priority', e.target.value)}>
            {URGENCY.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </Field>
        <Field label="Details" span>
          <textarea className="textarea" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Where exactly, since when, anything you noticed." />
        </Field>
        <div className="span-2" style={{ display: 'grid', gap: 10 }}>
          <label className="check"><input type="checkbox" checked={form.asset_down} onChange={e => set('asset_down', e.target.checked)} /><span>The equipment has stopped or can't be used</span></label>
          <label className="check"><input type="checkbox" checked={form.safety} onChange={e => set('safety', e.target.checked)} /><span>This is a safety hazard</span></label>
        </div>
        <Field label="Reported on behalf of" hint="Optional: another person or department." span>
          <input className="input" value={form.requester_name} onChange={e => set('requester_name', e.target.value)} placeholder="e.g. Night shift supervisor" />
        </Field>
      </div>
    </FormModal>
  );
}
