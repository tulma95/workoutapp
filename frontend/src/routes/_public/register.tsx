import { useState, type FormEvent } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from '../../context/useAuth'
import { RegisterForm } from '../../components/RegisterForm'
import { validateUsername } from '../../utils/validators'

export const Route = createFileRoute('/_public/register')({
  component: RegisterPage,
})

function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters')
      return
    }
    const trimmedUsername = username.trim()
    const uError = validateUsername(trimmedUsername)
    if (uError) {
      setUsernameError(uError)
      return
    }
    setError('')
    setPasswordError('')
    setUsernameError('')
    setLoading(true)
    try {
      await register(email, password, trimmedUsername)
      navigate({ to: '/' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed'
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

  function handleUsernameBlur() {
    setUsernameError(validateUsername(username.trim()))
  }

  return (
    <RegisterForm
      email={email}
      password={password}
      username={username}
      error={error}
      passwordError={passwordError}
      usernameError={usernameError}
      loading={loading}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onPasswordBlur={handlePasswordBlur}
      onUsernameChange={setUsername}
      onUsernameBlur={handleUsernameBlur}
      onSubmit={handleSubmit}
    />
  )
}
