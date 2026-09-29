import { useMemo, useState } from 'react';
import { useData } from '../data/DataProvider';
import { useGlobalActions } from '../components/GlobalActions';
import { AssetTag, DataTable, DueBadge, EmptyState, Options, PageHead, Person, PriorityBadge, SearchBox, Segmented, StatusBadge, WoCode, personName } from '../components/ui';
import { Icon } from '../lib/icons';
import { href, navigate, useRoute } from '../lib/router';
import { PRIORITIES, PRIORITY_RANK, WO_TYPES } from '../lib/constants';
import { dueInfo, isActive, isOverdue } from '../lib/domain';
import { daysUntil, fmtDate, fmtNum, parseDate } from '../lib/format';
import { downloadCsv } from '../lib/csv';

const VIEWS = [
  { value: 'active', label: 'Open & in progress' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'mine', label: 'Assigned to me' },
  { value: 'Completed', label: 'Completed' },
  { value: 'all', label: 'Everything' }
];

export default function WorkOrders() {
  const { workOrders, lookup, inSite, me } = useData();
  const { newWorkOrder } = useGlobalActions();
  const route = useRoute();
  const [layout, setLayout] = useState(() => { try { return localStorage.getItem('cmms.woLayout') || 'list'; } catch { return 'list'; } });
  const [f, setF] = useState({ view: route.query.get('view') || 'active', search: '', type: '', priority: '' });
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const setLayoutSaved = v => { setLayout(v); try { localStorage.setItem('cmms.woLayout', v); } catch { /* ignore */ } };

  const rows = useMemo(() => {
    const s = f.search.trim().toLowerCase();
    return workOrders.filter(w => {
      if (!inSite(w) || w.status === 'Requested' || w.status === 'Rejected') return false;
      if (f.view === 'active' && !isActive(w)) return false;
      if (f.view === 'overdue' && !isOverdue(w)) return false;
      if (f.view === 'mine' && !(w.assigned_to === me.id && isActive(w))) return false;
      if (f.view === 'Completed' && w.status !== 'Completed') return false;
      if (f.type && w.type !== f.type) return false;
      if (f.priority && w.priority !== f.priority) return false;
      if (s) {
        const a = lookup.asset[w.asset_id];
        const hay = `${w.code} ${w.title} ${w.description || ''} ${a?.code || ''} ${a?.name || ''} ${lookup.location[w.location_id]?.name || ''} ${personName(lookup.profile[w.assigned_to]) || ''}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [workOrders, f, inSite, lookup, me.id]);

  const columns = [
    {
      key: 'title', label: 'Work order', sort: w => w.code,
      render: w => (
        <>
          <div className="cell-title">{w.title}</div>
          <div className="cell-sub">
            <WoCode code={w.code} />
            {w.asset_id && <AssetTag asset={lookup.asset[w.asset_id]} />}
            {w.location_id && <span>{lookup.location[w.location_id]?.name}</span>}
            {w.pm_schedule_id && <span title="From a PM schedule"><Icon.CalendarClock style={{ width: 13, height: 13, verticalAlign: -2 }} /> PM</span>}
          </div>
        </>
      )
    },
    { key: 'type', label: 'Type', sort: w => w.type },
    { key: 'priority', label: 'Priority', sort: w => PRIORITY_RANK[w.priority], render: w => <PriorityBadge priority={w.priority} /> },
    { key: 'status', label: 'Status', sort: w => w.status, render: w => <StatusBadge status={w.status} /> },
    { key: 'assigned', label: 'Assigned', sort: w => personName(lookup.profile[w.assigned_to]) || 'zzz', render: w => <Person id={w.assigned_to} /> },
    {
      key: 'due', label: 'Due', sort: w => w.status === 'Completed' ? w.completed_at : w.due_date,
      render: w => <DueBadge wo={w} />
    },
    {
      key: 'tasks', label: 'Tasks', right: true, sort: w => lookup.summary[w.id]?.task_total || 0,
      render: w => {
        const s = lookup.summary[w.id];
        return s?.task_total ? <span className="num">{s.task_done}/{s.task_total}</span> : <span className="mute">—</span>;
      }
    }
  ];

  function exportCsv() {
    downloadCsv(`work-orders-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Code', 'Title', 'Type', 'Priority', 'Status', 'Asset', 'Location', 'Assigned to', 'Contractor', 'Created', 'Due', 'Completed', 'Labour hours', 'Labour cost', 'Parts cost', 'External cost', 'Total cost', 'Downtime hours', 'Cause', 'Action taken'],
      rows.map(w => {
        const s = lookup.summary[w.id] || {};
        return [w.code, w.title, w.type, w.priority, w.status, lookup.asset[w.asset_id]?.code, lookup.location[w.location_id]?.name,
          personName(lookup.profile[w.assigned_to]), lookup.vendor[w.vendor_id]?.name, fmtDate(w.created_at), w.due_date,
          w.completed_at ? fmtDate(w.completed_at) : '', s.labor_hours, s.labor_cost, s.parts_cost, s.external_cost, s.total_cost,
          w.downtime_hours, w.failure_cause, w.action_taken];
      }));
  }

  return (
    <>
      <PageHead eyebrow="Work" title="Work orders"
                actions={<>
                  <button className="btn" onClick={exportCsv}><Icon.Download />Export CSV</button>
                  <button className="btn btn-primary" onClick={() => newWorkOrder()}><Icon.Plus />New work order</button>
                </>} />
      <div className="toolbar">
        <SearchBox value={f.search} onChange={v => set('search', v)} placeholder="Search code, title, asset, person" />
        <select className="select" value={f.view} onChange={e => set('view', e.target.value)} aria-label="Show">
          {VIEWS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
        </select>
        <select className="select" value={f.type} onChange={e => set('type', e.target.value)} aria-label="Type"><Options values={WO_TYPES} empty="All types" /></select>
        <select className="select" value={f.priority} onChange={e => set('priority', e.target.value)} aria-label="Priority"><Options values={PRIORITIES} empty="All priorities" /></select>
        <span style={{ flex: 1 }} />
        <Segmented label="Layout" value={layout} onChange={setLayoutSaved}
                   items={[{ value: 'list', label: 'List', icon: Icon.List }, { value: 'board', label: 'Board', icon: Icon.Columns }]} />
      </div>
      {layout === 'list' ? (
        <div className="card">
          <DataTable columns={columns} rows={rows} onRowClick={w => navigate(`/work-orders/${w.id}`)}
                     initialSort={{ key: 'due', dir: 'asc' }}
                     empty={f.view === 'overdue' ? 'Nothing is overdue.' : 'No work orders match these filters.'} />
        </div>
      ) : (
        <Board rows={rows} view={f.view} />
      )}
    </>
  );
}

function Board({ rows, view }) {
  const { lookup } = useData();
  const cols = ['Open', 'In Progress', 'On Hold', 'Completed'];
  const recentDone = w => w.status !== 'Completed' || view === 'Completed' || view === 'all' || -daysUntil(w.completed_at) <= 14;
  const by = Object.fromEntries(cols.map(c => [c, rows.filter(w => w.status === c && recentDone(w))
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (a.due_date || '9').localeCompare(b.due_date || '9'))]));
  if (!rows.length) return <div className="card"><EmptyState title="No results">No work orders match these filters.</EmptyState></div>;
  return (
    <div className="board">
      {cols.map(c => (
        <div key={c} className="board-col">
          <div className="board-col-head">{c}<span className="n">{by[c].length}</span></div>
          {c === 'Completed' && view !== 'Completed' && view !== 'all' && <div className="mute" style={{ fontSize: 12, margin: '-6px 4px 8px' }}>Last 14 days</div>}
          {by[c].map(w => {
            const s = lookup.summary[w.id];
            const due = dueInfo(w);
            return (
              <a key={w.id} className={`wo-card p-${w.priority}`} href={href(`/work-orders/${w.id}`)}>
                <div className="meta"><WoCode code={w.code} />{w.asset_id && <AssetTag asset={lookup.asset[w.asset_id]} link={false} />}</div>
                <div className="t">{w.title}</div>
                <div className="meta">
                  <span className={due.tone === 'danger' ? '' : ''} style={due.tone === 'danger' ? { color: 'var(--danger)', fontWeight: 700 } : undefined}>{due.label}</span>
                  <span>·</span><Person id={w.assigned_to} />
                  {s?.task_total ? <><span>·</span><span className="num">{s.task_done}/{s.task_total} tasks</span></> : null}
                  {w.completed_at && w.status === 'Completed' && <><span>·</span><span>{fmtNum((parseDate(w.completed_at) - parseDate(w.created_at)) / 3600000)} h</span></>}
                </div>
              </a>
            );
          })}
        </div>
      ))}
    </div>
  );
}
