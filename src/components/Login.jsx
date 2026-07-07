import { useState } from 'react';
import { signIn } from '../lib/auth.js';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signIn(username, password);
      // App.jsx listens for the Supabase auth state change and will
      // switch views automatically once the session appears.
    } catch (err) {
      setError(err.message || 'Sign in failed.');
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={handleSubmit} autoComplete="on">
        <div className="login-mark">NCS</div>
        <h1>NCS Boards</h1>
        <p className="sub">Sign in to view the Appraisal Board.</p>

        <div className={`login-error${error ? ' show' : ''}`}>{error}</div>

        <div className="field">
          <label htmlFor="username">Username</label>
          <input
            type="text" id="username" name="username" autoComplete="username"
            autoFocus required value={username}
            onChange={e => setUsername(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            type="password" id="password" name="password" autoComplete="current-password"
            required value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Signing in...' : 'Sign in'}
        </button>

        <div className="login-hint">
          First run? Create logins with <code>npm run add-user</code> (see README).
        </div>
      </form>
    </div>
  );
}
