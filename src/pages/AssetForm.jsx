import { useState } from 'react';
import { useData } from '../data/DataProvider';
import { db } from '../data/api';
import { useToast } from '../components/Toast';
import { AssetPicker, Field, FormModal, LocationSelect, Options, SiteSelect, VendorSelect } from '../components/ui';
import { ASSET_STATUSES, CRITICALITY, MHE_TYPES, OWNERSHIP, POWER_TYPES } from '../lib/constants';
import { navigate } from '../lib/router';

const NUMERIC = ['purchase_cost', 'capacity_kg', 'lift_height_mm', 'current_meter'];
const TEXT = ['code', 'name', 'make', 'model', 'serial_no', 'battery_ref', 'notes'];

export default function AssetForm({ asset, onClose }) {
  const { sites, siteId, categories, lookup, refreshTables, isAdmin } = useData();
  const toast = useToast();
  const editing = !!asset;
  const [f, setF] = useState(() => ({
    code: '', name: '', category_id: '', site_id: siteId || sites[0]?.id || '', location_id: '', parent_id: '',
    status: 'Operational', criticality: 'Medium', make: '', model: '', serial_no: '', install_date: '', warranty_expiry: '',
    purchase_cost: '', vendor_id: '', mhe_type: '', capacity_kg: '', lift_height_mm: '', power_type: '', battery_ref: '',
    ownership: '', current_meter: '', cert_expiry: '', notes: '',
    ...(asset || {})
  }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const isMhe = !!lookup.category[f.category_id]?.is_mhe;

  async function save() {
    setError('');
    if (!f.name.trim()) { setError('Give the asset a name.'); return; }
    if (!f.site_id) { setError('Choose a site. Admins can add sites under Settings.'); return; }
    const row = {};
    for (const k of ['category_id', 'site_id', 'location_id', 'parent_id', 'status', 'criticality', 'install_date', 'warranty_expiry',
                     'vendor_id', 'mhe_type', 'power_type', 'ownership', 'cert_expiry', ...NUMERIC, ...TEXT]) {
      const v = typeof f[k] === 'string' ? f[k].trim() : f[k];
      row[k] = v === '' || v === undefined ? null : v;
    }
    if (!isMhe) Object.assign(row, { mhe_type: null, capacity_kg: null, lift_height_mm: null, battery_ref: null, cert_expiry: null });
    if (editing && !isAdmin) delete row.current_meter; // readings go through "Record hours" so history is kept
    if (editing && row.status !== asset.status) delete row.status; // status changes go through "Change status"
    setBusy(true);
    try {
      if (editing) {
        await db.update('assets', asset.id, row);
        toast('Asset updated.');
      } else {
        const created = await db.insert('assets', row);
        toast(`Asset ${created.code} added.`);
        navigate(`/assets/${created.id}`);
      }
      refreshTables('assets');
      onClose();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  return (
    <FormModal title={editing ? `Edit ${asset.code}` : 'Add asset'} onClose={onClose} onSubmit={save} busy={busy} error={error} wide
               submitLabel={editing ? 'Save changes' : 'Add asset'}>
      <div className="form-grid">
        <Field label="Asset tag" hint={editing ? 'Printed on the equipment label.' : 'e.g. RT-07. Leave blank to number it automatically.'}>
          <input className="input" value={f.code} onChange={e => set('code', e.target.value)} placeholder="AST-0001" style={{ fontFamily: 'var(--font-mono)' }} />
        </Field>
        <Field label="Name" required>
          <input className="input" value={f.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Reach Truck 07" />
        </Field>
        <Field label="Category" required>
          <select className="select" required value={f.category_id || ''} onChange={e => set('category_id', e.target.value)}>
            <option value="">— Select —</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Criticality" hint="How badly operations suffer if it fails.">
          <select className="select" value={f.criticality} onChange={e => set('criticality', e.target.value)}><Options values={CRITICALITY} /></select>
        </Field>
        {sites.length > 1 && <Field label="Site" required><SiteSelect value={f.site_id} onChange={v => set('site_id', v)} /></Field>}
        <Field label="Location"><LocationSelect value={f.location_id} onChange={v => set('location_id', v)} siteId={f.site_id} /></Field>
        <Field label="Part of" hint="Parent asset, e.g. a battery fitted to a truck.">
          <AssetPicker value={f.parent_id} onChange={v => set('parent_id', v)} siteId={f.site_id} filter={a => a.id !== asset?.id} placeholder="None" />
        </Field>
        {!editing && (
          <Field label="Status"><select className="select" value={f.status} onChange={e => set('status', e.target.value)}><Options values={ASSET_STATUSES} /></select></Field>
        )}

        <div className="form-section">Make and service</div>
        <Field label="Make"><input className="input" value={f.make || ''} onChange={e => set('make', e.target.value)} /></Field>
        <Field label="Model"><input className="input" value={f.model || ''} onChange={e => set('model', e.target.value)} /></Field>
        <Field label="Serial number"><input className="input" value={f.serial_no || ''} onChange={e => set('serial_no', e.target.value)} /></Field>
        <Field label="Service contractor"><VendorSelect value={f.vendor_id} onChange={v => set('vendor_id', v)} /></Field>
        <Field label="Installed / in service since"><input className="input" type="date" value={f.install_date || ''} onChange={e => set('install_date', e.target.value)} /></Field>
        <Field label="Warranty ends"><input className="input" type="date" value={f.warranty_expiry || ''} onChange={e => set('warranty_expiry', e.target.value)} /></Field>
        <Field label="Purchase cost (₱)"><input className="input" type="number" min="0" step="0.01" value={f.purchase_cost ?? ''} onChange={e => set('purchase_cost', e.target.value)} /></Field>
        <Field label="Power / drive"><select className="select" value={f.power_type || ''} onChange={e => set('power_type', e.target.value)}><Options values={POWER_TYPES} empty="—" /></select></Field>
        {(!editing || isAdmin) && (
          <Field label="Hour meter now" hint={editing ? 'Only change this if the meter was replaced. Normal readings go through Record hours.' : 'Optional. For MHE, gensets, compressors.'}>
            <input className="input" type="number" min="0" step="0.1" value={f.current_meter ?? ''} onChange={e => set('current_meter', e.target.value)} />
          </Field>
        )}

        {isMhe && <>
          <div className="form-section">Material handling equipment</div>
          <Field label="MHE type" required>
            <select className="select" required value={f.mhe_type || ''} onChange={e => set('mhe_type', e.target.value)}><Options values={MHE_TYPES} empty="— Select —" /></select>
          </Field>
          <Field label="Ownership"><select className="select" value={f.ownership || ''} onChange={e => set('ownership', e.target.value)}><Options values={OWNERSHIP} empty="—" /></select></Field>
          <Field label="Rated capacity (kg)"><input className="input" type="number" min="0" value={f.capacity_kg ?? ''} onChange={e => set('capacity_kg', e.target.value)} /></Field>
          <Field label="Max lift height (mm)"><input className="input" type="number" min="0" value={f.lift_height_mm ?? ''} onChange={e => set('lift_height_mm', e.target.value)} /></Field>
          <Field label="Battery / charger ref"><input className="input" value={f.battery_ref || ''} onChange={e => set('battery_ref', e.target.value)} placeholder="e.g. BAT-07" /></Field>
          <Field label="Inspection certificate valid to" hint="Third-party inspection or load test."><input className="input" type="date" value={f.cert_expiry || ''} onChange={e => set('cert_expiry', e.target.value)} /></Field>
        </>}

        <Field label="Notes" span><textarea className="textarea" value={f.notes || ''} onChange={e => set('notes', e.target.value)} /></Field>
      </div>
    </FormModal>
  );
}
