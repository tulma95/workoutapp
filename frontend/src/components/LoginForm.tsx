import { type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { ErrorMessage } from './ErrorMessage'
import { Button } from './Button'
import styles from '../styles/AuthForm.module.css'
import shared from '../styles/shared.module.css'

type Props = {
  email: string
  password: string
  error: string
  loading: boolean
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSubmit: (e: FormEvent) => void
}

export function LoginForm({ email, password, error, loading, onEmailChange, onPasswordChange, onSubmit }: Props) {
  return (
    <div className={`${shared.container} ${styles.page}`}>
      <h1>Log In</h1>

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
            required
          />
        </div>

        {error && <ErrorMessage message={error} />}

        <Button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Log In'}
        </Button>
      </form>

      <p className={styles.footer}>
        Don't have an account? <Link to="/register">Register</Link>
      </p>
    </div>
  )
}
