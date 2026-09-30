import { useMemo, useState } from 'react';
import { useData } from '../data/DataProvider';
import { db } from '../data/api';
import { useAction } from '../components/Toast';
import { AssetTag, Badge, Card, DataTable, EmptyState, Options, PageHead, Person, SearchBox, Tabs, Tile, personName } from '../components/ui';
import { Icon } from '../lib/icons';
import { href } from '../lib/router';
import { PM_TYPES } from '../lib/constants';
import { describeTrigger, isActive, pmForecast, pmNextInfo } from '../lib/domain';
import { fmtDate, fmtNum, parseDate } from '../lib/format';
import { pmCompliance } from '../lib/kpi';
import PmForm from './PmForm';

export default function PmSchedules() {
  const { pm, lookup, inSite, workOrders, refreshTables } = useData();
  const [run, busy] = useAction();
  const [tab, setTab] = useState('schedules');
  const [editing, setEditing] = useState(undefined); // undefined closed, null new, object edit
  const [f, setF] = useState({ search: '', type: '', trigger: '', paused: false });
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));

  const schedules = useMemo(() => pm.filter(s => inSite(s.asset_id ? lookup.asset[s.asset_id] || s : s)), [pm, inSite, lookup]);
  const openWo = useMemo(() => {
    const m = {};
    workOrders.forEach(w => { if (w.pm_schedule_id && isActive(w)) m[w.pm_schedule_id] = w; });
    return m;
  }, [workOrders]);

  const rows = schedules.filter(s => {
    if (!f.paused && !s.active) return false;
    if (f.type && s.type !== f.type) return false;
    if (f.trigger && s.trigger_type !== f.trigger) return false;
    const q = f.search.trim().toLowerCase();
    if (q) {
      const a = lookup.asset[s.asset_id];
      if (!`${s.title} ${a?.code || ''} ${a?.name || ''} ${lookup.location[s.location_id]?.name || ''}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const active = schedules.filter(s => s.active);
  const late = active.filter(s => pmNextInfo(s, lookup.asset[s.asset_id]).tone === 'danger').length;
  const compliance = pmCompliance(workOrders.filter(inSite), 30);
  const pmHours = active.reduce((sum, s) => sum + (s.trigger_type === 'Calendar' && s.estimated_hours
    ? Number(s.estimated_hours) * ({ day: 30, week: 30 / 7, month: 1, year: 1 / 12 }[s.interval_unit] || 0) / Number(s.interval_value || 1) : 0), 0);

  const columns = [
    {
      key: 'title', label: 'Schedule', sort: s => s.title,
      render: s => (
        <>
          <div className="cell-title">{s.title}</div>
          <div className="cell-sub">
            {s.asset_id ? <AssetTag asset={lookup.asset[s.asset_id]} /> : <span>{lookup.location[s.location_id]?.name || 'No location'}</span>}
            <span>{s.type}</span>
            {s.vendor_id && <span>· {lookup.vendor[s.vendor_id]?.name}</span>}
            {!s.active && <Badge tone="muted">Paused</Badge>}
          </div>
        </>
      )
    },
    { key: 'trigger', label: 'Repeats', sort: s => s.trigger_type, render: s => <span className="nowrap">{describeTrigger(s)}</span> },
    {
      key: 'next', label: 'Next due', sort: s => pmNextInfo(s, lookup.asset[s.asset_id]).sortKey,
      render: s => {
        const n = pmNextInfo(s, lookup.asset[s.asset_id]);
        return <><div className="nowrap">{n.label}</div><Badge tone={n.tone === 'muted' ? 'plain' : n.tone}>{n.sub}</Badge></>;
      }
    },
    { key: 'who', label: 'Assigned', sort: s => personName(lookup.profile[s.assigned_to]) || 'zzz', render: s => <Person id={s.assigned_to} /> },
    { key: 'last', label: 'Last done', sort: s => s.last_completed_at || '', render: s => s.last_completed_at ? fmtDate(s.last_completed_at) : <span className="mute">Never</span> },
    {
      key: 'wo', label: 'Open work order',
      render: s => openWo[s.id]
        ? <a href={href(`/work-orders/${openWo[s.id].id}`)} onClick={e => e.stopPropagation()} className="mono">{openWo[s.id].code}</a>
        : <span className="mute">—</span>
    }
  ];

  return (
    <>
      <PageHead eyebrow="Work" title="Preventive maintenance"
                sub="Schedules create work orders automatically when they come due, by calendar or by hour meter."
                actions={<>
                  <button className="btn" disabled={busy} onClick={() => run(async () => {
                    const n = await db.rpc('generate_pm_work_orders');
                    await refreshTables('work_orders', 'pm_schedules');
                    return n;
                  }, n => n ? `${n} work order${n > 1 ? 's' : ''} created.` : 'Nothing new is due.')}><Icon.Refresh />Create due work orders</button>
                  <button className="btn btn-primary" onClick={() => setEditing(null)}><Icon.Plus />New schedule</button>
                </>} />

      <div className="tiles">
        <Tile label="Active schedules" icon={Icon.CalendarClock} value={active.length} sub={`${active.filter(s => s.trigger_type === 'Meter').length} by hour meter`} />
        <Tile label="Past due" icon={Icon.Clock} value={late} tone={late ? 'danger' : 'good'} sub="Due date or hours passed" />
        <Tile label="PM compliance · 30 days" value={compliance.pct} unit="%" sub={compliance.total ? `${compliance.onTime} of ${compliance.total} on time` : 'Nothing due yet'} />
        <Tile label="Planned PM load" value={fmtNum(pmHours)} unit=" h/month" sub="Calendar schedules with estimates" />
      </div>

      <Tabs value={tab} onChange={setTab} items={[{ value: 'schedules', label: 'Schedules', count: rows.length }, { value: 'forecast', label: 'Next 90 days' }]} />

      {tab === 'schedules' ? (
        <>
          <div className="toolbar">
            <SearchBox value={f.search} onChange={v => set('search', v)} placeholder="Schedule, asset or area" />
            <select className="select" value={f.type} onChange={e => set('type', e.target.value)} aria-label="Type"><Options values={PM_TYPES} empty="All types" /></select>
            <select className="select" value={f.trigger} onChange={e => set('trigger', e.target.value)} aria-label="Trigger">
              <option value="">Calendar and hour meter</option><option value="Calendar">Calendar only</option><option value="Meter">Hour meter only</option>
            </select>
            <label className="check"><input type="checkbox" checked={f.paused} onChange={e => set('paused', e.target.checked)} /><span>Show paused</span></label>
          </div>
          <div className="card">
            <DataTable columns={columns} rows={rows} onRowClick={s => setEditing(s)} initialSort={{ key: 'next', dir: 'asc' }}
                       empty="No schedules yet. Create one for each routine: weekly genset runs, monthly dock leveler PM, 250-hour truck services." />
          </div>
        </>
      ) : <Forecast schedules={active} />}

      {editing !== undefined && <PmForm schedule={editing || undefined} onClose={() => setEditing(undefined)} />}
    </>
  );
}

function Forecast({ schedules }) {
  const { lookup } = useData();
  const items = pmForecast(schedules, 90);
  const meter = schedules.filter(s => s.trigger_type === 'Meter')
    .map(s => ({ s, n: pmNextInfo(s, lookup.asset[s.asset_id]) }))
    .sort((a, b) => a.n.sortKey - b.n.sortKey);
  const byMonth = {};
  items.forEach(i => {
    const key = new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(parseDate(i.date));
    (byMonth[key] ||= []).push(i);
  });
  return (
    <div className="split">
      <div className="stack">
        {Object.keys(byMonth).length === 0 && <div className="card"><EmptyState title="Nothing scheduled">No calendar PM falls in the next 90 days.</EmptyState></div>}
        {Object.entries(byMonth).map(([month, list]) => (
          <Card key={month} title={`${month} · ${list.length}`}>
            <ul className="rows">
              {list.map((i, k) => (
                <li key={k}>
                  <span className="num" style={{ minWidth: 92, fontWeight: 700 }}>{fmtDate(i.date).replace(/, \d{4}$/, '')}</span>
                  <div className="grow">
                    <div className="title">{i.schedule.title}</div>
                    <div className="sub">{i.schedule.asset_id ? lookup.asset[i.schedule.asset_id]?.code : lookup.location[i.schedule.location_id]?.name} · <Person id={i.schedule.assigned_to} />{i.schedule.estimated_hours ? ` · ${fmtNum(i.schedule.estimated_hours)} h` : ''}</div>
                  </div>
                  {i.overdue && <Badge tone="danger">Overdue</Badge>}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
      <Card title="Hour-meter services">
        {meter.length === 0 ? <p className="mute">No hour-meter schedules.</p> : (
          <ul className="rows">
            {meter.map(({ s, n }) => (
              <li key={s.id}>
                <AssetTag asset={lookup.asset[s.asset_id]} />
                <div className="grow"><div className="sub">{n.label}</div></div>
                <Badge tone={n.tone === 'muted' ? 'plain' : n.tone}>{n.sub}</Badge>
              </li>
            ))}
          </ul>
        )}
        <p className="mute" style={{ fontSize: 12.5, marginBottom: 0 }}>Dates depend on how hard each unit works; keep hour meters up to date through pre-use checks.</p>
      </Card>
    </div>
  );
}

