import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import Login from './components/Login.jsx'
import UploadConsole from './components/UploadConsole.jsx'
import Viewer from './components/Viewer.jsx'
import { clearSession, getSession } from './auth/session.js'
import './App.css'

function PrivateUpload() {
  if (!getSession()) {
    return <Navigate to="/login" replace state={{ from: { pathname: '/upload' } }} />
  }
  return <UploadConsole />
}

function HeaderNav() {
  const navigate = useNavigate()
  const session = getSession()

  function logout() {
    clearSession()
    navigate('/login', { replace: true })
  }

  return (
    <header className="app-header">
      <div className="app-brand">
        <span className="app-brand-mark" aria-hidden="true" />
        <div>
          <strong>DHL SmartHub</strong>
          <span className="app-brand-sub">Phase 3 — Knowledge Base MVP</span>
        </div>
      </div>
      <nav className="app-nav" aria-label="Primary">
        <NavLink
          to="/viewer"
          className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
        >
          Viewer
        </NavLink>
        <NavLink
          to="/upload"
          className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
        >
          Upload
        </NavLink>
        {session ? (
          <span className="nav-meta" title="Signed in locally (demo)">
            {session.username}
          </span>
        ) : (
          <NavLink
            to="/login"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            Login
          </NavLink>
        )}
        {session ? (
          <button type="button" className="nav-btn" onClick={logout}>
            Log out
          </button>
        ) : null}
      </nav>
    </header>
  )
}

export default function App() {
  return (
    <div className="app">
      <HeaderNav />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/viewer" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/upload" element={<PrivateUpload />} />
          <Route path="/viewer" element={<Viewer />} />
          <Route path="*" element={<Navigate to="/viewer" replace />} />
        </Routes>
      </main>
    </div>
  )
}
