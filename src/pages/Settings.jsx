import { useState } from 'react';
import { useData } from '../data/DataProvider';
import { db } from '../data/api';
import { useAction, useToast } from '../components/Toast';
import { Badge, Card, ConfirmButton, DataTable, EmptyState, Field, FormModal, Options, PageHead, Tabs, personName } from '../components/ui';
import { Icon } from '../lib/icons';
import { LOCATION_KINDS, MHE_TYPES, ROLES, TEMP_ZONES, roleLabel } from '../lib/constants';
import { locationTree } from '../lib/domain';
import { fmtDate } from '../lib/format';

export default function Settings() {
  const { isAdmin } = useData();
  const [tab, setTab] = useState('profile');
  const tabs = [
    { value: 'profile', label: 'My profile' },
    ...(isAdmin ? [
      { value: 'users', label: 'Users & roles' },
      { value: 'places', label: 'Sites & locations' },
      { value: 'categories', label: 'Asset categories' },
      { value: 'checklists', label: 'Pre-use checklists' },
      { value: 'general', label: 'General' }
    ] : [])
  ];
  return (
    <>
      <PageHead eyebrow="Setup" title={isAdmin ? 'Settings' : 'My profile'} />
      {tabs.length > 1 && <Tabs items={tabs} value={tab} onChange={setTab} />}
      {tab === 'profile' && <Profile />}
      {tab === 'users' && <Users />}
      {tab === 'places' && <Places />}
      {tab === 'categories' && <Categories />}
      {tab === 'checklists' && <Checklists />}
      {tab === 'general' && <General />}
    </>
  );
}

function Profile() {
  const { me, refreshTables } = useData();
  const [run, busy] = useAction();
  const [f, setF] = useState({ full_name: me.full_name || '', phone: me.phone || '', trade: me.trade || '' });
  return (
    <div className="card card-pad" style={{ maxWidth: 620 }}>
      <form onSubmit={e => { e.preventDefault(); run(async () => { await db.update('profiles', me.id, { full_name: f.full_name.trim() || null, phone: f.phone || null, trade: f.trade || null }); await refreshTables('profiles'); }, 'Profile saved.'); }}>
        <div className="form-grid">
          <Field label="Full name" span><input className="input" value={f.full_name} onChange={e => setF({ ...f, full_name: e.target.value })} /></Field>
          <Field label="Mobile number"><input className="input" type="tel" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Trade / department"><input className="input" value={f.trade} onChange={e => setF({ ...f, trade: e.target.value })} placeholder="e.g. Electrical, Refrigeration, Warehouse ops" /></Field>
          <Field label="Email"><input className="input" value={me.email || ''} readOnly /></Field>
          <Field label="Role"><input className="input" value={roleLabel(me.role)} readOnly /></Field>
        </div>
        <div style={{ marginTop: 16 }}><button className="btn btn-primary" disabled={busy}>Save profile</button></div>
      </form>
    </div>
  );
}

function Users() {
  const { profiles, me, refreshTables } = useData();
  const [run] = useAction();
  const update = (p, patch, msg) => run(async () => { await db.update('profiles', p.id, patch); await refreshTables('profiles'); }, msg);
  return (
    <>
      <div className="form-note" style={{ marginBottom: 14 }}>
        Colleagues create their own account on the sign-in page and start as <b>Requesters</b>. Give technicians and managers their role here.
        To stop someone signing in, deactivate them.
      </div>
      <div className="card">
        <DataTable rows={profiles} initialSort={{ key: 'name', dir: 'asc' }}
          columns={[
            { key: 'name', label: 'Person', sort: p => personName(p), render: p => <><div className="cell-title">{personName(p)}{p.id === me.id && <span className="mute"> (you)</span>}</div><div className="cell-sub">{p.email}</div></> },
            { key: 'trade', label: 'Trade', render: p => p.trade || <span className="mute">—</span> },
            {
              key: 'role', label: 'Role', sort: p => p.role,
              render: p => (
                <select className="select" style={{ minWidth: 170 }} value={p.role} aria-label={`Role for ${personName(p)}`}
                        onChange={e => update(p, { role: e.target.value }, `${personName(p)} is now ${roleLabel(e.target.value)}.`)}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              )
            },
            { key: 'since', label: 'Joined', sort: p => p.created_at, render: p => fmtDate(p.created_at) },
            {
              key: 'active', label: 'Access', sort: p => (p.active ? 0 : 1),
              render: p => p.active
                ? (p.id === me.id ? <Badge tone="good">Active</Badge> : <button className="btn btn-sm" onClick={() => update(p, { active: false }, `${personName(p)} deactivated.`)}>Deactivate</button>)
                : <button className="btn btn-sm btn-good" onClick={() => update(p, { active: true }, `${personName(p)} re-activated.`)}>Re-activate</button>
            }
          ]} />
      </div>
      <div className="grid grid-3" style={{ marginTop: 16 }}>
        {ROLES.map(r => <div key={r.value} className="card card-pad"><div className="card-title" style={{ marginBottom: 4 }}>{r.label}</div><div className="dim" style={{ fontSize: 14 }}>{r.help}</div></div>)}
      </div>
    </>
  );
}

function Places() {
  const { sites, locations, assets, refreshTables } = useData();
  const toast = useToast();
  const [siteId, setSiteId] = useState(sites[0]?.id || '');
  const [modal, setModal] = useState(null); // { kind: 'site' | 'location', row?, parent_id? }
  const tree = locationTree(locations, siteId);
  const assetCount = id => assets.filter(a => a.location_id === id).length;
  return (
    <div className="split">
      <Card title="Locations" actions={siteId && <button className="btn btn-sm" onClick={() => setModal({ kind: 'location' })}><Icon.Plus />Add location</button>}>
        {sites.length > 1 && (
          <select className="select" style={{ marginBottom: 12, maxWidth: 280 }} value={siteId} onChange={e => setSiteId(e.target.value)} aria-label="Site">
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        {!siteId ? <EmptyState title="Add your first site">A site is a distribution centre or warehouse. Locations and assets sit under it.</EmptyState>
          : tree.length === 0 ? <p className="mute">No locations yet. Start with buildings, then add rooms, zones and docks under them.</p> : (
            <ul className="rows">
              {tree.map(l => (
                <li key={l.id} style={{ paddingLeft: l.depth * 22 }}>
                  <Icon.Pin style={{ width: 15, height: 15, color: 'var(--ink-3)', flex: 'none' }} />
                  <div className="grow">
                    <div className="title">{l.name}</div>
                    <div className="sub">{[l.kind, l.temp_zone, `${assetCount(l.id)} assets`].filter(Boolean).join(' · ')}</div>
                  </div>
                  <button className="btn btn-sm btn-quiet" onClick={() => setModal({ kind: 'location', parent_id: l.id })}><Icon.Plus />Inside</button>
                  <button className="icon-btn" aria-label={`Edit ${l.name}`} onClick={() => setModal({ kind: 'location', row: l })}><Icon.Edit /></button>
                </li>
              ))}
            </ul>
          )}
      </Card>
      <Card title="Sites" actions={<button className="btn btn-sm" onClick={() => setModal({ kind: 'site' })}><Icon.Plus />Add site</button>}>
        <ul className="rows">
          {sites.map(s => (
            <li key={s.id}>
              <span className="tag">{s.code}</span>
              <div className="grow"><div className="title">{s.name}</div><div className="sub">{s.address}</div></div>
              <button className="icon-btn" aria-label={`Edit ${s.name}`} onClick={() => setModal({ kind: 'site', row: s })}><Icon.Edit /></button>
            </li>
          ))}
        </ul>
      </Card>
      {modal?.kind === 'site' && <SiteForm site={modal.row} onClose={created => { setModal(null); if (created) setSiteId(created); }} />}
      {modal?.kind === 'location' && <LocationForm loc={modal.row} siteId={siteId} parentId={modal.parent_id} onClose={() => setModal(null)} toast={toast} refresh={refreshTables} />}
    </div>
  );
}

function SiteForm({ site, onClose }) {
  const { refreshTables } = useData();
  const toast = useToast();
  const [f, setF] = useState({ code: '', name: '', address: '', ...(site || {}) });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!f.code.trim() || !f.name.trim()) { setError('Enter a short code and a name.'); return; }
    setBusy(true);
    try {
      const row = { code: f.code.trim().toUpperCase(), name: f.name.trim(), address: f.address || null };
      const saved = site ? await db.update('sites', site.id, row) : await db.insert('sites', row);
      toast(site ? 'Site updated.' : 'Site added.');
      await refreshTables('sites');
      onClose(site ? null : saved.id);
    } catch (e) { setError(e.message); }
    setBusy(false);
  }
  return (
    <FormModal title={site ? `Edit ${site.name}` : 'Add site'} onClose={() => onClose()} onSubmit={save} busy={busy} error={error}>
      <div className="form-grid">
        <Field label="Code" required hint="Short, e.g. PLD"><input className="input" value={f.code} onChange={e => setF({ ...f, code: e.target.value })} maxLength={12} /></Field>
        <Field label="Name" required><input className="input" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="e.g. Plaridel DC" /></Field>
        <Field label="Address" span><input className="input" value={f.address || ''} onChange={e => setF({ ...f, address: e.target.value })} /></Field>
      </div>
    </FormModal>
  );
}

function LocationForm({ loc, siteId, parentId, onClose, toast, refresh }) {
  const { locations } = useData();
  const [f, setF] = useState({ name: '', kind: '', temp_zone: '', parent_id: parentId || '', ...(loc || {}) });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const site = loc?.site_id || siteId;
  const parents = locationTree(locations, site).filter(l => l.id !== loc?.id);
  async function save() {
    if (!f.name.trim()) { setError('Name the location.'); return; }
    setBusy(true);
    try {
      const row = { site_id: site, name: f.name.trim(), kind: f.kind || null, temp_zone: f.temp_zone || null, parent_id: f.parent_id || null };
      if (loc) await db.update('locations', loc.id, row); else await db.insert('locations', row);
      toast(loc ? 'Location updated.' : 'Location added.');
      refresh('locations');
      onClose();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }
  return (
    <FormModal title={loc ? `Edit ${loc.name}` : 'Add location'} onClose={onClose} onSubmit={save} busy={busy} error={error}
               extraFooter={loc ? <ConfirmButton onConfirm={async () => { try { await db.remove('locations', loc.id); toast('Location deleted.'); refresh('locations', 'assets'); onClose(); } catch (e) { setError(e.message); } }}>Delete</ConfirmButton> : null}>
      <div className="form-grid">
        <Field label="Name" required span><input className="input" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="e.g. Freezer Room" /></Field>
        <Field label="Inside">
          <select className="select" value={f.parent_id || ''} onChange={e => setF({ ...f, parent_id: e.target.value })}>
            <option value="">— Top level —</option>
            {parents.map(l => <option key={l.id} value={l.id}>{' '.repeat(l.depth)}{l.name}</option>)}
          </select>
        </Field>
        <Field label="Kind"><select className="select" value={f.kind || ''} onChange={e => setF({ ...f, kind: e.target.value })}><Options values={LOCATION_KINDS} empty="—" /></select></Field>
        <Field label="Temperature zone" hint="For cold-chain areas."><select className="select" value={f.temp_zone || ''} onChange={e => setF({ ...f, temp_zone: e.target.value })}><Options values={TEMP_ZONES} empty="Not a storage zone" /></select></Field>
      </div>
    </FormModal>
  );
}

function Categories() {
  const { categories, assets, refreshTables } = useData();
  const [run] = useAction();
  const [name, setName] = useState('');
  const [mhe, setMhe] = useState(false);
  return (
    <Card title="Asset categories">
      <ul className="rows">
        {categories.map(c => (
          <li key={c.id}>
            <div className="grow"><div className="title">{c.name}</div><div className="sub">{assets.filter(a => a.category_id === c.id).length} assets</div></div>
            {c.is_mhe && <Badge tone="warn" icon={Icon.Forklift}>MHE fields</Badge>}
            <ConfirmButton className="btn btn-sm btn-quiet" confirmLabel="Delete?" onConfirm={() => run(async () => { await db.remove('asset_categories', c.id); await refreshTables('asset_categories'); }, 'Category deleted.')}>Delete</ConfirmButton>
          </li>
        ))}
      </ul>
      <form className="inline-form" style={{ marginTop: 12 }} onSubmit={e => {
        e.preventDefault();
        if (!name.trim()) return;
        run(async () => { await db.insert('asset_categories', { name: name.trim(), is_mhe: mhe, sort: (categories.at(-1)?.sort || 0) + 10 }); setName(''); setMhe(false); await refreshTables('asset_categories'); }, 'Category added.');
      }}>
        <Field label="New category"><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Solar PV" /></Field>
        <label className="check" style={{ marginBottom: 8 }}><input type="checkbox" checked={mhe} onChange={e => setMhe(e.target.checked)} /><span>Uses MHE fields</span></label>
        <button className="btn"><Icon.Plus />Add</button>
      </form>
    </Card>
  );
}

function Checklists() {
  const { templates } = useData();
  const [editing, setEditing] = useState(undefined);
  return (
    <>
      <div className="toolbar"><span className="dim">Operators answer these before driving. A failed <b>critical</b> item locks the unit out and raises a Critical work order.</span><span style={{ flex: 1 }} /><button className="btn btn-primary" onClick={() => setEditing(null)}><Icon.Plus />New checklist</button></div>
      <div className="grid grid-2">
        {templates.map(t => (
          <div key={t.id} className="card card-pad" style={{ cursor: 'pointer' }} onClick={() => setEditing(t)}>
            <div className="unit-line"><b>{t.name}</b>{!t.active && <Badge tone="muted">Inactive</Badge>}</div>
            <div className="dim" style={{ fontSize: 13.5, margin: '4px 0 8px' }}>{t.applies_to.join(', ') || 'Not linked to an MHE type'}</div>
            <div className="mute" style={{ fontSize: 13 }}>{t.items.length} items · {t.items.filter(i => i.critical).length} critical</div>
          </div>
        ))}
      </div>
      {editing !== undefined && <ChecklistForm template={editing || undefined} onClose={() => setEditing(undefined)} />}
    </>
  );
}

function ChecklistForm({ template, onClose }) {
  const { refreshTables } = useData();
  const toast = useToast();
  const [f, setF] = useState({ name: '', description: '', applies_to: [], items: [{ text: '', critical: false }], active: true, ...(template || {}) });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const setItem = (i, patch) => setF(x => ({ ...x, items: x.items.map((it, k) => (k === i ? { ...it, ...patch } : it)) }));
  const move = (i, d) => setF(x => { const items = [...x.items]; const j = i + d; if (j < 0 || j >= items.length) return x; [items[i], items[j]] = [items[j], items[i]]; return { ...x, items }; });
  async function save() {
    const items = f.items.map(i => ({ text: i.text.trim(), critical: !!i.critical })).filter(i => i.text);
    if (!f.name.trim() || !items.length) { setError('Give the checklist a name and at least one item.'); return; }
    setBusy(true);
    try {
      const row = { name: f.name.trim(), description: f.description || null, applies_to: f.applies_to, items, active: f.active };
      if (template) await db.update('checklist_templates', template.id, row); else await db.insert('checklist_templates', row);
      toast('Checklist saved.');
      refreshTables('checklist_templates');
      onClose();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }
  return (
    <FormModal title={template ? template.name : 'New pre-use checklist'} onClose={onClose} onSubmit={save} busy={busy} error={error} wide submitLabel="Save checklist"
               extraFooter={template ? <ConfirmButton onConfirm={async () => { try { await db.remove('checklist_templates', template.id); toast('Checklist deleted.'); refreshTables('checklist_templates'); onClose(); } catch (e) { setError(e.message); } }}>Delete</ConfirmButton> : null}>
      <div className="form-grid">
        <Field label="Name" required span><input className="input" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Instructions for the operator" span><input className="input" value={f.description || ''} onChange={e => setF({ ...f, description: e.target.value })} /></Field>
        <div className="span-2">
          <div className="field-label" style={{ marginBottom: 6 }}>Used for these MHE types</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px' }}>
            {MHE_TYPES.filter(t => !['Traction Battery', 'Battery Charger'].includes(t)).map(t => (
              <label key={t} className="check" style={{ fontSize: 14 }}>
                <input type="checkbox" checked={f.applies_to.includes(t)} onChange={e => setF({ ...f, applies_to: e.target.checked ? [...f.applies_to, t] : f.applies_to.filter(x => x !== t) })} />{t}
              </label>
            ))}
          </div>
        </div>
        <div className="span-2">
          <div className="field-label" style={{ marginBottom: 6 }}>Items</div>
          {f.items.map((it, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <span className="mute num" style={{ width: 22, textAlign: 'right' }}>{i + 1}</span>
              <input className="input" value={it.text} onChange={e => setItem(i, { text: e.target.value })} aria-label={`Item ${i + 1}`} />
              <label className="check" style={{ whiteSpace: 'nowrap', fontSize: 14 }}><input type="checkbox" checked={!!it.critical} onChange={e => setItem(i, { critical: e.target.checked })} />Critical</label>
              <button type="button" className="icon-btn" aria-label="Move up" onClick={() => move(i, -1)}><Icon.ChevronLeft style={{ transform: 'rotate(90deg)' }} /></button>
              <button type="button" className="icon-btn" aria-label="Move down" onClick={() => move(i, 1)}><Icon.ChevronRight style={{ transform: 'rotate(90deg)' }} /></button>
              <button type="button" className="icon-btn" aria-label="Remove item" onClick={() => setF({ ...f, items: f.items.filter((_, k) => k !== i) })}><Icon.X /></button>
            </div>
          ))}
          <button type="button" className="btn btn-sm" onClick={() => setF({ ...f, items: [...f.items, { text: '', critical: false }] })}><Icon.Plus />Add item</button>
        </div>
        <label className="check span-2"><input type="checkbox" checked={f.active} onChange={e => setF({ ...f, active: e.target.checked })} /><span>Active</span></label>
      </div>
    </FormModal>
  );
}

function General() {
  const { settings, refreshTables } = useData();
  const [run, busy] = useAction();
  const [f, setF] = useState({ org_name: settings.org_name || '', labor_rate: settings.labor_rate ?? 0, timezone: settings.timezone || 'Asia/Manila' });
  return (
    <div className="card card-pad" style={{ maxWidth: 620 }}>
      <form onSubmit={e => { e.preventDefault(); run(async () => { await db.update('app_settings', 1, { org_name: f.org_name.trim(), labor_rate: f.labor_rate || 0 }); await refreshTables('app_settings'); }, 'Settings saved.'); }}>
        <div className="form-grid">
          <Field label="Organisation name" hint="Printed on job cards." span><input className="input" value={f.org_name} onChange={e => setF({ ...f, org_name: e.target.value })} /></Field>
          <Field label="Standard labour rate (₱ per hour)" hint="Used to cost logged hours. Applies to new entries."><input className="input" type="number" min="0" step="0.01" value={f.labor_rate} onChange={e => setF({ ...f, labor_rate: e.target.value })} /></Field>
          <Field label="Time zone" hint="Used for due dates, work order numbers and PM generation."><input className="input" value={f.timezone} readOnly /></Field>
        </div>
        <div style={{ marginTop: 16 }}><button className="btn btn-primary" disabled={busy}>Save settings</button></div>
      </form>
    </div>
  );
}
