import { Icon } from '../lib/icons';

export default function ActionButtons({ order, confirmingDelete, onStart, onHold, onResume, onComplete, onReopen, onEdit, onAskDelete, onConfirmDelete, onCancelDelete }) {
  if (confirmingDelete) {
    return (
      <>
        <button className="ibtn ibtn-danger" title="Confirm delete" onClick={onConfirmDelete}><Icon.Check /></button>
        <button className="ibtn" title="Cancel" onClick={onCancelDelete}><Icon.X /></button>
      </>
    );
  }
  return (
    <>
      {order.status === 'Open' && <button className="ibtn" title="Start work" onClick={onStart}><Icon.Play /></button>}
      {order.status === 'In Progress' && (
        <>
          <button className="ibtn" title="Put on hold" onClick={onHold}><Icon.Pause /></button>
          <button className="ibtn" title="Mark complete" onClick={onComplete}><Icon.Check /></button>
        </>
      )}
      {order.status === 'On Hold' && <button className="ibtn" title="Resume" onClick={onResume}><Icon.Play /></button>}
      {(order.status === 'Completed' || order.status === 'Cancelled') && <button className="ibtn" title="Reopen" onClick={onReopen}><Icon.Reopen /></button>}
      <button className="ibtn" title="Edit" onClick={onEdit}><Icon.Edit /></button>
      <button className="ibtn ibtn-danger" title="Delete" onClick={onAskDelete}><Icon.Trash /></button>
    </>
  );
}
