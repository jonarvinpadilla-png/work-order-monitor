import { STATUS_COLOR } from '../lib/constants';
import WorkOrderCard from './WorkOrderCard';

const COLUMNS = ['Open', 'In Progress', 'On Hold', 'Completed'];

export default function BoardView({ orders, deleteConfirmId, makeActions }) {
  const cancelledCount = orders.filter(o => o.status === 'Cancelled').length;
  return (
    <>
      <div className="board">
        {COLUMNS.map(col => {
          const items = orders
            .filter(o => o.status === col)
            .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
          return (
            <div className="board-col" key={col}>
              <div className={`board-col-head status-${STATUS_COLOR[col]}`}>
                <span>{col}</span>
                <span className="count">{items.length}</span>
              </div>
              <div className="board-col-body">
                {items.length === 0 && <div className="empty-mini">Nothing here</div>}
                {items.map(o => (
                  <WorkOrderCard key={o.id} order={o} confirmingDelete={deleteConfirmId === o.id} actions={makeActions(o)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {cancelledCount > 0 && (
        <p className="muted-note" style={{ marginTop: 12 }}>
          {cancelledCount} cancelled work order{cancelledCount > 1 ? 's' : ''} hidden from the board — view in Log.
        </p>
      )}
    </>
  );
}
