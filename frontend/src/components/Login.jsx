import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { loginRequest } from '../services/api.js'
import { getSession, setSession } from '../auth/session.js'
import styles from './Login.module.css'

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2a5 5 0 00-5 5v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V7a5 5 0 00-5-5zm-3 8V7a3 3 0 116 0v3H9z"
        fill="currentColor"
      />
    </svg>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/viewer'

  useEffect(() => {
    if (getSession()) {
      navigate(from, { replace: true })
    }
  }, [from, navigate])

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const u = username.trim()
    if (u.length < 2) {
      setError('Enter a username (at least 2 characters).')
      return
    }
    if (password.length < 1) {
      setError('Enter a password.')
      return
    }

    setBusy(true)
    try {
      const user = await loginRequest(u, password)
      if (!user || typeof user.id !== 'number') {
        throw new Error('Unexpected login response from server')
      }
      setSession({
        userId: user.id,
        username: user.username,
        role: user.role === 'admin' ? 'admin' : 'editor',
      })
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.panel}>
        <div className={styles.badge}>
          <LockIcon />
          Secure workspace
        </div>
        <h1 className={styles.title}>Sign in to SmartHub</h1>
        <p className={styles.sub}>
          DHL SmartHub — Knowledge Base MVP. Credentials are checked against the{' '}
          <code>users</code> table via <code>POST /api/auth/login</code>. Editors created by
          the RPA bot and the seed script can sign in with the same flow.
        </p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          <div className={styles.field}>
            <label htmlFor="smarthub-user">Username</label>
            <input
              id="smarthub-user"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin_karen or ops.editor"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="smarthub-pass">Password</label>
            <input
              id="smarthub-pass"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
            <p className={styles.hint}>
              Seeded accounts use <code>demo</code> as the password until you run the
              real bcrypt rehash script.
            </p>
          </div>

          <button className={styles.submit} type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Continue'}
          </button>
        </form>

        <p className={styles.footer}>
          Demo accounts seeded: <code>admin_karen</code>, <code>ops.editor</code>,{' '}
          <code>ops.reviewer</code>, <code>bot.rpa</code> — all with password{' '}
          <code>demo</code>.
        </p>
      </div>
    </div>
  )
}
