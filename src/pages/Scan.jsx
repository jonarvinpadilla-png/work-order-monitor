import { useData } from '../data/DataProvider';
import { useGlobalActions } from '../components/GlobalActions';
import { AssetStatusBadge, AssetTag, Card, EmptyState, Lockout, StatusBadge, WoCode } from '../components/ui';
import MheArt, { hasMheArt } from '../illustrations/Mhe';
import { Icon } from '../lib/icons';
import { href } from '../lib/router';
import { isActive, isMheUnit, locationPath } from '../lib/domain';
import { findAssetByCode, unitPath } from '../lib/links';
import { fmtTime, parseDate, todayStr } from '../lib/format';

// What a phone opens after scanning an asset's QR label: the unit, its
// status, and big buttons for what people come to do.
export function UnitScan({ code }) {
  const { assets, templates, workOrders, checks, lookup, isStaff } = useData();
  const { newRequest, newWorkOrder } = useGlobalActions();
  const asset = findAssetByCode(assets, code);

  if (!asset) {
    return (
      <EmptyState title={`No asset with the tag ${code}`} action={<a className="btn" href={href('/')}>Go to the CMMS</a>}>
        The label may be out of date. Report the problem from the home screen instead, and tell a technician so the label can be reprinted.
      </EmptyState>
    );
  }

  const loc = lookup.location[asset.location_id];
  const locked = asset.status === 'Out of Service';
  const retired = asset.status === 'Decommissioned';
  const checkable = isMheUnit(asset) && templates.some(t => t.active && t.applies_to.includes(asset.mhe_type));
  const manual = asset.mhe_type === 'Manual Pallet Jack';
  const prefill = { asset_id: asset.id, site_id: asset.site_id, location_id: asset.location_id || '' };
  const open = workOrders.filter(w => w.asset_id === asset.id && (isActive(w) || w.status === 'Requested'));
  const lastCheck = checks.filter(c => c.asset_id === asset.id).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
  const checkedToday = lastCheck && todayStr(parseDate(lastCheck.created_at)) === todayStr();

  return (
    <div className="scan">
      <div className="scan-head">
        {asset.mhe_type && hasMheArt(asset.mhe_type)
          ? <MheArt type={asset.mhe_type} className={`scan-art ${locked ? 'is-locked' : ''}`} spot={!locked} />
          : <div className="scan-icon" aria-hidden="true"><Icon.Box /></div>}
        <div className="scan-id">
          <div className="eyebrow">{lookup.category[asset.category_id]?.name || 'Asset'}</div>
          <h1 className="scan-title"><AssetTag asset={asset} link={false} size="lg" /><AssetStatusBadge status={asset.status} /></h1>
          <div className="scan-name">{asset.name}</div>
          <div className="dim">{[[asset.make, asset.model].filter(Boolean).join(' '), loc && locationPath(loc, lookup.location)].filter(Boolean).join(' · ')}</div>
        </div>
      </div>

      {locked && <Lockout title={`${asset.code} is locked out: do not operate`}>A technician returns it to service after the repair.</Lockout>}
      {retired && <div className="form-note">This asset has been decommissioned. If the label is still on something in use, tell a technician.</div>}

      <div className="scan-actions">
        <button className="btn btn-primary btn-xl" onClick={() => newRequest(prefill)}><Icon.Wrench />Report a problem</button>
        {checkable && !locked && !retired && (
          <a className="btn btn-xl" href={href(`/mhe/${asset.id}/check`)}><Icon.Clipboard />{manual ? 'Weekly check' : 'Pre-use check'}</a>
        )}
        {isStaff && <button className="btn btn-xl" onClick={() => newWorkOrder(prefill)}><Icon.Plus />New work order</button>}
        {isStaff && <a className="btn btn-xl btn-quiet" href={href(`/assets/${asset.id}`)}><Icon.Box />Asset record</a>}
      </div>

      {checkable && lastCheck && (
        <p className="dim scan-note">
          {checkedToday ? 'Last pre-use check today at ' : 'Last pre-use check '}
          {checkedToday ? fmtTime(lastCheck.created_at) : parseDate(lastCheck.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
          {lastCheck.critical_fail ? ': failed a critical item.' : lastCheck.fail_count ? `: ${lastCheck.fail_count} defect${lastCheck.fail_count > 1 ? 's' : ''} reported.` : ': passed.'}
        </p>
      )}

      {open.length > 0 && (
        <Card title={isStaff ? 'Open work on this unit' : 'Your open requests for this unit'}>
          <ul className="rows">
            {open.map(w => (
              <li key={w.id}>
                <WoCode code={w.code} />
                <a className="grow title" href={href(`/work-orders/${w.id}`)}>{w.title}</a>
                <StatusBadge status={w.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

// What a phone opens after scanning a place's QR label (a room, dock or
// area): report a problem there, or pick the equipment it is about.
export function PlaceScan({ id }) {
  const { assets, locations, lookup, isStaff } = useData();
  const { newRequest, newWorkOrder } = useGlobalActions();
  const loc = lookup.location[id];

  if (!loc) {
    return (
      <EmptyState title="This place is no longer in the CMMS" action={<a className="btn" href={href('/')}>Go to the CMMS</a>}>
        Report the problem from the home screen instead, and tell a technician so the label can be replaced.
      </EmptyState>
    );
  }

  // This place and everything inside it (e.g. the docks under a building).
  const inside = new Set([loc.id]);
  for (let grew = true; grew;) {
    grew = false;
    for (const l of locations) if (l.parent_id && inside.has(l.parent_id) && !inside.has(l.id)) { inside.add(l.id); grew = true; }
  }
  const here = assets
    .filter(a => inside.has(a.location_id) && a.status !== 'Decommissioned')
    .sort((a, b) => a.code.localeCompare(b.code));
  const prefill = { site_id: loc.site_id, location_id: loc.id };

  return (
    <div className="scan">
      <div className="scan-head">
        <div className="scan-icon" aria-hidden="true"><Icon.Pin /></div>
        <div className="scan-id">
          <div className="eyebrow">{lookup.site[loc.site_id]?.name || 'Place'}</div>
          <h1 className="scan-title">{loc.name}</h1>
          <div className="dim">{[locationPath(loc, lookup.location), loc.temp_zone].filter(Boolean).join(' · ')}</div>
        </div>
      </div>
      <div className="scan-actions">
        <button className="btn btn-primary btn-xl" onClick={() => newRequest(prefill)}><Icon.Wrench />Report a problem here</button>
        {isStaff && <button className="btn btn-xl" onClick={() => newWorkOrder(prefill)}><Icon.Plus />New work order here</button>}
      </div>
      {here.length > 0 && (
        <Card title="Is it about one of these?">
          <ul className="rows">
            {here.map(a => (
              <li key={a.id}>
                <span className={`tag ${isMheUnit(a) ? 'mhe' : ''}`}>{a.code}</span>
                <a className="grow title" href={href(unitPath(a))}>{a.name}</a>
                <AssetStatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
