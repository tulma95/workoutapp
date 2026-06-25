import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '../context/useAuth'
import { deleteAccount } from '../api/user'
import { extractErrorMessage } from '../api/errors'
import styles from '../styles/DeleteAccountSettings.module.css'

// Danger zone: permanently delete the account and all owned data. Required for
// GDPR/CCPA and app-store compliance. Re-confirms with the password so a
// borrowed/unlocked phone can't nuke the account in one tap.
export function DeleteAccountSettings() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [confirming, setConfirming] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function cancel() {
    setConfirming(false)
    setPassword('')
    setError('')
  }

  async function onDelete() {
    setError('')
    setLoading(true)
    try {
      await deleteAccount(password)
      logout() // clears tokens + the offline set-log queue
      navigate({ to: '/login' })
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to delete account'))
      setLoading(false)
    }
  }

  return (
    <section className={styles.card}>
      <h3 className={styles.label}>Delete account</h3>
      {!confirming ? (
        <>
          <p className={styles.text}>
            Permanently delete your account and all your data. This cannot be undone.
          </p>
          <button className={styles.dangerBtn} onClick={() => setConfirming(true)}>
            Delete account
          </button>
        </>
      ) : (
        <>
          <p className={styles.text}>
            Enter your password to permanently delete your account and all data.
          </p>
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            aria-label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <div className={styles.actions}>
            <button className={styles.cancelBtn} onClick={cancel} disabled={loading}>
              Cancel
            </button>
            <button
              className={styles.dangerBtn}
              onClick={onDelete}
              disabled={loading || !password}
            >
              {loading ? 'Deleting…' : 'Permanently delete'}
            </button>
          </div>
        </>
      )}
    </section>
  )
}
