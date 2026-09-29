import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon } from '../lib/icons';
import { href } from '../lib/router';
import { ASSET_TONE, PRIORITY_TONE, STATUS_TONE } from '../lib/constants';
import { dueInfo, isMheUnit, locationTree } from '../lib/domain';
import { initials } from '../lib/format';
import { useData } from '../data/DataProvider';

// --------------------------------------------------------------- badges
export function Badge({ tone = 'muted', icon: I, children, title }) {
  return (
    <span className={`badge ${tone}`} title={title}>
      {I ? <I /> : tone !== 'outline' && tone !== 'plain' ? <span className="dot" /> : null}
      {children}
    </span>
  );
}

export const StatusBadge = ({ status }) => <Badge tone={STATUS_TONE[status]}>{status}</Badge>;

export function PriorityBadge({ priority }) {
  return <Badge tone={PRIORITY_TONE[priority]} icon={priority === 'Critical' ? Icon.Alert : null}>{priority}</Badge>;
}

export function AssetStatusBadge({ status }) {
  const icon = status === 'Out of Service' ? Icon.Lock : status === 'Needs Attention' ? Icon.Alert : null;
  return <Badge tone={ASSET_TONE[status]} icon={icon}>{status}</Badge>;
}

export function DueBadge({ wo }) {
  const d = dueInfo(wo);
  return <Badge tone={d.tone === 'muted' ? 'plain' : d.tone} icon={d.tone === 'danger' ? Icon.Clock : null}>{d.label}</Badge>;
}

// Asset tag chip. MHE units look like the unit number painted on the truck.
export function AssetTag({ asset, link = true, size }) {
  if (!asset) return null;
  const cls = `tag ${isMheUnit(asset) ? 'mhe' : ''} ${size === 'lg' ? 'lg' : ''}`;
  if (!link) return <span className={cls}>{asset.code}</span>;
  return <a className={cls} href={href(`/assets/${asset.id}`)} onClick={e => e.stopPropagation()}>{asset.code}</a>;
}

export const WoCode = ({ code }) => <span className="tag wo">{code}</span>;

export function Lockout({ title = 'Out of service — do not operate', children }) {
  return (
    <div className="lockout" role="alert">
      <div className="lockout-band" />
      <div className="lockout-body">
        <Icon.Octagon />
        <div>
          <div className="lockout-title">{title}</div>
          {children && <div className="dim">{children}</div>}
        </div>
      </div>
    </div>
  );
}

export function HourMeter({ value }) {
  if (value === null || value === undefined) return <span className="mute">No reading</span>;
  const [whole, dec = '0'] = Number(value).toFixed(1).split('.');
  return (
    <span className="hourmeter" title={`${value} hours`}>
      {whole.padStart(5, '0').split('').map((c, i) => <span key={i}>{c}</span>)}
      <span className="dec">{dec}</span>
      <em>h</em>
    </span>
  );
}

// --------------------------------------------------------------- people
export function Avatar({ name, system }) {
  if (system) return <span className="avatar sys"><Icon.Gear /></span>;
  return <span className="avatar" aria-hidden="true">{initials(name)}</span>;
}

export function personName(p) {
  return p ? (p.full_name || p.email) : null;
}

export function Person({ id, fallback = 'Unassigned' }) {
  const { lookup } = useData();
  const p = lookup.profile[id];
  return <span className={p ? '' : 'mute'}>{personName(p) || fallback}</span>;
}

// ---------------------------------------------------------------- layout
export function PageHead({ eyebrow, title, sub, actions, back }) {
  return (
    <>
      {back && <a className="back-link" href={href(back.to)}><Icon.ChevronLeft />{back.label}</a>}
      <div className="page-head">
        <div>
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h1 className="page-title">{title}</h1>
          {sub && <p className="page-sub">{sub}</p>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
    </>
  );
}

export function Card({ title, actions, children, foot, className = '', bodyClass = 'card-body' }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          {title && <h2 className="card-title">{title}</h2>}
          {actions && <div className="page-actions">{actions}</div>}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
      {foot && <div className="card-foot">{foot}</div>}
    </section>
  );
}

export function Tile({ label, value, unit, sub, tone, icon: I, onClick }) {
  return (
    <div className={`tile ${tone ? 'tone-' + tone : ''} ${onClick ? 'clickable' : ''}`} onClick={onClick}
         role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
         onKeyDown={onClick ? e => { if (e.key === 'Enter') onClick(); } : undefined}>
      <div className="tile-label">{I && <I />}{label}</div>
      <div className="tile-value">{value ?? '—'}{unit && value !== null && value !== undefined && <small>{unit}</small>}</div>
      {sub && <div className="tile-sub">{sub}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Loading({ label = 'Loading…' }) {
  return <div className="loading"><div className="spinner" /><span>{label}</span></div>;
}

export function Tabs({ items, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {items.map(t => (
        <button key={t.value} role="tab" aria-selected={value === t.value} className={value === t.value ? 'on' : ''} onClick={() => onChange(t.value)}>
          {t.label}{t.count !== undefined && <span className="count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Segmented({ items, value, onChange, label }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {items.map(t => (
        <button key={t.value} className={value === t.value ? 'on' : ''} aria-pressed={value === t.value} onClick={() => onChange(t.value)}>
          {t.icon && <t.icon />}{t.label}
        </button>
      ))}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = 'Search' }) {
  return (
    <label className="search">
      <Icon.Search />
      <span className="sr-only">{placeholder}</span>
      <input className="input" type="search" value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </label>
  );
}

// ----------------------------------------------------------------- modal
export function Modal({ title, onClose, children, footer, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const first = ref.current?.querySelector('input, select, textarea, button:not(.icon-btn)');
    first?.focus();
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="modal-scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <h2 className="modal-title">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon.X /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

// A modal whose body is a form; Enter submits.
export function FormModal({ title, onClose, onSubmit, busy, submitLabel = 'Save', error, children, wide, extraFooter }) {
  const formId = useId();
  return (
    <Modal title={title} onClose={onClose} wide={wide} footer={
      <>
        {extraFooter && <div className="left">{extraFooter}</div>}
        <button type="button" className="btn btn-quiet" onClick={onClose}>Cancel</button>
        <button type="submit" form={formId} className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
      </>
    }>
      <form id={formId} onSubmit={e => { e.preventDefault(); onSubmit(); }}>
        {error && <div className="form-error" style={{ marginBottom: 14 }}>{error}</div>}
        {children}
      </form>
    </Modal>
  );
}

// ----------------------------------------------------------------- forms
export function Field({ label, required, hint, span, children }) {
  return (
    <label className={`field ${span ? 'span-2' : ''}`}>
      <span className="field-label">{label}{required && <span className="req" aria-hidden="true">*</span>}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function ConfirmButton({ children, confirmLabel = 'Confirm delete', onConfirm, className = 'btn btn-danger btn-sm', disabled }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button type="button" className={className} disabled={disabled} onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>
      {armed ? confirmLabel : children}
    </button>
  );
}

// Searchable single-select for long lists (assets, parts).
export function Combobox({ options, value, onChange, placeholder = 'Search…', id }) {
  const selected = options.find(o => o.value === value);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef(null);
  const filtered = useMemo(() => {
    const s = text.trim().toLowerCase();
    const list = s ? options.filter(o => `${o.label} ${o.search || ''}`.toLowerCase().includes(s)) : options;
    return list.slice(0, 60);
  }, [options, text]);
  useEffect(() => {
    const close = e => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const pick = o => { onChange(o ? o.value : ''); setText(''); setOpen(false); };
  return (
    <div className="combo" ref={wrap}>
      <input
        id={id}
        className="input"
        role="combobox"
        aria-expanded={open}
        value={open ? text : (selected ? selected.label : '')}
        placeholder={selected ? selected.label : placeholder}
        onFocus={() => { setOpen(true); setText(''); setActive(0); }}
        onChange={e => { setText(e.target.value); setOpen(true); setActive(0); }}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, filtered.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
          else if (e.key === 'Enter' && open) { e.preventDefault(); if (filtered[active]) pick(filtered[active]); }
          else if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); }
        }}
      />
      {value && !open && (
        <button type="button" className="icon-btn combo-clear" aria-label="Clear" onClick={() => pick(null)}><Icon.X /></button>
      )}
      {open && (
        <ul className="combo-list" role="listbox">
          {filtered.length === 0 && <li className="mute">No matches</li>}
          {filtered.map((o, i) => (
            <li key={o.value} role="option" aria-selected={o.value === value} className={i === active ? 'active' : ''}
                onMouseDown={e => { e.preventDefault(); pick(o); }} onMouseEnter={() => setActive(i)}>
              {o.tag}{o.tag ? <span>{o.name}</span> : <span>{o.label}</span>}
              {o.sub && <span className="sub">{o.sub}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AssetPicker({ value, onChange, siteId, filter = () => true, placeholder = 'Search by tag or name' }) {
  const { assets, lookup } = useData();
  const options = useMemo(() => assets
    .filter(a => a.status !== 'Decommissioned' || a.id === value)
    .filter(a => !siteId || a.site_id === siteId)
    .filter(filter)
    .map(a => ({
      value: a.id,
      label: `${a.code} — ${a.name}`,
      name: a.name,
      tag: <AssetTag asset={a} link={false} />,
      sub: lookup.location[a.location_id]?.name,
      search: `${a.mhe_type || ''} ${lookup.location[a.location_id]?.name || ''}`
    })), [assets, lookup, siteId, value, filter]);
  return <Combobox options={options} value={value || ''} onChange={onChange} placeholder={placeholder} />;
}

export function LocationSelect({ value, onChange, siteId, emptyLabel = '— None —' }) {
  const { locations } = useData();
  const tree = useMemo(() => locationTree(locations, siteId), [locations, siteId]);
  return (
    <select className="select" value={value || ''} onChange={e => onChange(e.target.value)}>
      <option value="">{emptyLabel}</option>
      {tree.map(l => <option key={l.id} value={l.id}>{' '.repeat(l.depth)}{l.name}</option>)}
    </select>
  );
}

export function PersonSelect({ value, onChange, staffOnly = true, emptyLabel = 'Unassigned' }) {
  const { profiles } = useData();
  const people = profiles.filter(p => p.active && (!staffOnly || p.role !== 'requester'));
  return (
    <select className="select" value={value || ''} onChange={e => onChange(e.target.value)}>
      <option value="">{emptyLabel}</option>
      {people.map(p => <option key={p.id} value={p.id}>{personName(p)}{p.trade ? ` · ${p.trade}` : ''}</option>)}
    </select>
  );
}

export function VendorSelect({ value, onChange, emptyLabel = '— None —' }) {
  const { vendors } = useData();
  return (
    <select className="select" value={value || ''} onChange={e => onChange(e.target.value)}>
      <option value="">{emptyLabel}</option>
      {vendors.filter(v => v.active || v.id === value).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
    </select>
  );
}

export function SiteSelect({ value, onChange, allowAll }) {
  const { sites } = useData();
  return (
    <select className="select" value={value || ''} onChange={e => onChange(e.target.value)}>
      {allowAll && <option value="">All sites</option>}
      {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  );
}

export function Options({ values, empty }) {
  return (
    <>
      {empty !== undefined && <option value="">{empty}</option>}
      {values.map(v => typeof v === 'string'
        ? <option key={v} value={v}>{v}</option>
        : <option key={v.value} value={v.value}>{v.label}</option>)}
    </>
  );
}

// ---------------------------------------------------------------- table
// columns: { key, label, render(row), sort(row), right, className }
export function DataTable({ columns, rows, onRowClick, initialSort, pageSize = 50, empty = 'Nothing to show.' }) {
  const [sort, setSort] = useState(initialSort || null);
  const [limit, setLimit] = useState(pageSize);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find(c => c.key === sort.key);
    if (!col?.sort) return rows;
    const dir = sort.dir === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => {
      const x = col.sort(a), y = col.sort(b);
      if (x === y) return 0;
      if (x === null || x === undefined || x === '') return 1;
      if (y === null || y === undefined || y === '') return -1;
      return (x > y ? 1 : -1) * dir;
    });
  }, [rows, sort, columns]);
  useEffect(() => setLimit(pageSize), [rows, pageSize]);
  if (!rows.length) return <EmptyState title="No results">{empty}</EmptyState>;
  const toggle = c => {
    if (!c.sort) return;
    setSort(s => s?.key === c.key ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: 'asc' });
  };
  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {columns.map(c => (
                <th key={c.key} className={`${c.sort ? 'sortable' : ''} ${c.right ? 'right' : ''}`} onClick={() => toggle(c)}
                    aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  {c.label}{sort?.key === c.key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, limit).map(r => (
              <tr key={r.id} className={onRowClick ? 'clickable' : ''} onClick={onRowClick ? () => onRowClick(r) : undefined}>
                {columns.map(c => <td key={c.key} className={`${c.right ? 'right' : ''} ${c.className || ''}`}>{c.render ? c.render(r) : r[c.key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-foot">
        <span>Showing {Math.min(limit, sorted.length)} of {sorted.length}</span>
        {limit < sorted.length && <button className="btn btn-sm" onClick={() => setLimit(l => l + pageSize * 2)}>Show more</button>}
      </div>
    </>
  );
}
