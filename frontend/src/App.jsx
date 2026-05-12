import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from './pages/LoginPage.jsx'
import UploadPage from './pages/UploadPage.jsx'
import ViewerPage from './pages/ViewerPage.jsx'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand">
          <span className="app-brand-mark" aria-hidden="true" />
          <div>
            <strong>DHL KB Automation</strong>
            <span className="app-brand-sub">Scenario 1 — Knowledge base</span>
          </div>
        </div>
        <nav className="app-nav" aria-label="Primary">
          <NavLink
            to="/login"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            Login
          </NavLink>
          <NavLink
            to="/upload"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            Upload
          </NavLink>
          <NavLink
            to="/viewer"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            Viewer
          </NavLink>
        </nav>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/viewer" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/viewer" element={<ViewerPage />} />
          <Route path="*" element={<Navigate to="/viewer" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
