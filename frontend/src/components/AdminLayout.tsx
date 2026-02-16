import { Link, Outlet, useLocation } from '@tanstack/react-router'
import { ToastProvider } from './Toast'
import './AdminLayout.css'

export function AdminLayout() {
  const location = useLocation()

  const isPlansActive = location.pathname.startsWith('/admin/plans')
  const isExercisesActive = location.pathname === '/admin/exercises'

  return (
    <ToastProvider>
    <div className="admin-layout">
      <header className="admin-header">
        <div className="admin-header-content">
          <h1 className="admin-title">Admin</h1>
          <Link to="/" className="back-to-app-link">
            &larr; Back to App
          </Link>
        </div>
      </header>

      <nav className="admin-tabs">
        <Link
          to="/admin/plans"
          className={`admin-tab ${isPlansActive ? 'admin-tab-active' : ''}`}
        >
          Plans
        </Link>
        <Link
          to="/admin/exercises"
          className={`admin-tab ${isExercisesActive ? 'admin-tab-active' : ''}`}
        >
          Exercises
        </Link>
      </nav>

      <main className="admin-main"><Outlet /></main>
    </div>
    </ToastProvider>
  )
}
