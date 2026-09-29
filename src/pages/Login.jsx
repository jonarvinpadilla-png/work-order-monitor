import { useState } from 'react';
import { supabase } from '../supabaseClient';
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

export default function Login() {
  const [mode, setMode] = useState('signin'); // signin | signup | reset
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError(''); setNotice(''); setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
        if (error) throw error;
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: form.email, password: form.password,
          options: { data: { full_name: form.name.trim() }, emailRedirectTo: window.location.origin }
        });
        if (error) throw error;
        if (!data.session) setNotice('Account created. Open the confirmation link we emailed you, then sign in.');
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(form.email, { redirectTo: window.location.origin });
        if (error) throw error;
        setNotice('If that email has an account, a password reset link is on its way.');
      }
    } catch (err) {
      setError(/Invalid login/i.test(err.message) ? 'That email and password don\'t match an account.' : err.message);
    }
    setBusy(false);
  }

  const switchTo = m => () => { setMode(m); setError(''); setNotice(''); };

  return (
    <div className="auth">
      <AuthArt mode={mode}>
        <h1>Keep every dock, cold room and <span>forklift</span> running.</h1>
        <p>Work orders, preventive maintenance, MHE pre-use checks, spare parts and permits for HAVI Logistics Philippines facilities — in one shared register.</p>
      </AuthArt>
      <div className="auth-panel">
        <h2>{mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create your account' : 'Reset your password'}</h2>
        <p className="dim" style={{ margin: 0 }}>
          {mode === 'signup' ? 'New accounts start as requesters. An admin can give you technician access.' : 'HLPI Facilities CMMS'}
        </p>
        <form onSubmit={submit}>
          {error && <div className="form-error">{error}</div>}
          {notice && <div className="form-note">{notice}</div>}
          {mode === 'signup' && (
            <Field label="Full name" required>
              <input className="input" required value={form.name} onChange={set('name')} autoComplete="name" placeholder="Juan dela Cruz" />
            </Field>
          )}
          <Field label="Work email" required>
            <input className="input" type="email" required value={form.email} onChange={set('email')} autoComplete="email" placeholder="you@havi.com" />
          </Field>
          {mode !== 'reset' && (
            <Field label="Password" required hint={mode === 'signup' ? 'At least 8 characters.' : undefined}>
              <input className="input" type="password" required minLength={mode === 'signup' ? 8 : 6} value={form.password} onChange={set('password')}
                     autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
            </Field>
          )}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
          </button>
        </form>
        <div className="auth-switch">
          {mode === 'signin' && <>
            <button className="link-btn" onClick={switchTo('reset')}>Forgot password?</button>
            <span className="mute"> · </span>
            New here? <button className="link-btn" onClick={switchTo('signup')}>Create an account</button>
          </>}
          {mode !== 'signin' && <>Have an account? <button className="link-btn" onClick={switchTo('signin')}>Sign in</button></>}
        </div>
      </div>
    </div>
  );
}

export function SetNewPassword({ onDone }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { setError(error.message); return; }
    toast('Password updated.');
    onDone();
  }
  return (
    <div className="auth">
      <AuthArt mode="reset"><h1>Set a new <span>password</span>.</h1></AuthArt>
      <div className="auth-panel">
        <h2>Choose a new password</h2>
        <form onSubmit={submit}>
          {error && <div className="form-error">{error}</div>}
          <Field label="New password" required hint="At least 8 characters.">
            <input className="input" type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
          </Field>
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
        </form>
      </div>
    </div>
  );
}
