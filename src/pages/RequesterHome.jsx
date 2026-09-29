import { useMemo } from 'react';
import { useData } from '../data/DataProvider';
import { useGlobalActions } from '../components/GlobalActions';
import { AssetTag, Card, EmptyState, PageHead, StatusBadge, WoCode, personName } from '../components/ui';
import { Icon } from '../lib/icons';
import { href, navigate } from '../lib/router';
import { isClosed } from '../lib/domain';
import { fmtAgo } from '../lib/format';

// Home for warehouse staff and MHE operators: report problems, run
// pre-use checks, and follow what happened to their requests.
export default function RequesterHome() {
  const { workOrders, lookup, me } = useData();
  const { newRequest } = useGlobalActions();
  const mine = useMemo(() => workOrders.filter(w => w.requested_by === me.id), [workOrders, me.id]);
  const open = mine.filter(w => !isClosed(w));
  const closed = mine.filter(w => isClosed(w)).slice(0, 15);

  const List = ({ rows }) => (
    <ul className="rows">
      {rows.map(w => (
        <li key={w.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/work-orders/${w.id}`)}>
          <div className="grow">
            <div className="title">{w.title}</div>
            <div className="sub"><WoCode code={w.code} /> · {w.asset_id ? <AssetTag asset={lookup.asset[w.asset_id]} link={false} /> : lookup.location[w.location_id]?.name} · sent {fmtAgo(w.created_at)}
              {w.assigned_to && <> · with {personName(lookup.profile[w.assigned_to])}</>}</div>
          </div>
          <StatusBadge status={w.status} />
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <PageHead eyebrow={`Hello, ${(me.full_name || me.email).split(' ')[0]}`} title="My requests"
                sub="Report anything broken, unsafe or not working, and run your MHE pre-use check before each shift." />
      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <button className="tile clickable" style={{ textAlign: 'left', font: 'inherit' }} onClick={() => newRequest()}>
          <div className="tile-label"><Icon.Wrench />Something broken or unsafe?</div>
          <div className="tile-value" style={{ fontSize: 28 }}>Report a problem</div>
          <div className="tile-sub">Goes to the facilities team for approval.</div>
        </button>
        <a className="tile clickable" href={href('/mhe')} style={{ color: 'inherit', textDecoration: 'none' }}>
          <div className="tile-label"><Icon.Clipboard />Before you drive</div>
          <div className="tile-value" style={{ fontSize: 28 }}>MHE pre-use check</div>
          <div className="tile-sub">Takes about two minutes. Defects are sent straight to maintenance.</div>
        </a>
      </div>
      <Card title={`Open · ${open.length}`}>
        {open.length ? <List rows={open} /> : <EmptyState title="No open requests">When you report a problem, you can follow its progress here.</EmptyState>}
      </Card>
      {closed.length > 0 && <div style={{ marginTop: 16 }}><Card title="Recently closed"><List rows={closed} /></Card></div>}
    </>
  );
}
