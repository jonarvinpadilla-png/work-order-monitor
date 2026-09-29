import { useEffect, useState } from 'react';
import { auth } from '../data/api';
import { Field } from '../components/ui';
import { useToast } from '../components/Toast';
import { ChargingRoom, FreezerAisle, LoadingDock } from '../illustrations/scenes';
import { Icon } from '../lib/icons';
import { photoFor } from '../illustrations/photos';

const SCENES = {
  signin: { Scene: FreezerAisle, caption: 'Freezer aisle F07 · −22.4 °C' },
  signup: { Scene: LoadingDock, caption: 'Loading docks · first light' },
  reset: { Scene: ChargingRoom, caption: 'Battery charging room' }
};

// Left half of the sign-in screens: a warehouse scene with the headline over it.
export function AuthArt({ mode, children }) {
  const key = SCENES[mode] ? mode : 'signin';
  const { Scene, caption } = SCENES[key];
  const photo = photoFor(key);
  return (
    <div className="auth-art">
      {photo ? <img className="auth-scene" src={photo} alt="" /> : <Scene className="auth-scene" />}
      <div className="auth-brand-row">
        <span className="brand-mark"><Icon.Forklift /></span>
        <div>
          <div className="brand-name">HLPI Facilities</div>
          <div className="brand-sub">CMMS · Facilities &amp; MHE</div>
        </div>
      </div>
      <div className="auth-copy">{children}</div>
      {!photo && <span className="auth-caption">{caption}</span>}
    </div>
  );
}

const SCENE_FOR = { signin: 'signin', signup: 'signup', setup: 'signup', forgot: 'reset' };

export default function Login({ onSignedIn, notice: initialNotice }) {
  const [setup, setSetup] = useState(null);
  const [mode, setMode] = useState('signin'); // signin | signup | setup | forgot
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(initialNotice || '');
  const [busy, setBusy] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    let alive = true;
    auth.setup()
      .then(s => {
        if (!alive) return;
        setSetup(s);
        if (s.needsAdmin) setMode('setup');
      })
      .catch(e => alive && setError(e.message));
    return () => { alive = false; };
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError(''); setNotice(''); setBusy(true);
    try {
      const session = mode === 'signin'
        ? await auth.signIn(form.email, form.password)
        : await auth.signUp({ email: form.email, password: form.password, full_name: form.name.trim() });
      onSignedIn(session);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const switchTo = m => () => { setMode(m); setError(''); setNotice(''); };
  const allowSignup = setup ? setup.allowSignup : true;
  const org = setup?.orgName || 'HAVI Logistics Philippines';

  return (
    <div className="auth">
      <AuthArt mode={SCENE_FOR[mode]}>
        {mode === 'setup'
          ? <><h1>Set up your <span>facilities</span> register.</h1><p>Create the admin account first. Then add your team, your site and your equipment, or load the sample distribution centre to look around.</p></>
          : <><h1>Keep every dock, cold room and <span>forklift</span> running.</h1><p>Work orders, preventive maintenance, MHE pre-use checks, spare parts and permits for {org} facilities, in one shared register.</p></>}
      </AuthArt>
      <div className="auth-panel">
        <h2>{mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create your account' : mode === 'setup' ? 'Create the admin account' : 'Forgot your password?'}</h2>
        <p className="dim" style={{ margin: 0 }}>
          {mode === 'signup' ? 'New accounts start as requesters. An admin can give you technician access.'
            : mode === 'setup' ? 'This first account manages users, settings and approvals.'
            : 'HLPI Facilities CMMS'}
        </p>

        {mode === 'forgot' ? (
          <>
            <div className="form-note" style={{ marginTop: 18 }}>
              Passwords are reset by a CMMS admin. Ask them to set a temporary password for you under
              <b> Settings → Users &amp; roles</b>. You will choose your own password the next time you sign in.
            </div>
            <div className="auth-switch"><button className="link-btn" onClick={switchTo('signin')}>Back to sign in</button></div>
          </>
        ) : mode === 'setup' && setup && !setup.canSetUp ? (
          <div className="form-note" style={{ marginTop: 18 }}>
            The admin account has to be created on the server PC itself. On that PC, open
            <b> http://localhost{window.location.port ? `:${window.location.port}` : ''}</b> in a browser.
          </div>
        ) : (
          <>
            <form onSubmit={submit}>
              {error && <div className="form-error">{error}</div>}
              {notice && <div className="form-note">{notice}</div>}
              {(mode === 'signup' || mode === 'setup') && (
                <Field label="Full name" required>
                  <input className="input" required value={form.name} onChange={set('name')} autoComplete="name" placeholder="Juan dela Cruz" />
                </Field>
              )}
              <Field label="Work email" required>
                <input className="input" type="email" required value={form.email} onChange={set('email')} autoComplete="email" placeholder="you@havi.com" />
              </Field>
              <Field label="Password" required hint={mode === 'signin' ? undefined : 'At least 8 characters.'}>
                <input className="input" type="password" required minLength={mode === 'signin' ? undefined : 8} value={form.password} onChange={set('password')}
                       autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
              </Field>
              <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
                {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'setup' ? 'Create admin account' : 'Create account'}
              </button>
            </form>
            <div className="auth-switch">
              {mode === 'signin' && <>
                <button className="link-btn" onClick={switchTo('forgot')}>Forgot password?</button>
                {allowSignup && <><span className="mute"> · </span>New here? <button className="link-btn" onClick={switchTo('signup')}>Create an account</button></>}
              </>}
              {mode === 'signup' && <>Have an account? <button className="link-btn" onClick={switchTo('signin')}>Sign in</button></>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// After an admin sets a temporary password, the person picks their own.
export function SetNewPassword({ onDone, onSignOut }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (password !== confirm) { setError('The two passwords are different.'); return; }
    setBusy(true);
    try {
      const session = await auth.changePassword(undefined, password);
      toast('Password saved.');
      onDone(session);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }
  return (
    <div className="auth">
      <AuthArt mode="reset"><h1>Choose your own <span>password</span>.</h1><p>You signed in with a temporary password. Pick one only you know before you continue.</p></AuthArt>
      <div className="auth-panel">
        <h2>Choose a new password</h2>
        <form onSubmit={submit}>
          {error && <div className="form-error">{error}</div>}
          <Field label="New password" required hint="At least 8 characters.">
            <input className="input" type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
          </Field>
          <Field label="Type it again" required>
            <input className="input" type="password" required minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
          </Field>
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
        </form>
        <div className="auth-switch"><button className="link-btn" onClick={onSignOut}>Sign out</button></div>
      </div>
    </div>
  );
}
