import { useState, type FormEvent } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useAuth } from '../../context/useAuth'
import { ErrorMessage } from '../../components/ErrorMessage'
import type { UnitPreference } from '../../types'
import '../../styles/AuthForm.css'

export const Route = createFileRoute('/_public/register')({
  component: RegisterPage,
})

function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [unitPreference, setUnitPreference] = useState<UnitPreference>('kg')
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
      await register(email, password, displayName, unitPreference)
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
    <div className="container auth-page">
      <h1>Create Account</h1>

      <form onSubmit={handleSubmit} className="auth-form">
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
            <p className="auth-form__error">{passwordError}</p>
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

        <div>
          <span className="auth-form__label">Unit Preference</span>
          <div className="auth-form__unit-options">
            <label className="auth-form__unit-label">
              <input
                type="radio"
                name="unitPreference"
                value="kg"
                checked={unitPreference === 'kg'}
                onChange={() => setUnitPreference('kg')}
              />
              kg
            </label>
            <label className="auth-form__unit-label">
              <input
                type="radio"
                name="unitPreference"
                value="lb"
                checked={unitPreference === 'lb'}
                onChange={() => setUnitPreference('lb')}
              />
              lb
            </label>
          </div>
        </div>

        {error && <ErrorMessage message={error} />}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p className="auth-page__footer">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  )
}
