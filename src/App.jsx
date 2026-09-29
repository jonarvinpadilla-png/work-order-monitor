import { useEffect, useRef, useState } from 'react';
import { isConfigured, supabase } from './supabaseClient';
import { DataProvider, useData } from './data/DataProvider';
import { db } from './data/api';
import { ToastProvider, useToast } from './components/Toast';
import { GlobalActionsProvider } from './components/GlobalActions';
import Layout from './components/Layout';
import { EmptyState, Loading } from './components/ui';
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

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(isConfigured);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!isConfigured) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!isConfigured) return <SetupNeeded />;
  if (loading) return <Loading />;
  return (
    <ToastProvider>
      {recovery ? <SetNewPassword onDone={() => setRecovery(false)} />
        : !session ? <Login />
        : <SignedIn userId={session.user.id} />}
    </ToastProvider>
  );
}

function SetupNeeded() {
  return (
    <div className="content">
      <EmptyState title="Almost there: connect the database">
        This copy of the CMMS has no Supabase settings yet. Add <code>VITE_SUPABASE_URL</code> and{' '}
        <code>VITE_SUPABASE_ANON_KEY</code> (Vercel → Project → Settings → Environment Variables, or a local
        <code> .env</code> file), then redeploy. The README walks through it.
      </EmptyState>
    </div>
  );
}

function SignedIn({ userId }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      // The profile row is created by a database trigger at sign-up; give it a moment.
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        if (!alive) return;
        if (error) { setError(error.message); return; }
        if (data) { setProfile(data); return; }
        await new Promise(r => setTimeout(r, 800));
      }
      if (alive) setError('Your account has no profile. Ask the admin to check that supabase/schema.sql has been run.');
    })();
    return () => { alive = false; };
  }, [userId]);

  if (error) return <AccountProblem message={error} />;
  if (!profile) return <Loading label="Signing in…" />;
  if (!profile.active) return <AccountProblem message="Your account has been deactivated. Ask a CMMS admin to re-activate it." />;
  return (
    <DataProvider profile={profile}>
      <GlobalActionsProvider>
        <Shell />
      </GlobalActionsProvider>
    </DataProvider>
  );
}

function AccountProblem({ message }) {
  return (
    <div className="content">
      <EmptyState title="Can't open the CMMS" action={<button className="btn" onClick={() => supabase.auth.signOut()}>Sign out</button>}>
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

  if (data.loading) return <Loading label="Loading your facility…" />;
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
    default: page = <EmptyState title="Page not found">That address doesn't match anything in the CMMS.</EmptyState>;
  }
  return <Layout section={section}>{page}</Layout>;
}

function NotAllowed() {
  return <EmptyState title="Technicians and admins only">Your account can submit requests and pre-use checks. Ask an admin if you need more access.</EmptyState>;
}
