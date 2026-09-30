import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DataProvider, useData } from './data/DataProvider';
import { auth, db, onSignedOut } from './data/api';
import { SessionContext, useSession } from './data/session';
import { ToastProvider, useToast } from './components/Toast';
import { GlobalActionsProvider } from './components/GlobalActions';
import Layout from './components/Layout';
import { EmptyState } from './components/ui';
import Splash from './components/Splash';
import { useRoute } from './lib/router';
import { plural } from './lib/format';
import Login, { SetNewPassword } from './pages/Login';
import Dashboard from './pages/Dashboard';
import RequesterHome from './pages/RequesterHome';
import WorkOrders from './pages/WorkOrders';
import WorkOrderDetail from './pages/WorkOrderDetail';
import Requests from './pages/Requests';
import MheHub from './pages/MheHub';
import PreUseCheck from './pages/PreUseCheck';
import Assets from './pages/Assets';
import AssetDetail from './pages/AssetDetail';
import PmSchedules from './pages/PmSchedules';
import Parts from './pages/Parts';
import Vendors from './pages/Vendors';
import Compliance from './pages/Compliance';
import Settings from './pages/Settings';
import { PlaceScan, UnitScan } from './pages/Scan';
import Labels from './pages/Labels';

export default function App() {
  const [state, setState] = useState({ status: 'loading' }); // loading | offline | signed-out | signed-in
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    auth.session()
      .then(session => alive && setState({ status: 'signed-in', session }))
      .catch(e => alive && setState(e.status === 401 ? { status: 'signed-out' } : { status: 'offline', message: e.message }));
    const off = onSignedOut(() => setState({ status: 'signed-out', notice: 'Your session has ended. Sign in again.' }));
    return () => { alive = false; off(); };
  }, [attempt]);

  const signOut = useCallback(async () => {
    try { await auth.signOut(); } catch { /* signed out locally either way */ }
    setState({ status: 'signed-out' });
  }, []);
  const signedIn = useCallback(session => setState({ status: 'signed-in', session }), []);
  const ctx = useMemo(() => ({ session: state.session || null, signOut }), [state.session, signOut]);

  if (state.status === 'loading') return <Splash />;
  if (state.status === 'offline') {
    return (
      <div className="content">
        <EmptyState title="Can't reach the CMMS server" action={<button className="btn btn-primary" onClick={() => { setState({ status: 'loading' }); setAttempt(a => a + 1); }}>Try again</button>}>
          {state.message}
        </EmptyState>
      </div>
    );
  }
  return (
    <ToastProvider>
      <SessionContext.Provider value={ctx}>
        {state.status === 'signed-out' ? <Login onSignedIn={signedIn} notice={state.notice} />
          : state.session.mustChangePassword ? <SetNewPassword onDone={signedIn} onSignOut={signOut} />
          : <SignedIn key={state.session.user.id} profile={state.session.profile} />}
      </SessionContext.Provider>
    </ToastProvider>
  );
}

function SignedIn({ profile }) {
  if (!profile?.active) return <AccountProblem message="Your account has been deactivated. Ask a CMMS admin to re-activate it." />;
  return (
    <DataProvider profile={profile}>
      <GlobalActionsProvider>
        <Shell />
      </GlobalActionsProvider>
    </DataProvider>
  );
}

function AccountProblem({ message }) {
  const { signOut } = useSession();
  return (
    <div className="content">
      <EmptyState title="Can't open the CMMS" action={<button className="btn" onClick={signOut}>Sign out</button>}>
        {message}
      </EmptyState>
    </div>
  );
}

function Shell() {
  const data = useData();
  const route = useRoute();
  const toast = useToast();
  const generated = useRef(false);

  // Create any preventive maintenance work orders that have come due.
  useEffect(() => {
    if (data.loading || !data.isStaff || generated.current) return;
    generated.current = true;
    db.rpc('generate_pm_work_orders')
      .then(n => {
        if (n > 0) {
          toast(`${plural(n, 'preventive maintenance work order')} created for work coming due.`);
          data.refreshTables('work_orders', 'pm_schedules');
        }
      })
      .catch(e => console.warn('PM generation skipped:', e.message));
  }, [data.loading, data.isStaff]); // eslint-disable-line react-hooks/exhaustive-deps

  if (data.loading) return <Splash label="Loading your facility…" />;
  if (data.error) return <AccountProblem message={`Could not load data: ${data.error}`} />;

  const [section, id, sub] = route.segments;
  const staffOnly = el => (data.isStaff ? el : <NotAllowed />);
  let page;
  switch (section) {
    case undefined: page = data.isStaff ? <Dashboard /> : <RequesterHome />; break;
    case 'work-orders': page = id ? <WorkOrderDetail id={id} /> : staffOnly(<WorkOrders />); break;
    case 'requests': page = <Requests />; break;
    case 'mhe': page = id && sub === 'check' ? <PreUseCheck assetId={id} /> : <MheHub />; break;
    case 'assets': page = staffOnly(id ? <AssetDetail id={id} /> : <Assets />); break;
    case 'pm': page = staffOnly(<PmSchedules />); break;
    case 'parts': page = staffOnly(<Parts />); break;
    case 'vendors': page = staffOnly(<Vendors />); break;
    case 'compliance': page = staffOnly(<Compliance />); break;
    case 'settings': page = <Settings />; break;
    case 'u': page = <UnitScan code={id || ''} />; break;
    case 'p': page = <PlaceScan id={id || ''} />; break;
    case 'labels': page = staffOnly(<Labels />); break;
    default: page = <EmptyState title="Page not found">That address doesn't match anything in the CMMS.</EmptyState>;
  }
  return <Layout section={section}>{page}</Layout>;
}

function NotAllowed() {
  return <EmptyState title="Technicians and admins only">Your account can submit requests and pre-use checks. Ask an admin if you need more access.</EmptyState>;
}
