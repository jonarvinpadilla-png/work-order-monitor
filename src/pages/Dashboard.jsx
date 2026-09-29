import { useMemo } from 'react';
import { useData } from '../data/DataProvider';
import { AssetStatusBadge, AssetTag, Badge, Card, DueBadge, PriorityBadge, Tile, WoCode } from '../components/ui';
import DcCutaway, { DC_ZONES } from '../illustrations/DcCutaway';
import { BarList, ColumnChart, MeterBar } from '../components/Charts';
import { Icon } from '../lib/icons';
import { href, navigate } from '../lib/router';
import { PRIORITY_RANK } from '../lib/constants';
import { expiryInfo, isActive, isMheUnit, isOverdue, stockInfo, zoneOf } from '../lib/domain';
import { backlogAging, mheAvailability, mttr, plannedShare, pmCompliance, topProblemAssets, weeklyThroughput } from '../lib/kpi';
import { daysUntil, fmtMoney, fmtNum, fmtShortDate, parseDate, todayStr } from '../lib/format';

export default function Dashboard() {
  const d = useData();
  const { lookup, inSite, siteId, isAdmin } = d;
  const today = todayStr();

  const m = useMemo(() => {
    const wos = d.workOrders.filter(inSite);
    const assets = d.assets.filter(inSite);
    const active = wos.filter(isActive);
    const units = assets.filter(a => isMheUnit(a) && a.status !== 'Decommissioned');
    const checkedToday = new Set(d.checks.filter(c => parseDate(c.created_at) && todayStr(parseDate(c.created_at)) === today).map(c => c.asset_id));
    return {
      wos, active,
      overdue: active.filter(w => isOverdue(w)),
      inProgress: active.filter(w => w.status === 'In Progress').length,
      onHold: active.filter(w => w.status === 'On Hold').length,
      requested: wos.filter(w => w.status === 'Requested').length,
      pm: pmCompliance(wos, 30),
      mttr: mttr(wos, 30),
      planned: plannedShare(wos, 30),
      avail: mheAvailability(assets, d.statusLog, 30),
      weekly: weeklyThroughput(wos, 12),
      aging: backlogAging(wos),
      units,
      unitsDown: units.filter(a => a.status !== 'Operational'),
      unitsUp: units.filter(a => a.status === 'Operational').length,
      checkable: units.filter(a => a.mhe_type !== 'Manual Pallet Jack'),
      checkedToday,
      upcoming: active
        .filter(w => w.due_date && daysUntil(w.due_date) <= 7)
        .sort((a, b) => a.due_date.localeCompare(b.due_date) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]),
      top: topProblemAssets(wos, lookup.summary, 90, 6),
      watch: [
        ...d.compliance.filter(c => inSite(c) && c.active && c.next_due && daysUntil(c.next_due) <= 45)
          .map(c => ({ id: 'c' + c.id, label: c.name, kind: 'Compliance', date: c.next_due, to: '/compliance' })),
        ...d.contracts.filter(c => inSite(c) && c.end_date && daysUntil(c.end_date) <= c.renewal_notice_days)
          .map(c => ({ id: 'k' + c.id, label: `${c.title} (${lookup.vendor[c.vendor_id]?.name || 'vendor'})`, kind: 'Contract', date: c.end_date, to: '/vendors?tab=contracts' })),
        ...units.filter(a => a.cert_expiry && daysUntil(a.cert_expiry) <= 30)
          .map(a => ({ id: 'a' + a.id, label: `${a.code} inspection certificate`, kind: 'MHE', date: a.cert_expiry, to: `/assets/${a.id}` }))
      ].sort((a, b) => a.date.localeCompare(b.date)),
      reorder: d.parts.filter(p => inSite(p) && p.active && stockInfo(p).low),
      zones: active.reduce((acc, w) => {
        const z = zoneOf(w.location_id || lookup.asset[w.asset_id]?.location_id, lookup.location);
        if (z) acc[z] = (acc[z] || 0) + 1;
        return acc;
      }, {})
    };
  }, [d.workOrders, d.assets, d.checks, d.statusLog, d.compliance, d.contracts, d.parts, inSite, lookup, today]);

  const site = siteId ? lookup.site[siteId]?.name : d.sites.length === 1 ? d.sites[0].name : 'All sites';
  const dateLabel = new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());

  return (
    <>
      <section className="site-banner">
        <DcCutaway className="site-banner-art" counts={m.zones} />
        <div className="site-banner-text">
          <div className="eyebrow">{site} · {dateLabel}</div>
          <h1 className="page-title">Maintenance overview</h1>
          <p className="page-sub">
            {m.unitsDown.length || m.overdue.length
              ? `${m.overdue.length} overdue ${m.overdue.length === 1 ? 'job' : 'jobs'} and ${m.unitsDown.length} MHE ${m.unitsDown.length === 1 ? 'unit' : 'units'} not fully operational.`
              : 'Nothing overdue and every MHE unit is operational.'}
          </p>
        </div>
        <ul className="sr-only">
          {DC_ZONES.map(z => <li key={z.key}>{z.label}: {m.zones[z.key] || 0} open work orders</li>)}
        </ul>
      </section>

      <div className="tiles">
        <Tile label="Open work orders" icon={Icon.Wrench} value={m.active.length}
              sub={`${m.inProgress} in progress · ${m.onHold} on hold`} onClick={() => navigate('/work-orders')} />
        <Tile label="Overdue" icon={Icon.Clock} value={m.overdue.length} tone={m.overdue.length ? 'danger' : 'good'}
              sub={m.overdue.length ? 'Past their due date' : 'All on schedule'} onClick={() => navigate('/work-orders?view=overdue')} />
        <Tile label="PM compliance · 30 days" icon={Icon.CalendarClock} value={m.pm.pct} unit="%"
              tone={m.pm.pct === null ? null : m.pm.pct >= 90 ? 'good' : m.pm.pct >= 75 ? 'warn' : 'danger'}
              sub={m.pm.total ? `${m.pm.onTime} of ${m.pm.total} done on time` : 'No planned work due yet'} onClick={() => navigate('/pm')} />
        <Tile label="MHE availability · 30 days" icon={Icon.Forklift} value={m.avail.pct} unit="%"
              tone={m.avail.pct === null ? null : m.avail.pct >= 95 ? 'good' : m.avail.pct >= 85 ? 'warn' : 'danger'}
              sub={`${m.unitsUp} of ${m.units.length} units in service now`} onClick={() => navigate('/mhe')} />
        <Tile label="Mean time to repair · 30 days" icon={Icon.Gauge} value={m.mttr.hours === null ? null : fmtNum(m.mttr.hours)} unit=" h"
              sub={m.mttr.count ? `Across ${m.mttr.count} repairs` : 'No repairs closed yet'} />
        <Tile label="Requests to review" icon={Icon.Inbox} value={m.requested} tone={isAdmin && m.requested ? 'warn' : null}
              sub={isAdmin ? 'Approve or reject' : 'Waiting for an admin'} onClick={() => navigate('/requests')} />
      </div>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <Card title="Work orders per week">
          <ColumnChart
            ariaLabel="Work orders created and completed per week over the last 12 weeks"
            data={m.weekly}
            xLabel={b => fmtShortDate(b.start)}
            series={[
              { key: 'created', label: 'Raised', color: 'var(--series-1)' },
              { key: 'completed', label: 'Completed', color: 'var(--series-2)' }
            ]} />
        </Card>
        <Card title="Open backlog by age">
          <BarList rows={m.aging.map(b => ({ key: b.label, label: b.label, value: b.count, tip: `${b.count} open work orders raised ${b.label.toLowerCase()} ago` }))}
                   empty="No open work orders." />
          <div style={{ marginTop: 22 }}>
            <div className="unit-line" style={{ marginBottom: 6, fontSize: 13.5 }}>
              <span className="dim">Planned share of completed work · 30 days</span>
              <b>{m.planned.pct === null ? '—' : `${m.planned.pct}%`}</b>
            </div>
            <MeterBar pct={m.planned.pct} />
            <div className="mute" style={{ fontSize: 12.5, marginTop: 6 }}>
              {m.planned.total ? `${m.planned.planned} of ${m.planned.total} jobs were PM or inspections. A common target is 80% or more.` : 'No completed work yet.'}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <Card title="Due in the next 7 days" actions={<a href={href('/work-orders')} className="btn btn-sm btn-quiet">All work orders</a>}>
          {m.upcoming.length === 0 ? <p className="mute">Nothing due this week.</p> : (
            <ul className="rows">
              {m.upcoming.slice(0, 8).map(w => (
                <li key={w.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/work-orders/${w.id}`)}>
                  <div className="grow">
                    <div className="title">{w.title}</div>
                    <div className="sub"><WoCode code={w.code} />{w.asset_id && <> · {lookup.asset[w.asset_id]?.code}</>}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <DueBadge wo={w} />
                    {w.priority === 'Critical' && <div style={{ marginTop: 3 }}><PriorityBadge priority="Critical" /></div>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="MHE fleet now" actions={<a href={href('/mhe')} className="btn btn-sm btn-quiet">MHE board</a>}>
          <div className="unit-line" style={{ marginBottom: 6 }}>
            <span className="dim">Pre-use checks done today</span>
            <b className="num">{m.checkable.filter(a => m.checkedToday.has(a.id)).length} / {m.checkable.length}</b>
          </div>
          <MeterBar pct={m.checkable.length ? (m.checkable.filter(a => m.checkedToday.has(a.id)).length / m.checkable.length) * 100 : 0} />
          <ul className="rows" style={{ marginTop: 10 }}>
            {m.unitsDown.length === 0 && <li className="mute">Every unit is operational.</li>}
            {m.unitsDown.map(a => (
              <li key={a.id}>
                <AssetTag asset={a} />
                <div className="grow"><div className="sub">{a.mhe_type}</div></div>
                <AssetStatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Permits, contracts & certificates">
          {m.watch.length === 0 ? <p className="mute">Nothing expiring in the next 45 days.</p> : (
            <ul className="rows">
              {m.watch.slice(0, 8).map(w => {
                const e = expiryInfo(w.date, 45);
                return (
                  <li key={w.id} style={{ cursor: 'pointer' }} onClick={() => navigate(w.to)}>
                    <div className="grow">
                      <div className="title">{w.label}</div>
                      <div className="sub">{w.kind}</div>
                    </div>
                    <Badge tone={e.tone}>{e.days < 0 ? `${-e.days}d overdue` : `${e.days}d left`}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-2">
        <Card title="Most repairs · last 90 days">
          <BarList
            rows={m.top.map(t => {
              const a = lookup.asset[t.asset_id];
              return { key: t.asset_id, label: a ? `${a.code} · ${a.name}` : 'Unknown asset', value: t.count, tip: `${t.count} repairs, ${fmtMoney(t.cost)} total cost` };
            })}
            format={v => `${v} jobs`}
            empty="No repairs logged in the last 90 days." />
          <p className="mute" style={{ fontSize: 12.5, marginBottom: 0 }}>Corrective and emergency work only. Repeat offenders are candidates for a root-cause review or replacement.</p>
        </Card>
        <Card title="Parts to reorder" actions={<a href={href('/parts?low=1')} className="btn btn-sm btn-quiet">Parts &amp; stock</a>}>
          {m.reorder.length === 0 ? <p className="mute">Stock is above minimum for every part.</p> : (
            <ul className="rows">
              {m.reorder.slice(0, 7).map(p => {
                const s = stockInfo(p);
                return (
                  <li key={p.id}>
                    <span className="tag part">{p.part_no}</span>
                    <div className="grow"><div className="title">{p.name}</div><div className="sub">Bin {p.bin_location || '—'} · min {fmtNum(p.min_qty)} {p.unit}</div></div>
                    <Badge tone={s.tone}>{fmtNum(p.qty_on_hand)} {p.unit}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

