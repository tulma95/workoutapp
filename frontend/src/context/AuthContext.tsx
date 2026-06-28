import {
  createContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import * as authApi from '../api/auth'
import { clearSetLogQueue } from '../utils/setLogQueue'

interface AuthContextValue {
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  register: (
    email: string,
    password: string,
    username: string,
  ) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('accessToken'),
  )

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password)
    localStorage.setItem('accessToken', result.accessToken)
    localStorage.setItem('refreshToken', result.refreshToken)
    setToken(result.accessToken)
  }, [])

  const register = useCallback(
    async (
      email: string,
      password: string,
      username: string,
    ) => {
      const result = await authApi.register(
        email,
        password,
        username,
      )
      localStorage.setItem('accessToken', result.accessToken)
      localStorage.setItem('refreshToken', result.refreshToken)
      setToken(result.accessToken)
    },
    [],
  )

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    // Don't let one user's un-delivered offline set-logs flush under the next
    // user's credentials on a shared device.
    clearSetLogQueue()
    // Wipe the React Query cache so stale workout/feed data doesn't linger in
    // memory on a shared device after the session ends. Also covers account
    // deletion, which calls logout() before navigating away.
    queryClient.clear()
    setToken(null)
  }, [queryClient])

  const value = useMemo(
    () => ({ token, login, logout, register }),
    [token, login, logout, register],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
