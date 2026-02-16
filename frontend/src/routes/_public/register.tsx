import { useState, type FormEvent } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useAuth } from '../../context/useAuth'
import { ErrorMessage } from '../../components/ErrorMessage'
import { Button } from '../../components/Button'
import styles from '../../styles/AuthForm.module.css'
import shared from '../../styles/shared.module.css'

export const Route = createFileRoute('/_public/register')({
  component: RegisterPage,
})

function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters')
      return
    }
    setError('')
    setPasswordError('')
    setLoading(true)
    try {
      await register(email, password, displayName)
      navigate({ to: '/' })
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'error' in err
        ? (err as { error: { message: string } }).error.message
        : 'Registration failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`${shared.container} ${styles.page}`}>
      <h1>Create Account</h1>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => {
              if (password.length > 0 && password.length < 8) {
                setPasswordError('Password must be at least 8 characters')
              } else {
                setPasswordError('')
              }
            }}
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
            onChange={(e) => setDisplayName(e.target.value)}
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
