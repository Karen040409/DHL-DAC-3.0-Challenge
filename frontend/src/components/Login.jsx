import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getSession, setSession } from '../auth/session.js'
import styles from './Login.module.css'

const defaultUserId = Number(import.meta.env.VITE_DEFAULT_USER_ID) || 1

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
  const [role, setRole] = useState('editor')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const u = username.trim()
    if (u.length < 2) {
      setError('Enter a username (at least 2 characters).')
      return
    }
    if (password.length < 4) {
      setError('For this demo, use a password with at least 4 characters.')
      return
    }

    setBusy(true)
    window.setTimeout(() => {
      setSession({
        userId: defaultUserId,
        username: u,
        role: role === 'admin' ? 'admin' : 'editor',
      })
      setBusy(false)
      navigate(from, { replace: true })
    }, 380)
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
          DHL SmartHub — Knowledge Base MVP. Session is stored locally for this demo;
          the server still validates <code>creator_id</code> on writes.
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
              placeholder="e.g. ops.editor"
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
              placeholder="Demo password"
            />
            <p className={styles.hint}>Mock login — credentials are not sent to the server.</p>
          </div>

          <div className={styles.row}>
            <label className={styles.role}>
              Role
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </label>
          </div>

          <button className={styles.submit} type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Continue'}
          </button>
        </form>

        <p className={styles.footer}>
          Default <code>creator_id</code> for new drafts:{' '}
          <code>{String(defaultUserId)}</code> — ensure this user exists in MySQL.
        </p>
      </div>
    </div>
  )
}
