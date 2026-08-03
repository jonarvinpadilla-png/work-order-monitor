import { useMemo, useRef, useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useWorkOrders } from './hooks/useWorkOrders';
import { supabase } from './supabaseClient';
import { typeLabel, todayStr } from './lib/constants';
import { Icon } from './lib/icons';
import Login from './components/Login';
import KpiBar from './components/KpiBar';
import Controls from './components/Controls';
import BoardView from './components/BoardView';
import LogView from './components/LogView';
import DashboardView from './components/DashboardView';
import WorkOrderModal from './components/WorkOrderModal';
import Toast from './components/Toast';

function csvEscape(val) {
  if (val == null) return '';
  const s = String(val);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export default function App() {
  const { session, loading: authLoading } = useAuth();
  if (authLoading) return <div className="loading-state">Loading…</div>;
  if (!session) return <Login />;
  return <Dashboard session={session} />;
}

function Dashboard({ session }) {
  const { orders, loading, error, createOrder, updateOrder, deleteOrder } = useWorkOrders();
  const [view, setView] = useState('board');
  const [filters, setFilters] = useState({ search: '', facility: 'all', type: 'all', priority: 'all' });
  const [modalOrder, setModalOrder] = useState(undefined); // undefined = closed, null = new, object = editing
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [toast, setToast] = useState({ message: '', kind: 'ok' });
  const toastTimer = useRef(null);

  function showToast(message, kind = 'ok') {
    setToast({ message, kind });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast({ message: '', kind: 'ok' }), 2600);
  }

  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (filters.facility !== 'all' && o.facility !== filters.facility) return false;
      if (filters.type !== 'all' && o.type !== filters.type) return false;
      if (filters.priority !== 'all' && o.priority !== filters.priority) return false;
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const hay = `${o.code} ${o.title} ${o.description || ''} ${o.assigned_to || ''} ${o.location || ''} ${o.equipment || ''}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [orders, filters]);

  function makeActions(o) {
    return {
      onStart: () => handleStatus(o, 'In Progress'),
      onHold: () => handleStatus(o, 'On Hold'),
      onResume: () => handleStatus(o, 'In Progress'),
      onComplete: () => handleStatus(o, 'Completed'),
      onReopen: () => handleStatus(o, 'Open'),
      onEdit: () => setModalOrder(o),
      onAskDelete: () => setDeleteConfirmId(o.id),
      onConfirmDelete: async () => {
        try {
          await deleteOrder(o.id);
          showToast('Work order deleted.');
        } catch (e) {
          showToast(e.message || 'Could not delete.', 'error');
        }
        setDeleteConfirmId(null);
      },
      onCancelDelete: () => setDeleteConfirmId(null)
    };
  }

  async function handleStatus(o, status) {
    try {
      const payload = { status };
      payload.date_completed = status === 'Completed' ? (o.date_completed || todayStr()) : null;
      await updateOrder(o.id, payload);
    } catch (e) {
      showToast(e.message || 'Could not update status.', 'error');
    }
  }

  async function handleSave(form) {
    const { id, code, created_by, created_at, updated_at, ...payload } = form;
    if (id) {
      if (payload.status === 'Completed' && !form.date_completed) payload.date_completed = todayStr();
      if (payload.status !== 'Completed') payload.date_completed = null;
      await updateOrder(id, payload);
      showToast('Work order updated.');
    } else {
      payload.created_by = session.user.id;
      if (payload.status === 'Completed') payload.date_completed = todayStr();
      await createOrder(payload);
      showToast('Work order created.');
    }
    setModalOrder(undefined);
  }

  function exportCSV() {
    if (!filtered.length) { showToast('No work orders to export.', 'error'); return; }
    const headers = ['ID', 'Title', 'Type', 'Facility', 'Location', 'Equipment', 'Priority', 'Status', 'Assigned To', 'Reported By', 'Date Reported', 'Due Date', 'Date Completed', 'Reference', 'Notes'];
    const rows = filtered.map(o => [o.code, o.title, typeLabel(o.type), o.facility, o.location, o.equipment, o.priority, o.status, o.assigned_to, o.reported_by, o.date_reported, o.due_date, o.date_completed, o.reference, o.notes]);
    const csv = [headers, ...rows].map(r => r.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `work-orders-${todayStr()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('CSV exported.');
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand">
          <span className="app-mark"><Icon.Tag /></span>
          <div>
            <h1>Work Order Monitor</h1>
            <p className="app-tagline">Preventive · Corrective · Safety corrective actions</p>
          </div>
        </div>
        <div className="app-header-actions">
          <span className="session-pill">{session.user.email}</span>
          <button className="btn btn-ghost" onClick={exportCSV}><Icon.Download /> Export CSV</button>
          <button className="btn btn-primary" onClick={() => setModalOrder(null)}><Icon.Plus /> New Work Order</button>
          <button className="ibtn" title="Sign out" onClick={() => supabase.auth.signOut()}><Icon.LogOut /></button>
        </div>
      </header>

      <KpiBar orders={filtered} />
      <Controls view={view} setView={setView} filters={filters} setFilters={setFilters} />

      <main>
        {loading ? (
          <div className="loading-state">Loading work orders…</div>
        ) : error ? (
          <div className="empty-state">
            <p className="empty-title">Couldn't load work orders</p>
            <p className="empty-sub">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <p className="empty-title">{orders.length === 0 ? 'No work orders yet' : 'No matches'}</p>
            <p className="empty-sub">
              {orders.length === 0
                ? 'Log your first preventive, corrective, or safety work order to start tracking it here.'
                : 'No work orders match the current filters.'}
            </p>
            {orders.length === 0 && (
              <button className="btn btn-primary" onClick={() => setModalOrder(null)}><Icon.Plus /> New Work Order</button>
            )}
          </div>
        ) : view === 'board' ? (
          <BoardView orders={filtered} deleteConfirmId={deleteConfirmId} makeActions={makeActions} />
        ) : view === 'log' ? (
          <LogView orders={filtered} deleteConfirmId={deleteConfirmId} makeActions={makeActions} />
        ) : (
          <DashboardView orders={filtered} />
        )}
      </main>

      <footer className="app-footer">
        <span>Shared with your team — every change is saved and synced live.</span>
      </footer>

      {modalOrder !== undefined && (
        <WorkOrderModal order={modalOrder} onSave={handleSave} onClose={() => setModalOrder(undefined)} />
      )}
      <Toast message={toast.message} kind={toast.kind} />
    </div>
  );
}
