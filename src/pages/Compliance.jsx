import { useEffect, useState } from 'react';
import { useData } from '../data/DataProvider';
import { db } from '../data/api';
import { useToast } from '../components/Toast';
import { Badge, ConfirmButton, DataTable, Field, FormModal, Options, PageHead, Person, PersonSelect, SearchBox, SiteSelect, Tile, VendorSelect } from '../components/ui';
import { Icon } from '../lib/icons';
import { COMPLIANCE_CATEGORIES } from '../lib/constants';
import { addInterval, daysUntil, fmtDate, todayStr } from '../lib/format';

function dueStatus(c) {
  if (!c.next_due) return { label: 'No expiry', tone: 'plain', rank: 4 };
  const d = daysUntil(c.next_due);
  if (d < 0) return { label: `Expired ${-d}d ago`, tone: 'danger', rank: 0 };
  if (d <= 30) return { label: `Due in ${d}d`, tone: 'warn', rank: 1 };
  if (d <= 90) return { label: `Due in ${d}d`, tone: 'plain', rank: 2 };
  return { label: 'Current', tone: 'good', rank: 3 };
}

export default function Compliance() {
  const { compliance, lookup, inSite, isAdmin } = useData();
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('');
  const [modal, setModal] = useState(null); // { kind: 'item' | 'renew', row? }
  const items = compliance.filter(c => inSite(c) && c.active);
  const q = search.trim().toLowerCase();
  const rows = items.filter(c => (!cat || c.category === cat) && (!q || `${c.name} ${c.authority || ''} ${c.reference || ''}`.toLowerCase().includes(q)));
  const count = r => items.filter(c => dueStatus(c).rank === r).length;

  return (
    <>
      <PageHead eyebrow="Compliance" title="Permits, certificates & statutory checks"
                sub="Everything the site must renew, test or report on — BFP, DENR, DOLE, LGU, food-safety audits and third-party inspections."
                actions={isAdmin && <button className="btn btn-primary" onClick={() => setModal({ kind: 'item' })}><Icon.Plus />Add requirement</button>} />
      <div className="tiles">
        <Tile label="Expired" icon={Icon.Alert} value={count(0)} tone={count(0) ? 'danger' : 'good'} />
        <Tile label="Due within 30 days" value={count(1)} tone={count(1) ? 'warn' : null} />
        <Tile label="Due in 31–90 days" value={count(2)} />
        <Tile label="Current" value={count(3)} tone="good" />
      </div>
      <div className="toolbar">
        <SearchBox value={search} onChange={setSearch} placeholder="Permit, authority or law" />
        <select className="select" value={cat} onChange={e => setCat(e.target.value)} aria-label="Category"><Options values={COMPLIANCE_CATEGORIES} empty="All categories" /></select>
      </div>
      <div className="card">
        <DataTable rows={rows} initialSort={{ key: 'due', dir: 'asc' }} onRowClick={c => setModal({ kind: 'item', row: c })}
          empty="No requirements recorded. Add permits and certificates to be reminded before they expire."
          columns={[
            { key: 'name', label: 'Requirement', sort: c => c.name, render: c => <><div className="cell-title">{c.name}</div><div className="cell-sub">{[c.authority, c.reference].filter(Boolean).join(' · ')}</div></> },
            { key: 'cat', label: 'Type', sort: c => c.category, render: c => c.category },
            { key: 'freq', label: 'Renews', render: c => c.frequency_months ? (c.frequency_months === 12 ? 'Yearly' : c.frequency_months === 1 ? 'Monthly' : `Every ${c.frequency_months} mo`) : 'As needed' },
            { key: 'last', label: 'Last done', sort: c => c.last_done || '', render: c => fmtDate(c.last_done) },
            { key: 'due', label: 'Next due', sort: c => c.next_due || '9999', render: c => { const s = dueStatus(c); return <><div className="nowrap">{fmtDate(c.next_due)}</div><Badge tone={s.tone}>{s.label}</Badge></>; } },
            { key: 'who', label: 'Owner', render: c => <><Person id={c.responsible_id} fallback="—" />{c.vendor_id && <div className="cell-sub">{lookup.vendor[c.vendor_id]?.name}</div>}</> },
            {
              key: 'act', label: '', render: c => (
                <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                  {c.document_url && <a className="icon-btn" href={c.document_url} target="_blank" rel="noreferrer" title="Open document" aria-label="Open document"><Icon.File /></a>}
                  {isAdmin && <button className="btn btn-sm" onClick={() => setModal({ kind: 'renew', row: c })}><Icon.Check />Renewed</button>}
                </span>
              )
            }
          ]} />
      </div>
      {modal?.kind === 'item' && <ItemForm item={modal.row} onClose={() => setModal(null)} />}
      {modal?.kind === 'renew' && <RenewForm item={modal.row} onClose={() => setModal(null)} />}
    </>
  );
}

function ItemForm({ item, onClose }) {
  const { sites, siteId, isAdmin, refreshTables } = useData();
  const toast = useToast();
  const [f, setF] = useState({ name: '', category: 'Permit', authority: '', reference: '', frequency_months: 12, last_done: '', next_due: '', responsible_id: '', vendor_id: '', document_url: '', notes: '', site_id: siteId || sites[0]?.id || '', ...(item || {}) });
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const readOnly = !isAdmin;
  useEffect(() => {
    if (item) db.select('compliance_events', q => q.eq('item_id', item.id).order('done_date', { ascending: false })).then(setHistory).catch(() => setHistory([]));
  }, [item]);
  async function save() {
    if (readOnly) { onClose(); return; }
    if (!f.name.trim()) { setError('Name the requirement.'); return; }
    const row = { name: f.name.trim(), category: f.category, authority: f.authority || null, reference: f.reference || null,
      frequency_months: f.frequency_months === '' || f.frequency_months === null ? null : Number(f.frequency_months),
      last_done: f.last_done || null, next_due: f.next_due || null, responsible_id: f.responsible_id || null, vendor_id: f.vendor_id || null,
      document_url: f.document_url || null, notes: f.notes || null, site_id: f.site_id || null };
    setBusy(true);
    try {
      if (item) await db.update('compliance_items', item.id, row); else await db.insert('compliance_items', row);
      toast(item ? 'Requirement updated.' : 'Requirement added.');
      refreshTables('compliance_items');
      onClose();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }
  return (
    <FormModal title={item ? item.name : 'Add requirement'} onClose={onClose} onSubmit={save} busy={busy} error={error} wide submitLabel={readOnly ? 'Close' : 'Save'}
               extraFooter={item && isAdmin ? <ConfirmButton onConfirm={async () => { try { await db.update('compliance_items', item.id, { active: false }); toast('Requirement archived.'); refreshTables('compliance_items'); onClose(); } catch (e) { setError(e.message); } }} confirmLabel="Archive requirement">Archive</ConfirmButton> : null}>
      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="form-grid">
          <Field label="Requirement" required span><input className="input" value={f.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Fire Safety Inspection Certificate (FSIC)" /></Field>
          <Field label="Type"><select className="select" value={f.category} onChange={e => set('category', e.target.value)}><Options values={COMPLIANCE_CATEGORIES} /></select></Field>
          <Field label="Renews every (months)" hint="Blank if it doesn't repeat."><input className="input" type="number" min="1" value={f.frequency_months ?? ''} onChange={e => set('frequency_months', e.target.value)} /></Field>
          <Field label="Issuing authority"><input className="input" value={f.authority || ''} onChange={e => set('authority', e.target.value)} placeholder="e.g. Bureau of Fire Protection" /></Field>
          <Field label="Law / standard"><input className="input" value={f.reference || ''} onChange={e => set('reference', e.target.value)} placeholder="e.g. RA 9514 (Fire Code)" /></Field>
          <Field label="Last done / issued"><input className="input" type="date" value={f.last_done || ''} onChange={e => set('last_done', e.target.value)} /></Field>
          <Field label="Next due / expires"><input className="input" type="date" value={f.next_due || ''} onChange={e => set('next_due', e.target.value)} /></Field>
          <Field label="Owner"><PersonSelect value={f.responsible_id} onChange={v => set('responsible_id', v)} staffOnly={false} emptyLabel="—" /></Field>
          <Field label="Contractor"><VendorSelect value={f.vendor_id} onChange={v => set('vendor_id', v)} /></Field>
          {sites.length > 1 && <Field label="Site"><SiteSelect value={f.site_id} onChange={v => set('site_id', v)} /></Field>}
          <Field label="Document link" hint="Link to the scanned permit in SharePoint or Google Drive." span><input className="input" type="url" value={f.document_url || ''} onChange={e => set('document_url', e.target.value)} placeholder="https://" /></Field>
          <Field label="Notes" span><textarea className="textarea" value={f.notes || ''} onChange={e => set('notes', e.target.value)} /></Field>
        </div>
      </fieldset>
      {item && (
        <div style={{ marginTop: 18 }}>
          <h3 className="card-title" style={{ marginBottom: 6 }}>Renewal history</h3>
          {!history ? <p className="mute">Loading…</p> : history.length === 0 ? <p className="mute">No renewals recorded in the CMMS yet.</p> : (
            <ul className="rows">
              {history.map(h => (
                <li key={h.id}>
                  <span className="num" style={{ minWidth: 110, fontWeight: 700 }}>{fmtDate(h.done_date)}</span>
                  <div className="grow"><div>{h.notes || <span className="mute">—</span>}</div><div className="sub">Valid to {fmtDate(h.next_due)} · <Person id={h.recorded_by} fallback="—" /></div></div>
                  {h.document_url && <a href={h.document_url} target="_blank" rel="noreferrer" className="icon-btn" aria-label="Document"><Icon.File /></a>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </FormModal>
  );
}

function RenewForm({ item, onClose }) {
  const { refreshTables } = useData();
  const toast = useToast();
  const [f, setF] = useState({ done_date: todayStr(), next_due: item.frequency_months ? addInterval(todayStr(), item.frequency_months, 'month') : '', notes: '', document_url: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v, ...(k === 'done_date' && item.frequency_months && v ? { next_due: addInterval(v, item.frequency_months, 'month') } : {}) }));
  async function save() {
    setBusy(true);
    try {
      await db.insert('compliance_events', { item_id: item.id, done_date: f.done_date, next_due: f.next_due || null, notes: f.notes || null, document_url: f.document_url || null });
      toast(`${item.name} renewed.`);
      refreshTables('compliance_items');
      onClose();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }
  return (
    <FormModal title={`Record renewal · ${item.name}`} onClose={onClose} onSubmit={save} busy={busy} error={error} submitLabel="Save renewal">
      <div className="form-grid">
        <Field label="Done / issued on" required><input className="input" type="date" required value={f.done_date} onChange={e => set('done_date', e.target.value)} /></Field>
        <Field label="Valid until" hint={item.frequency_months ? `Calculated from the ${item.frequency_months}-month cycle.` : undefined}><input className="input" type="date" value={f.next_due} onChange={e => set('next_due', e.target.value)} /></Field>
        <Field label="Document link" span><input className="input" type="url" value={f.document_url} onChange={e => set('document_url', e.target.value)} placeholder="https://" /></Field>
        <Field label="Notes" span><input className="input" value={f.notes} onChange={e => set('notes', e.target.value)} placeholder="e.g. Permit no., OR no., inspector" /></Field>
      </div>
    </FormModal>
  );
}
