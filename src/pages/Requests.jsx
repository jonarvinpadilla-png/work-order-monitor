import { useMemo, useState } from 'react';
import { useData } from '../data/DataProvider';
import { useGlobalActions } from '../components/GlobalActions';
import { AssetTag, DataTable, PageHead, PriorityBadge, StatusBadge, Tabs, WoCode, personName } from '../components/ui';
import { Icon } from '../lib/icons';
import { navigate } from '../lib/router';
import { PRIORITY_RANK } from '../lib/constants';
import { fmtAgo, fmtDate, parseDate } from '../lib/format';

export default function Requests() {
  const { workOrders, lookup, inSite, isAdmin, isStaff } = useData();
  const { newRequest } = useGlobalActions();
  const [tab, setTab] = useState('pending');
  const monthAgo = Date.now() - 30 * 86400000;

  const pending = useMemo(() => workOrders.filter(w => inSite(w) && w.status === 'Requested'), [workOrders, inSite]);
  const decided = useMemo(() => workOrders.filter(w => inSite(w) && w.approved_at && parseDate(w.approved_at).getTime() >= monthAgo), [workOrders, inSite, monthAgo]);
  const rows = tab === 'pending' ? pending : decided;

  const columns = [
    {
      key: 'title', label: 'Request', sort: w => w.code,
      render: w => (
        <>
          <div className="cell-title">{w.title}</div>
          <div className="cell-sub">
            <WoCode code={w.code} />
            {w.asset_id && <AssetTag asset={lookup.asset[w.asset_id]} link={isStaff} />}
            {w.location_id && <span>{lookup.location[w.location_id]?.name}</span>}
            {w.type === 'Safety' && <span style={{ color: 'var(--danger)', fontWeight: 700 }}>Safety hazard</span>}
            {w.asset_down && <span style={{ color: 'var(--danger)', fontWeight: 700 }}>Equipment down</span>}
          </div>
        </>
      )
    },
    { key: 'priority', label: 'Urgency', sort: w => PRIORITY_RANK[w.priority], render: w => <PriorityBadge priority={w.priority} /> },
    { key: 'by', label: 'Requested by', sort: w => personName(lookup.profile[w.requested_by]) || w.requester_name, render: w => personName(lookup.profile[w.requested_by]) || w.requester_name || '—' },
    { key: 'when', label: 'Sent', sort: w => w.created_at, render: w => <span title={fmtDate(w.created_at)}>{fmtAgo(w.created_at)}</span> },
    ...(tab === 'decided' ? [{ key: 'status', label: 'Outcome', sort: w => w.status, render: w => <StatusBadge status={w.status} /> }] : [])
  ];

  return (
    <>
      <PageHead eyebrow="Work" title="Requests"
                sub={isAdmin ? 'Problems reported by the warehouse. Approve to turn a request into a work order, or reject it with a reason.' : 'Problems reported by the warehouse. An admin approves each one before it becomes a work order.'}
                actions={<button className="btn btn-primary" onClick={() => newRequest()}><Icon.Plus />Report a problem</button>} />
      <Tabs value={tab} onChange={setTab} items={[
        { value: 'pending', label: 'Awaiting approval', count: pending.length },
        { value: 'decided', label: 'Decided · last 30 days', count: decided.length }
      ]} />
      <div className="card">
        <DataTable columns={columns} rows={rows} onRowClick={w => navigate(`/work-orders/${w.id}`)}
                   initialSort={tab === 'pending' ? { key: 'priority', dir: 'asc' } : { key: 'when', dir: 'desc' }}
                   empty={tab === 'pending' ? 'No requests are waiting. New ones from the warehouse will appear here.' : 'Nothing decided in the last 30 days.'} />
      </div>
    </>
  );
}
