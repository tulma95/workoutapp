import { useState, type FormEvent } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from '../../context/useAuth'
import { RegisterForm } from '../../components/RegisterForm'

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

  function handlePasswordBlur() {
    if (password.length > 0 && password.length < 8) {
      setPasswordError('Password must be at least 8 characters')
    } else {
      setPasswordError('')
    }
  }

  return (
    <RegisterForm
      email={email}
      password={password}
      displayName={displayName}
      error={error}
      passwordError={passwordError}
      loading={loading}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onPasswordBlur={handlePasswordBlur}
      onDisplayNameChange={setDisplayName}
      onSubmit={handleSubmit}
    />
  )
}
