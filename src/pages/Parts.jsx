import { useEffect, useMemo, useState } from 'react';
import { useData } from '../data/DataProvider';
import { db } from '../data/api';
import { useToast } from '../components/Toast';
import { Badge, Combobox, ConfirmButton, DataTable, Field, FormModal, Modal, Options, PageHead, Person, SearchBox, Segmented, Tile, VendorSelect } from '../components/ui';
import { Icon } from '../lib/icons';
import { href, useRoute } from '../lib/router';
import { PART_UNITS } from '../lib/constants';
import { stockInfo } from '../lib/domain';
import { fmtDateTime, fmtMoney, fmtNum } from '../lib/format';
import { downloadCsv } from '../lib/csv';

export default function Parts() {
  const { parts, lookup, inSite } = useData();
  const route = useRoute();
  const [f, setF] = useState({ search: '', category: '', low: route.query.get('low') === '1' });
  const [modal, setModal] = useState(null); // { kind: 'new' | 'part' | 'receive', part? }
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const mine = parts.filter(p => inSite(p) && p.active);
  const categories = [...new Set(mine.map(p => p.category).filter(Boolean))].sort();

  const rows = useMemo(() => mine.filter(p => {
    if (f.category && p.category !== f.category) return false;
    if (f.low && !stockInfo(p).low) return false;
    const q = f.search.trim().toLowerCase();
    return !q || `${p.part_no} ${p.name} ${p.description || ''} ${p.bin_location || ''}`.toLowerCase().includes(q);
  }), [mine, f]);

  const value = mine.reduce((s, p) => s + Number(p.qty_on_hand) * Number(p.unit_cost), 0);
  const low = mine.filter(p => stockInfo(p).low);

  const columns = [
    { key: 'no', label: 'Part no.', sort: p => p.part_no, render: p => <span className="tag part">{p.part_no}</span> },
    { key: 'name', label: 'Part', sort: p => p.name, render: p => <><div className="cell-title">{p.name}</div><div className="cell-sub">{p.category || 'Uncategorised'}{p.vendor_id ? ` · ${lookup.vendor[p.vendor_id]?.name}` : ''}</div></> },
    { key: 'bin', label: 'Bin', sort: p => p.bin_location, render: p => <span className="mono">{p.bin_location || '—'}</span> },
    {
      key: 'qty', label: 'On hand', right: true, sort: p => Number(p.qty_on_hand),
      render: p => { const s = stockInfo(p); return <><div className="num" style={{ fontWeight: 700 }}>{fmtNum(p.qty_on_hand)} {p.unit}</div>{s.low && <Badge tone={s.tone}>{s.label}</Badge>}</>; }
    },
    { key: 'minmax', label: 'Min / max', right: true, render: p => <span className="num dim">{fmtNum(p.min_qty)} / {p.max_qty === null ? '—' : fmtNum(p.max_qty)}</span> },
    { key: 'cost', label: 'Unit cost', right: true, sort: p => Number(p.unit_cost), render: p => <span className="num">{fmtMoney(p.unit_cost, true)}</span> },
    { key: 'value', label: 'Stock value', right: true, sort: p => Number(p.qty_on_hand) * Number(p.unit_cost), render: p => <span className="num">{fmtMoney(Number(p.qty_on_hand) * Number(p.unit_cost))}</span> }
  ];

  function exportCsv() {
    downloadCsv(`parts-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Part no.', 'Name', 'Category', 'Unit', 'Bin', 'On hand', 'Min', 'Max', 'Reorder qty (to max)', 'Unit cost', 'Stock value', 'Supplier'],
      rows.map(p => [p.part_no, p.name, p.category, p.unit, p.bin_location, p.qty_on_hand, p.min_qty, p.max_qty,
        stockInfo(p).low && p.max_qty !== null ? Math.max(0, Number(p.max_qty) - Number(p.qty_on_hand)) : '',
        p.unit_cost, (Number(p.qty_on_hand) * Number(p.unit_cost)).toFixed(2), lookup.vendor[p.vendor_id]?.name]));
  }

  return (
    <>
      <PageHead eyebrow="Equipment" title="Parts & stock" sub="Spares and consumables in the maintenance store. Issue parts from a work order to charge them to the job."
                actions={<>
                  <button className="btn" onClick={exportCsv}><Icon.Download />Export CSV</button>
                  <button className="btn" onClick={() => setModal({ kind: 'receive' })}><Icon.Package />Receive stock</button>
                  <button className="btn btn-primary" onClick={() => setModal({ kind: 'new' })}><Icon.Plus />Add part</button>
                </>} />
      <div className="tiles">
        <Tile label="Parts stocked" value={mine.length} />
        <Tile label="To reorder" value={low.length} tone={low.length ? 'warn' : 'good'} sub="At or below minimum" onClick={() => set('low', true)} />
        <Tile label="Out of stock" value={mine.filter(p => Number(p.qty_on_hand) <= 0).length} tone={mine.some(p => Number(p.qty_on_hand) <= 0) ? 'danger' : null} />
        <Tile label="Stock value" value={fmtMoney(value)} />
      </div>
      <div className="toolbar">
        <SearchBox value={f.search} onChange={v => set('search', v)} placeholder="Part number, name or bin" />
        <select className="select" value={f.category} onChange={e => set('category', e.target.value)} aria-label="Category"><Options values={categories} empty="All categories" /></select>
        <Segmented label="Stock" value={f.low ? 'low' : 'all'} onChange={v => set('low', v === 'low')} items={[{ value: 'all', label: 'All parts' }, { value: 'low', label: 'To reorder' }]} />
      </div>
      <div className="card">
        <DataTable columns={columns} rows={rows} onRowClick={p => setModal({ kind: 'part', part: p })} initialSort={{ key: 'name', dir: 'asc' }}
                   empty={f.low ? 'Nothing needs reordering.' : 'No parts yet. Add the spares you keep in the store.'} />
      </div>
      {modal?.kind === 'new' && <PartForm onClose={() => setModal(null)} />}
      {modal?.kind === 'part' && <PartDetail part={lookup.part[modal.part.id] || modal.part} onClose={() => setModal(null)} />}
      {modal?.kind === 'receive' && <StockModal kind="Receive" onClose={() => setModal(null)} />}
    </>
  );
}

function PartForm({ part, onClose }) {
  const { sites, siteId, refreshTables } = useData();
  const toast = useToast();
  const editing = !!part;
  const [f, setF] = useState({ part_no: '', name: '', description: '', category: '', unit: 'pc', bin_location: '', min_qty: 0, max_qty: '', unit_cost: 0, vendor_id: '', opening: '', site_id: siteId || sites[0]?.id || null, ...(part || {}) });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  async function save() {
    setError('');
    if (!f.name.trim()) { setError('Name the part.'); return; }
    const row = {
      part_no: f.part_no?.trim() || null, name: f.name.trim(), description: f.description?.trim() || null, category: f.category?.trim() || null,
      unit: f.unit, bin_location: f.bin_location?.trim() || null, min_qty: f.min_qty || 0, max_qty: f.max_qty === '' || f.max_qty === null ? null : f.max_qty,
      unit_cost: f.unit_cost || 0, vendor_id: f.vendor_id || null, site_id: f.site_id || null
    };
    setBusy(true);
    try {
      if (editing) {
        await db.update('parts', part.id, row);
        toast('Part updated.');
      } else {
        const created = await db.insert('parts', row);
        if (Number(f.opening) > 0) await db.insert('part_transactions', { part_id: created.id, kind: 'Receive', qty: Number(f.opening), unit_cost: row.unit_cost, reference: 'Opening balance' });
        toast(`Part ${created.part_no} added.`);
      }
      refreshTables('parts');
      onClose();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }
  return (
    <FormModal title={editing ? `Edit ${part.part_no}` : 'Add part'} onClose={onClose} onSubmit={save} busy={busy} error={error}>
      <div className="form-grid">
        <Field label="Part number" hint={editing ? undefined : 'Leave blank to number it automatically.'}><input className="input" value={f.part_no || ''} onChange={e => set('part_no', e.target.value)} style={{ fontFamily: 'var(--font-mono)' }} /></Field>
        <Field label="Name" required><input className="input" value={f.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Load wheel 85 × 100 PU" /></Field>
        <Field label="Category" hint="e.g. MHE – Wheels, Electrical, Refrigeration"><input className="input" value={f.category || ''} onChange={e => set('category', e.target.value)} /></Field>
        <Field label="Unit"><select className="select" value={f.unit} onChange={e => set('unit', e.target.value)}><Options values={PART_UNITS} /></select></Field>
        <Field label="Bin location"><input className="input" value={f.bin_location || ''} onChange={e => set('bin_location', e.target.value)} /></Field>
        <Field label="Unit cost (₱)"><input className="input" type="number" min="0" step="0.01" value={f.unit_cost} onChange={e => set('unit_cost', e.target.value)} /></Field>
        <Field label="Minimum (reorder point)"><input className="input" type="number" min="0" step="any" value={f.min_qty} onChange={e => set('min_qty', e.target.value)} /></Field>
        <Field label="Maximum"><input className="input" type="number" min="0" step="any" value={f.max_qty ?? ''} onChange={e => set('max_qty', e.target.value)} /></Field>
        <Field label="Usual supplier"><VendorSelect value={f.vendor_id} onChange={v => set('vendor_id', v)} /></Field>
        {!editing && <Field label="Quantity on hand now" hint="Recorded as the opening balance."><input className="input" type="number" min="0" step="any" value={f.opening} onChange={e => set('opening', e.target.value)} /></Field>}
        <Field label="Description" span><textarea className="textarea" value={f.description || ''} onChange={e => set('description', e.target.value)} /></Field>
      </div>
    </FormModal>
  );
}

function PartDetail({ part, onClose }) {
  const { isAdmin, workOrders, refreshTables } = useData();
  const toast = useToast();
  const [ledger, setLedger] = useState(null);
  const [sub, setSub] = useState(null); // edit | Receive | Adjust
  const load = () => db.select('part_transactions', q => q.eq('part_id', part.id).order('created_at', { ascending: false }).limit(100)).then(setLedger);
  useEffect(() => { load().catch(() => setLedger([])); }, [part.id, part.qty_on_hand]); // eslint-disable-line react-hooks/exhaustive-deps
  const woCode = id => workOrders.find(w => w.id === id);
  const s = stockInfo(part);
  if (sub === 'edit') return <PartForm part={part} onClose={() => setSub(null)} />;
  if (sub) return <StockModal kind={sub} part={part} onClose={() => setSub(null)} />;
  return (
    <Modal title={`${part.part_no} · ${part.name}`} onClose={onClose} wide footer={<>
      {isAdmin && <div className="left"><ConfirmButton onConfirm={async () => {
        try { await db.update('parts', part.id, { active: false }); toast('Part archived.'); refreshTables('parts'); onClose(); } catch (e) { toast(e.message, 'error'); }
      }} confirmLabel="Archive part">Archive</ConfirmButton></div>}
      <button className="btn" onClick={() => setSub('edit')}><Icon.Edit />Edit</button>
      {isAdmin && <button className="btn" onClick={() => setSub('Adjust')}>Adjust count</button>}
      <button className="btn btn-primary" onClick={() => setSub('Receive')}><Icon.Package />Receive stock</button>
    </>}>
      <div className="tiles" style={{ marginBottom: 12 }}>
        <Tile label="On hand" value={fmtNum(part.qty_on_hand)} unit={` ${part.unit}`} tone={s.low ? s.tone : null} sub={s.label} />
        <Tile label="Min / max" value={`${fmtNum(part.min_qty)} / ${part.max_qty === null ? '—' : fmtNum(part.max_qty)}`} />
        <Tile label="Unit cost" value={fmtMoney(part.unit_cost, true)} sub={`Bin ${part.bin_location || '—'}`} />
      </div>
      {part.description && <p className="dim">{part.description}</p>}
      <h3 className="card-title" style={{ margin: '8px 0' }}>Stock movements</h3>
      {!ledger ? <p className="mute">Loading…</p> : ledger.length === 0 ? <p className="mute">No movements yet.</p> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>When</th><th>Movement</th><th className="right">Qty</th><th>Reference</th><th>By</th></tr></thead>
            <tbody>
              {ledger.map(t => (
                <tr key={t.id}>
                  <td className="nowrap">{fmtDateTime(t.created_at)}</td>
                  <td><Badge tone={t.qty > 0 ? 'good' : 'serious'}>{t.kind}</Badge></td>
                  <td className="right num">{t.qty > 0 ? '+' : ''}{fmtNum(t.qty)}</td>
                  <td>{t.work_order_id ? <a href={href(`/work-orders/${t.work_order_id}`)} className="mono">{woCode(t.work_order_id)?.code || 'Work order'}</a> : (t.reference || t.notes || '—')}</td>
                  <td><Person id={t.created_by} fallback="—" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

function StockModal({ kind, part, onClose }) {
  const { parts, refreshTables } = useData();
  const toast = useToast();
  const [partId, setPartId] = useState(part?.id || '');
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState(part ? part.unit_cost : '');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const chosen = parts.find(p => p.id === partId);
  const options = parts.filter(p => p.active).map(p => ({ value: p.id, label: `${p.part_no} — ${p.name}`, name: p.name, tag: <span className="tag part">{p.part_no}</span>, sub: `${fmtNum(p.qty_on_hand)} ${p.unit}` }));
  async function save() {
    setError('');
    if (!partId) { setError('Choose a part.'); return; }
    if (!Number(qty)) { setError(kind === 'Adjust' ? 'Enter the change, e.g. -2 or 3.' : 'Enter the quantity received.'); return; }
    setBusy(true);
    try {
      await db.insert('part_transactions', {
        part_id: partId, kind, qty: Number(qty),
        unit_cost: kind === 'Receive' && cost !== '' ? Number(cost) : null,
        reference: reference.trim() || null
      });
      toast(kind === 'Receive' ? `Received ${qty} ${chosen?.unit || ''} of ${chosen?.name}.` : 'Stock count adjusted.');
      refreshTables('parts');
      onClose();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }
  return (
    <FormModal title={kind === 'Receive' ? 'Receive stock' : `Adjust count · ${part?.part_no}`} onClose={onClose} onSubmit={save} busy={busy} error={error}
               submitLabel={kind === 'Receive' ? 'Receive' : 'Save adjustment'}>
      <div className="form-grid">
        {!part && <Field label="Part" required span><Combobox options={options} value={partId} onChange={v => { setPartId(v); setCost(parts.find(p => p.id === v)?.unit_cost ?? ''); }} placeholder="Search part number or name" /></Field>}
        <Field label={kind === 'Adjust' ? 'Change (+ / −)' : 'Quantity received'} required hint={chosen ? `On hand now: ${fmtNum(chosen.qty_on_hand)} ${chosen.unit}` : undefined}>
          <input className="input" type="number" step="any" min={kind === 'Receive' ? '0' : undefined} value={qty} onChange={e => setQty(e.target.value)} />
        </Field>
        {kind === 'Receive' && <Field label="Unit cost (₱)" hint="Updates the part's cost."><input className="input" type="number" min="0" step="0.01" value={cost} onChange={e => setCost(e.target.value)} /></Field>}
        <Field label={kind === 'Receive' ? 'PO / delivery receipt no.' : 'Reason'} span>
          <input className="input" value={reference} onChange={e => setReference(e.target.value)} placeholder={kind === 'Receive' ? 'e.g. PO-2609-114 / DR 55821' : 'e.g. Cycle count 30 Sep'} />
        </Field>
      </div>
    </FormModal>
  );
}
