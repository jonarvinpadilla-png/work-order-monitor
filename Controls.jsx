import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Icon } from '../lib/icons';

export default function Login() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setNotice('Account created. Check your email to confirm, then sign in.');
    }
    setBusy(false);
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="mark"><Icon.Tag /></span>
          <h1>Work Order Monitor</h1>
        </div>
        {error && <div className="auth-error">{error}</div>}
        {notice && <div className="auth-note">{notice}</div>}
        <form onSubmit={handleSubmit}>
          <label>
            Email
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
          </label>
          <label>
            Password
            <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" />
          </label>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <div className="auth-toggle">
          {mode === 'signin' ? (
            <>New here? <button onClick={() => { setMode('signup'); setError(''); setNotice(''); }}>Create an account</button></>
          ) : (
            <>Already have an account? <button onClick={() => { setMode('signin'); setError(''); setNotice(''); }}>Sign in</button></>
          )}
        </div>
      </div>
    </div>
  );
}
