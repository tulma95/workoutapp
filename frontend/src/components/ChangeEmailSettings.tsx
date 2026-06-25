import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { changeEmail } from '../api/user'
import { queryKeys } from '../api/queryKeys'
import { useToast } from './Toast'
import { extractErrorMessage } from '../api/errors'
import styles from '../styles/ChangePasswordSettings.module.css'

export function ChangeEmailSettings() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await changeEmail(password, email)
      await queryClient.invalidateQueries({ queryKey: queryKeys.user.me() })
      toast.success('Email updated')
      setEmail('')
      setPassword('')
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to change email'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className={styles.card}>
      <h3 className={styles.label}>Change email</h3>
      <form onSubmit={onSubmit} className={styles.form}>
        <input
          type="email"
          autoComplete="email"
          placeholder="New email"
          aria-label="New email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Current password"
          aria-label="Current password for email change"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <button type="submit" className={styles.button} disabled={loading}>
          {loading ? 'Saving…' : 'Update email'}
        </button>
      </form>
    </section>
  )
}
