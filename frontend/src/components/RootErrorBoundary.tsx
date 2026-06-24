import { useEffect } from 'react'
import styles from '../styles/RootErrorBoundary.module.css'

// Catch-all for uncaught render/loader errors anywhere in the route tree. Without
// this, TanStack Router shows its bare default error page — an unrecoverable
// white screen mid-workout on a phone.
export function RootErrorBoundary({ error }: { error: Error }) {
  useEffect(() => {
    // Still surface the real error for diagnostics behind the friendly screen.
    console.error('Unhandled application error:', error)
  }, [error])

  return (
    <div className={styles.root} role="alert">
      <div className={styles.content}>
        <h1 className={styles.title}>Something went wrong</h1>
        <p className={styles.message}>
          The app hit an unexpected error. Reloading usually fixes it.
        </p>
        <button className={styles.button} onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    </div>
  )
}
