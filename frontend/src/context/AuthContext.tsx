import {
  createContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import * as authApi from '../api/auth'

interface AuthContextValue {
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  register: (
    email: string,
    password: string,
    displayName: string,
    username?: string,
  ) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
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
      displayName: string,
      username?: string,
    ) => {
      const result = await authApi.register(
        email,
        password,
        displayName,
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
    setToken(null)
  }, [])

  const value = useMemo(
    () => ({ token, login, logout, register }),
    [token, login, logout, register],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
