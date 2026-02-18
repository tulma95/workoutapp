import { type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { ErrorMessage } from './ErrorMessage'
import { Button } from './Button'
import styles from '../styles/AuthForm.module.css'
import shared from '../styles/shared.module.css'

type Props = {
  email: string
  password: string
  displayName: string
  error: string
  passwordError: string
  loading: boolean
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onPasswordBlur: () => void
  onDisplayNameChange: (value: string) => void
  onSubmit: (e: FormEvent) => void
}

export function RegisterForm({
  email,
  password,
  displayName,
  error,
  passwordError,
  loading,
  onEmailChange,
  onPasswordChange,
  onPasswordBlur,
  onDisplayNameChange,
  onSubmit,
}: Props) {
  return (
    <div className={`${shared.container} ${styles.page}`}>
      <h1>Create Account</h1>

      <form onSubmit={onSubmit} className={styles.form}>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            onBlur={onPasswordBlur}
            required
          />
          {passwordError && (
            <p className={styles.error}>{passwordError}</p>
          )}
        </div>

        <div>
          <label htmlFor="displayName">Display Name</label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => onDisplayNameChange(e.target.value)}
            required
          />
        </div>

        {error && <ErrorMessage message={error} />}

        <Button type="submit" disabled={loading}>
          {loading ? 'Creating account...' : 'Create Account'}
        </Button>
      </form>

      <p className={styles.footer}>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  )
}
