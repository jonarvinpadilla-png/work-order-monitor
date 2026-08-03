import { TYPE_COLOR, PRIORITY_COLOR, typeLabel, isOverdue, dueLabel } from '../lib/constants';
import ActionButtons from './ActionButtons';

export default function WorkOrderCard({ order, confirmingDelete, actions }) {
  const overdue = isOverdue(order);
  return (
    <div className={`wo-card type-${TYPE_COLOR[order.type]}`}>
      <span className="wo-hole"></span>
      <div className="wo-card-head">
        <span className="wo-id">{order.code}</span>
        <span className={`chip chip-sm chip-${PRIORITY_COLOR[order.priority]}`}>{order.priority}</span>
      </div>
      <div className="wo-card-body">
        <h4 className="wo-title">{order.title}</h4>
        <div className="wo-meta">
          <span>{order.facility}</span>
          {order.location && <span>· {order.location}</span>}
        </div>
        <div className="wo-tags">
          <span className={`chip chip-sm chip-${TYPE_COLOR[order.type]}`}>{typeLabel(order.type)}</span>
        </div>
        <div className="wo-foot">
          <span>{order.assigned_to || 'Unassigned'}</span>
          <span className={`wo-due${overdue ? ' overdue' : ''}`}>{dueLabel(order)}</span>
        </div>
        <div className="wo-actions">
          <ActionButtons order={order} confirmingDelete={confirmingDelete} {...actions} />
        </div>
      </div>
    </div>
  );
}
