import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useData } from '../data/DataProvider';
import { Icon } from '../lib/icons';
import { href } from '../lib/router';
import { roleLabel } from '../lib/constants';
import { isMheUnit, isOverdue } from '../lib/domain';
import { daysUntil } from '../lib/format';
import { Avatar, personName } from './ui';
import { useGlobalActions } from './GlobalActions';

function isDark() {
  const t = document.documentElement.dataset.theme;
  if (t) return t === 'dark';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

export default function Layout({ section, children }) {
  const { me, isStaff, isAdmin, workOrders, assets, compliance, sites, siteId, setSiteId, inSite } = useData();
  const { newWorkOrder, newRequest } = useGlobalActions();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(isDark);

  useEffect(() => { setOpen(false); }, [section]);

  const toggleTheme = () => {
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('cmms.theme', next); } catch { /* ignore */ }
    setDark(!dark);
  };

  const wos = workOrders.filter(inSite);
  const overdue = wos.filter(w => isOverdue(w)).length;
  const pending = wos.filter(w => w.status === 'Requested').length;
  const locked = assets.filter(a => inSite(a) && isMheUnit(a) && a.status === 'Out of Service').length;
  const expired = compliance.filter(c => inSite(c) && c.active && c.next_due && daysUntil(c.next_due) < 0).length;

  const nav = isStaff ? [
    { group: 'Work' },
    { key: undefined, to: '/', label: 'Dashboard', icon: Icon.Dashboard },
    { key: 'work-orders', to: '/work-orders', label: 'Work orders', icon: Icon.Wrench, count: overdue, alert: overdue > 0, title: 'Overdue' },
    { key: 'requests', to: '/requests', label: 'Requests', icon: Icon.Inbox, count: pending, alert: isAdmin && pending > 0, title: 'Awaiting approval' },
    { key: 'pm', to: '/pm', label: 'Preventive maintenance', icon: Icon.CalendarClock },
    { group: 'Equipment' },
    { key: 'mhe', to: '/mhe', label: 'MHE', icon: Icon.Forklift, count: locked, alert: locked > 0, title: 'Locked out' },
    { key: 'assets', to: '/assets', label: 'Assets', icon: Icon.Box },
    { key: 'parts', to: '/parts', label: 'Parts & stock', icon: Icon.Package },
    { group: 'Contractors & compliance' },
    { key: 'vendors', to: '/vendors', label: 'Vendors & contracts', icon: Icon.Handshake },
    { key: 'compliance', to: '/compliance', label: 'Compliance', icon: Icon.Shield, count: expired, alert: expired > 0, title: 'Expired' },
    { group: 'Setup' },
    { key: 'settings', to: '/settings', label: 'Settings', icon: Icon.Gear }
  ] : [
    { key: undefined, to: '/', label: 'My requests', icon: Icon.Inbox },
    { key: 'mhe', to: '/mhe', label: 'MHE pre-use checks', icon: Icon.Clipboard },
    { key: 'settings', to: '/settings', label: 'My profile', icon: Icon.User }
  ];

  return (
    <div className="app">
      <div className={`scrim ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Main navigation">
        <div className="brand">
          <span className="brand-mark"><Icon.Forklift /></span>
          <div>
            <div className="brand-name">HLPI Facilities</div>
            <div className="brand-sub">CMMS · Facilities &amp; MHE</div>
          </div>
        </div>

        {isStaff && (
          <div style={{ padding: '0 6px 10px' }}>
            <button className="btn btn-primary btn-block" onClick={() => newWorkOrder()}><Icon.Plus />New work order</button>
          </div>
        )}
        {!isStaff && (
          <div style={{ padding: '0 6px 10px' }}>
            <button className="btn btn-primary btn-block" onClick={() => newRequest()}><Icon.Plus />Report a problem</button>
          </div>
        )}

        {sites.length > 1 && (
          <div style={{ padding: '0 6px 8px' }}>
            <label className="sr-only" htmlFor="site-switch">Site</label>
            <select id="site-switch" className="select" style={{ background: 'var(--steel-2)', color: '#fff', borderColor: 'var(--steel-3)' }}
                    value={siteId} onChange={e => setSiteId(e.target.value)}>
              <option value="">All sites</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        <nav className="nav">
          {nav.map((n, i) => n.group
            ? <div key={'g' + i} className="nav-group">{n.group}</div>
            : (
              <a key={n.to} href={href(n.to)} className={section === n.key ? 'active' : ''} aria-current={section === n.key ? 'page' : undefined}>
                <n.icon />{n.label}
                {n.count > 0 && <span className={`nav-count ${n.alert ? 'alert' : ''}`} title={n.title}>{n.count}</span>}
              </a>
            ))}
        </nav>

        <div className="sidebar-foot">
          <div className="sidebar-user">
            <Avatar name={personName(me)} />
            <div className="who">
              <div className="name">{personName(me)}</div>
              <div className="role">{roleLabel(me.role)}</div>
            </div>
          </div>
          <div className="sidebar-actions">
            <button onClick={toggleTheme} aria-label={dark ? 'Use light theme' : 'Use dark theme'}>{dark ? <Icon.Sun /> : <Icon.Moon />}{dark ? 'Light' : 'Dark'}</button>
            <button onClick={() => supabase.auth.signOut()}><Icon.LogOut />Sign out</button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button onClick={() => setOpen(true)} aria-label="Open menu"><Icon.Menu /></button>
          <span className="brand-name">HLPI Facilities</span>
          <span style={{ flex: 1 }} />
          <button onClick={() => (isStaff ? newWorkOrder() : newRequest())} aria-label={isStaff ? 'New work order' : 'Report a problem'}><Icon.Plus /></button>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
