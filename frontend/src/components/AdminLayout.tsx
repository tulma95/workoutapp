import { Link, Outlet, useLocation } from '@tanstack/react-router'
import { ToastProvider } from './Toast'
import styles from './AdminLayout.module.css'

export function AdminLayout() {
  const location = useLocation()

  const isPlansActive = location.pathname.startsWith('/admin/plans')
  const isExercisesActive = location.pathname === '/admin/exercises'

  return (
    <ToastProvider>
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>Admin</h1>
          <Link to="/" className={styles.backLink}>
            &larr; Back to App
          </Link>
        </div>
      </header>

      <nav className={styles.tabs}>
        <Link
          to="/admin/plans"
          className={`${styles.tab} ${isPlansActive ? styles.tabActive : ''}`}
        >
          Plans
        </Link>
        <Link
          to="/admin/exercises"
          className={`${styles.tab} ${isExercisesActive ? styles.tabActive : ''}`}
        >
          Exercises
        </Link>
      </nav>

      <main className={styles.main}><Outlet /></main>
    </div>
    </ToastProvider>
  )
}
