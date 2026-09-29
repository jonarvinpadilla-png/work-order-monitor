import { useState } from 'react';
import { useData } from '../data/DataProvider';
import { db } from '../data/api';
import { useToast } from '../components/Toast';
import { Badge, ConfirmButton, DataTable, Field, FormModal, Options, PageHead, SearchBox, SiteSelect, Tabs, Tile } from '../components/ui';
import { Icon } from '../lib/icons';
import { useRoute } from '../lib/router';
import { CONTRACT_BILLING, VENDOR_SERVICES } from '../lib/constants';
import { daysUntil, fmtDate, fmtMoney } from '../lib/format';

function contractStatus(c) {
  if (!c.end_date) return { label: 'Open-ended', tone: 'plain', rank: 3 };
  const d = daysUntil(c.end_date);
  if (d < 0) return { label: `Expired ${-d}d ago`, tone: 'danger', rank: 0 };
  if (d <= c.renewal_notice_days) return { label: `Renew · ${d}d left`, tone: 'warn', rank: 1 };
  return { label: 'Active', tone: 'good', rank: 2 };
}

export default function Vendors() {
  const { vendors, contracts, lookup, isAdmin, inSite } = useData();
  const route = useRoute();
  const [tab, setTab] = useState(route.query.get('tab') || 'vendors');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // { kind: 'vendor' | 'contract', row? }
  const q = search.trim().toLowerCase();
  const myContracts = contracts.filter(inSite);

  const vendorRows = vendors.filter(v => !q || `${v.name} ${v.service_type || ''} ${v.contact_person || ''}`.toLowerCase().includes(q));
  const contractRows = myContracts.filter(c => !q || `${c.title} ${lookup.vendor[c.vendor_id]?.name || ''} ${c.scope || ''}`.toLowerCase().includes(q));
  const renew = myContracts.filter(c => contractStatus(c).rank <= 1);
  const annual = myContracts.filter(c => contractStatus(c).rank > 0).reduce((s, c) => s + Number(c.value || 0), 0);

  return (
    <>
      <PageHead eyebrow="Contractors" title="Vendors & contracts" sub="Service providers, what they cover, and when their contracts end."
                actions={isAdmin && <>
                  <button className="btn" onClick={() => setModal({ kind: 'vendor' })}><Icon.Plus />Add vendor</button>
                  <button className="btn btn-primary" onClick={() => setModal({ kind: 'contract' })}><Icon.Plus />Add contract</button>
                </>} />
      <div className="tiles">
        <Tile label="Active vendors" value={vendors.filter(v => v.active).length} />
        <Tile label="Contracts" value={myContracts.length} />
        <Tile label="Expired or due for renewal" value={renew.length} tone={renew.some(c => contractStatus(c).rank === 0) ? 'danger' : renew.length ? 'warn' : 'good'} onClick={() => setTab('contracts')} />
        <Tile label="Value of current contracts" value={fmtMoney(annual)} />
      </div>
      <Tabs value={tab} onChange={setTab} items={[{ value: 'vendors', label: 'Vendors', count: vendors.length }, { value: 'contracts', label: 'Contracts', count: myContracts.length }]} />
      <div className="toolbar"><SearchBox value={search} onChange={setSearch} placeholder={tab === 'vendors' ? 'Vendor, service or contact' : 'Contract, vendor or scope'} /></div>
      <div className="card">
        {tab === 'vendors' ? (
          <DataTable rows={vendorRows} initialSort={{ key: 'name', dir: 'asc' }} onRowClick={v => setModal({ kind: 'vendor', row: v })} empty="No vendors yet."
            columns={[
              { key: 'name', label: 'Vendor', sort: v => v.name, render: v => <><div className="cell-title">{v.name}</div><div className="cell-sub">{v.service_type}</div></> },
              { key: 'contact', label: 'Contact', render: v => <>{v.contact_person || '—'}<div className="cell-sub">{v.phone}</div></> },
              { key: 'email', label: 'Email', render: v => v.email ? <a href={`mailto:${v.email}`} onClick={e => e.stopPropagation()}>{v.email}</a> : '—' },
              { key: 'contracts', label: 'Contracts', right: true, sort: v => contracts.filter(c => c.vendor_id === v.id).length, render: v => contracts.filter(c => c.vendor_id === v.id).length },
              { key: 'active', label: 'Status', render: v => v.active ? <Badge tone="good">Active</Badge> : <Badge tone="muted">Inactive</Badge> }
            ]} />
        ) : (
          <DataTable rows={contractRows} initialSort={{ key: 'status', dir: 'asc' }} onRowClick={c => setModal({ kind: 'contract', row: c })} empty="No contracts recorded."
            columns={[
              { key: 'title', label: 'Contract', sort: c => c.title, render: c => <><div className="cell-title">{c.title}</div><div className="cell-sub">{lookup.vendor[c.vendor_id]?.name}</div></> },
              { key: 'period', label: 'Period', sort: c => c.end_date || '9999', render: c => <span className="nowrap">{fmtDate(c.start_date)} – {fmtDate(c.end_date)}</span> },
              { key: 'billing', label: 'Billing', render: c => c.billing || '—' },
              { key: 'value', label: 'Value', right: true, sort: c => Number(c.value || 0), render: c => <span className="num">{fmtMoney(c.value)}</span> },
              { key: 'status', label: 'Status', sort: c => contractStatus(c).rank * 100000 + (daysUntil(c.end_date) ?? 99999), render: c => { const s = contractStatus(c); return <Badge tone={s.tone}>{s.label}</Badge>; } }
            ]} />
        )}
      </div>
      {modal?.kind === 'vendor' && <VendorForm vendor={modal.row} onClose={() => setModal(null)} />}
      {modal?.kind === 'contract' && <ContractForm contract={modal.row} onClose={() => setModal(null)} />}
    </>
  );
}

function VendorForm({ vendor, onClose }) {
  const { isAdmin, refreshTables } = useData();
  const toast = useToast();
  const [f, setF] = useState({ name: '', service_type: '', contact_person: '', phone: '', email: '', address: '', notes: '', active: true, ...(vendor || {}) });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const readOnly = !isAdmin;
  async function save() {
    if (readOnly) { onClose(); return; }
    if (!f.name.trim()) { setError('Enter the vendor name.'); return; }
    const row = { name: f.name.trim(), service_type: f.service_type || null, contact_person: f.contact_person || null, phone: f.phone || null, email: f.email || null, address: f.address || null, notes: f.notes || null, active: f.active };
    setBusy(true);
    try {
      if (vendor) await db.update('vendors', vendor.id, row); else await db.insert('vendors', row);
      toast(vendor ? 'Vendor updated.' : 'Vendor added.');
      refreshTables('vendors');
      onClose();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }
  return (
    <FormModal title={vendor ? vendor.name : 'Add vendor'} onClose={onClose} onSubmit={save} busy={busy} error={error} submitLabel={readOnly ? 'Close' : 'Save vendor'}
               extraFooter={vendor && isAdmin ? <ConfirmButton onConfirm={async () => { try { await db.remove('vendors', vendor.id); toast('Vendor deleted.'); refreshTables('vendors', 'contracts'); onClose(); } catch (e) { setError(e.message); } }}>Delete</ConfirmButton> : null}>
      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="form-grid">
          <Field label="Name" required span><input className="input" value={f.name} onChange={e => set('name', e.target.value)} /></Field>
          <Field label="Service" span>
            <input className="input" list="vendor-services" value={f.service_type || ''} onChange={e => set('service_type', e.target.value)} />
            <datalist id="vendor-services">{VENDOR_SERVICES.map(v => <option key={v} value={v} />)}</datalist>
          </Field>
          <Field label="Contact person"><input className="input" value={f.contact_person || ''} onChange={e => set('contact_person', e.target.value)} /></Field>
          <Field label="Phone"><input className="input" type="tel" value={f.phone || ''} onChange={e => set('phone', e.target.value)} /></Field>
          <Field label="Email"><input className="input" type="email" value={f.email || ''} onChange={e => set('email', e.target.value)} /></Field>
          <Field label="Address"><input className="input" value={f.address || ''} onChange={e => set('address', e.target.value)} /></Field>
          <Field label="Notes" span><textarea className="textarea" value={f.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Accreditations, emergency hotline, SLA…" /></Field>
          <label className="check span-2"><input type="checkbox" checked={f.active} onChange={e => set('active', e.target.checked)} /><span>Active vendor</span></label>
        </div>
      </fieldset>
    </FormModal>
  );
}

function ContractForm({ contract, onClose }) {
  const { vendors, sites, siteId, isAdmin, refreshTables } = useData();
  const toast = useToast();
  const [f, setF] = useState({ vendor_id: '', site_id: siteId || sites[0]?.id || '', title: '', scope: '', start_date: '', end_date: '', value: '', billing: 'Annual', renewal_notice_days: 60, notes: '', ...(contract || {}) });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const readOnly = !isAdmin;
  async function save() {
    if (readOnly) { onClose(); return; }
    if (!f.vendor_id || !f.title.trim()) { setError('Choose the vendor and give the contract a title.'); return; }
    const row = { vendor_id: f.vendor_id, site_id: f.site_id || null, title: f.title.trim(), scope: f.scope || null, start_date: f.start_date || null, end_date: f.end_date || null,
      value: f.value === '' || f.value === null ? null : f.value, billing: f.billing || null, renewal_notice_days: Number(f.renewal_notice_days) || 0, notes: f.notes || null };
    setBusy(true);
    try {
      if (contract) await db.update('contracts', contract.id, row); else await db.insert('contracts', row);
      toast(contract ? 'Contract updated.' : 'Contract added.');
      refreshTables('contracts');
      onClose();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }
  return (
    <FormModal title={contract ? contract.title : 'Add contract'} onClose={onClose} onSubmit={save} busy={busy} error={error} submitLabel={readOnly ? 'Close' : 'Save contract'}
               extraFooter={contract && isAdmin ? <ConfirmButton onConfirm={async () => { try { await db.remove('contracts', contract.id); toast('Contract deleted.'); refreshTables('contracts'); onClose(); } catch (e) { setError(e.message); } }}>Delete</ConfirmButton> : null}>
      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="form-grid">
          <Field label="Vendor" required>
            <select className="select" value={f.vendor_id} onChange={e => set('vendor_id', e.target.value)}>
              <option value="">— Select —</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </Field>
          {sites.length > 1 ? <Field label="Site"><SiteSelect value={f.site_id} onChange={v => set('site_id', v)} /></Field> : <div />}
          <Field label="Title" required span><input className="input" value={f.title} onChange={e => set('title', e.target.value)} placeholder="e.g. FDAS and sprinkler maintenance" /></Field>
          <Field label="Scope" span><textarea className="textarea" value={f.scope || ''} onChange={e => set('scope', e.target.value)} placeholder="What is covered, frequency of visits, response time" /></Field>
          <Field label="Start"><input className="input" type="date" value={f.start_date || ''} onChange={e => set('start_date', e.target.value)} /></Field>
          <Field label="End"><input className="input" type="date" value={f.end_date || ''} onChange={e => set('end_date', e.target.value)} /></Field>
          <Field label="Contract value (₱)"><input className="input" type="number" min="0" step="0.01" value={f.value ?? ''} onChange={e => set('value', e.target.value)} /></Field>
          <Field label="Billing"><select className="select" value={f.billing || ''} onChange={e => set('billing', e.target.value)}><Options values={CONTRACT_BILLING} empty="—" /></select></Field>
          <Field label="Warn before end" hint="Days of notice you need to renew or re-bid."><input className="input" type="number" min="0" value={f.renewal_notice_days} onChange={e => set('renewal_notice_days', e.target.value)} /></Field>
          <Field label="Notes" span><textarea className="textarea" value={f.notes || ''} onChange={e => set('notes', e.target.value)} /></Field>
        </div>
      </fieldset>
    </FormModal>
  );
}
