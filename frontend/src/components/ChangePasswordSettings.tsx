import { useState, type FormEvent } from 'react'
import { changePassword } from '../api/user'
import { useToast } from './Toast'
import { extractErrorMessage } from '../api/errors'
import styles from '../styles/ChangePasswordSettings.module.css'

export function ChangePasswordSettings() {
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    // Mirror the backend's min(8) and catch the mismatch before a round-trip.
    if (next.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    if (next !== confirm) {
      setError('New passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await changePassword(current, next)
      toast.success('Password changed')
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to change password'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className={styles.card}>
      <h3 className={styles.label}>Change password</h3>
      <form onSubmit={onSubmit} className={styles.form}>
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Current password"
          aria-label="Current password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="New password"
          aria-label="New password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Confirm new password"
          aria-label="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <button type="submit" className={styles.button} disabled={loading}>
          {loading ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </section>
  )
}
