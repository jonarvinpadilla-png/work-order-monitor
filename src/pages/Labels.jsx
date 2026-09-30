import { useEffect, useMemo, useState } from 'react';
import { useData } from '../data/DataProvider';
import { admin, db } from '../data/api';
import { useAction } from '../components/Toast';
import { Card, PageHead, SearchBox, Segmented, Tabs } from '../components/ui';
import QrCode from '../components/QrCode';
import { Icon } from '../lib/icons';
import { useRoute } from '../lib/router';
import { isMheUnit, locationPath, locationTree } from '../lib/domain';
import { labelBase, labelUrl, placePath, unitPath } from '../lib/links';

// Sheet layouts match common A4 label sheets (Avery L7160 and L7165, or any
// sheet with the same label size); plain paper cut along the guides works too.
const SIZES = {
  small: { label: 'Small · 21 per sheet', note: '63.5 × 38.1 mm, 3 across, 7 down', perPage: 21 },
  large: { label: 'Large · 8 per sheet', note: '99.1 × 67.7 mm, 2 across, 4 down', perPage: 8 }
};

function readSize() {
  try { return SIZES[localStorage.getItem('cmms.labelSize')] ? localStorage.getItem('cmms.labelSize') : 'small'; } catch { return 'small'; }
}

export default function Labels() {
  const { assets, locations, categories, lookup, settings, isAdmin, inSite, siteId } = useData();
  const route = useRoute();
  const [tab, setTab] = useState(route.query.get('place') ? 'places' : 'assets');
  const [size, setSizeState] = useState(readSize);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(route.query.get('filter') === 'mhe' ? 'mhe' : '');
  const [picked, setPicked] = useState(() => new Set([
    route.query.get('asset') && `a:${route.query.get('asset')}`,
    route.query.get('place') && `p:${route.query.get('place')}`
  ].filter(Boolean)));
  const base = labelBase(settings);

  const setSize = s => {
    setSizeState(s);
    try { localStorage.setItem('cmms.labelSize', s); } catch { /* storage unavailable */ }
  };

  const q = search.trim().toLowerCase();
  const assetRows = useMemo(() => assets
    .filter(a => inSite(a) && a.status !== 'Decommissioned')
    .filter(a => !category || (category === 'mhe' ? isMheUnit(a) : a.category_id === category))
    .filter(a => !q || `${a.code} ${a.name} ${lookup.location[a.location_id]?.name || ''}`.toLowerCase().includes(q))
    .sort((a, b) => a.code.localeCompare(b.code)), [assets, inSite, category, q, lookup.location]);
  const placeRows = useMemo(() => locationTree(locations, siteId)
    .filter(l => !q || locationPath(l, lookup.location).toLowerCase().includes(q)), [locations, siteId, q, lookup.location]);

  const rows = tab === 'assets' ? assetRows.map(a => `a:${a.id}`) : placeRows.map(l => `p:${l.id}`);
  const toggle = key => setPicked(s => {
    const next = new Set(s);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const pickAll = () => setPicked(s => new Set([...s, ...rows]));
  const clear = () => setPicked(s => new Set([...s].filter(k => !rows.includes(k))));

  // What goes on each label, assets first, then places.
  const items = useMemo(() => {
    const out = [];
    for (const key of picked) {
      const [kind, id] = [key.slice(0, 1), key.slice(2)];
      if (kind === 'a' && lookup.asset[id]) {
        const a = lookup.asset[id];
        out.push({
          key, sort: `0${a.code}`, path: unitPath(a), tag: a.code, mhe: isMheUnit(a), name: a.name,
          where: lookup.location[a.location_id]?.name || lookup.site[a.site_id]?.name || '',
          cta: isMheUnit(a) ? 'Scan: pre-use check or report a problem' : 'Scan to report a problem'
        });
      } else if (kind === 'p' && lookup.location[id]) {
        const l = lookup.location[id];
        const parent = l.parent_id ? locationPath(lookup.location[l.parent_id], lookup.location) : lookup.site[l.site_id]?.name;
        out.push({ key, sort: `1${locationPath(l, lookup.location)}`, path: placePath(l), tag: l.name, place: true, name: parent || '', where: '', cta: 'Scan to report a problem here' });
      }
    }
    return out.sort((x, y) => x.sort.localeCompare(y.sort));
  }, [picked, lookup]);

  const perPage = SIZES[size].perPage;
  const pages = [];
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
  const pickedAssets = [...picked].filter(k => k.startsWith('a:')).length;

  return (
    <>
      <div className="no-print">
        <PageHead eyebrow="Equipment" title="QR labels"
          sub="Stick these on equipment and in rooms. Scanning one with a phone camera opens that unit or place in the CMMS, ready to report a problem or run a pre-use check."
          actions={<button className="btn btn-primary" disabled={!items.length || !base} onClick={() => window.print()}>
            <Icon.Printer />{items.length ? `Print ${items.length} label${items.length === 1 ? '' : 's'}` : 'Print'}
          </button>} />
        <AddressNote base={base} fixed={!!settings.label_base_url} isAdmin={isAdmin} />

        <div className="labels-layout">
          <Card title="Choose what to label">
            <Tabs value={tab} onChange={setTab} items={[
              { value: 'assets', label: 'Assets', count: pickedAssets || undefined },
              { value: 'places', label: 'Places', count: (picked.size - pickedAssets) || undefined }
            ]} />
            <div className="toolbar">
              <SearchBox value={search} onChange={setSearch} placeholder={tab === 'assets' ? 'Tag, name or area' : 'Place name'} />
              {tab === 'assets' && (
                <select className="select" value={category} onChange={e => setCategory(e.target.value)} aria-label="Category">
                  <option value="">All assets</option>
                  <option value="mhe">MHE units only</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>
            <div className="page-actions" style={{ marginBottom: 8 }}>
              <button className="btn btn-sm" onClick={pickAll} disabled={!rows.length}>Select all {rows.length}</button>
              <button className="btn btn-sm btn-quiet" onClick={clear}>Clear</button>
            </div>
            <ul className="pick-list">
              {tab === 'assets' && assetRows.map(a => (
                <li key={a.id}>
                  <label className="check">
                    <input type="checkbox" checked={picked.has(`a:${a.id}`)} onChange={() => toggle(`a:${a.id}`)} />
                    <span className={`tag ${isMheUnit(a) ? 'mhe' : ''}`}>{a.code}</span>
                    <span className="grow">{a.name}<span className="mute"> · {lookup.location[a.location_id]?.name || '—'}</span></span>
                  </label>
                </li>
              ))}
              {tab === 'places' && placeRows.map(l => (
                <li key={l.id} style={{ paddingLeft: l.depth * 18 }}>
                  <label className="check">
                    <input type="checkbox" checked={picked.has(`p:${l.id}`)} onChange={() => toggle(`p:${l.id}`)} />
                    <Icon.Pin className="pick-pin" />
                    <span className="grow">{l.name}{l.kind && <span className="mute"> · {l.kind}</span>}</span>
                  </label>
                </li>
              ))}
              {!rows.length && <li className="mute">Nothing matches.</li>}
            </ul>
          </Card>

          <Card title="Label size">
            <Segmented label="Label size" value={size} onChange={setSize}
              items={Object.entries(SIZES).map(([value, s]) => ({ value, label: s.label }))} />
            <p className="dim" style={{ fontSize: 14 }}>{SIZES[size].note}. Print at <b>100%</b> (Actual size) with margins left at <b>Default</b>.</p>
            <p className="dim" style={{ fontSize: 14, marginBottom: 0 }}>
              Laminate labels for docks, cold rooms and trucks. Test one label with a phone before printing a full sheet.
              If you change an asset's tag, reprint its label.
            </p>
          </Card>
        </div>

        {!items.length && <p className="mute">Tick assets or places to see the labels here.</p>}
      </div>

      {base && items.length > 0 && (
        <div className="label-sheets" aria-label="Label preview">
          {pages.map((page, i) => (
            <div key={i} className={`label-page ${size}`}>
              {page.map(it => <Label key={it.key} item={it} url={labelUrl(base, it.path)} />)}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Label({ item, url }) {
  return (
    <div className={`qr-label ${item.place ? 'place' : ''}`}>
      <QrCode className="qr-label-code" text={url} title={`QR code for ${item.tag}`} />
      <div className="qr-label-text">
        <div className="qr-label-brand">HLPI Facilities</div>
        <div className={`qr-label-tag ${item.mhe ? 'mhe' : ''}`}>{item.tag}</div>
        {item.name && <div className="qr-label-name">{item.name}</div>}
        {item.where && <div className="qr-label-where">{item.where}</div>}
        <div className="qr-label-cta">{item.cta}</div>
      </div>
    </div>
  );
}

// Which address the codes will open, and how to fix it if phones can't use it.
function AddressNote({ base, fixed, isAdmin }) {
  const { refreshTables } = useData();
  const [run, busy] = useAction();
  const [value, setValue] = useState('');
  useEffect(() => {
    if (base || !isAdmin) return;
    admin.info().then(info => setValue(v => v || info.urls.find(u => !u.includes('localhost')) || '')).catch(() => {});
  }, [base, isAdmin]);

  if (base && fixed) {
    return <div className="form-note labels-note">Labels open <b>{base}</b>.{isAdmin && ' You can change this under Settings → General.'}</div>;
  }
  if (base) {
    return (
      <div className="form-note labels-note">
        Labels will open <b>{base}</b>, the address you are using now. If this server PC's address can change, ask IT to reserve a fixed one
        and {isAdmin ? 'set it under Settings → General' : 'ask a CMMS admin to set it under Settings → General'} before printing.
      </div>
    );
  }
  if (!isAdmin) {
    return <div className="form-error labels-note">Phones can't open "localhost". Ask a CMMS admin to set the address phones use under Settings → General, then print.</div>;
  }
  return (
    <form className="form-error labels-note labels-address" onSubmit={e => {
      e.preventDefault();
      run(async () => { await db.update('app_settings', 1, { label_base_url: value }); await refreshTables('app_settings'); }, 'Label address saved.');
    }}>
      <span>Phones can't open "localhost". Enter the address phones use to reach this server:</span>
      <input className="input mono" value={value} onChange={e => setValue(e.target.value)} placeholder="http://192.168.1.20:8080" aria-label="Address phones use" required />
      <button className="btn btn-primary" disabled={busy}>Save address</button>
    </form>
  );
}
