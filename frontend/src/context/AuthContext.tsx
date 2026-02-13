import {
  createContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react'
import { apiFetch } from '../api/client'
import * as authApi from '../api/auth'
import type { User } from '../api/schemas'
import type { UnitPreference } from '../types'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAdmin: boolean
  activePlanId: number | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  register: (
    email: string,
    password: string,
    displayName: string,
    unitPreference: UnitPreference,
  ) => Promise<void>
  refreshActivePlan: () => Promise<void>
  refreshUser: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activePlanId, setActivePlanId] = useState<number | null>(null)

  const fetchActivePlan = useCallback(async () => {
    try {
      const plan = await apiFetch('/plans/current')
      if (plan && typeof plan === 'object' && 'id' in plan) {
        setActivePlanId(plan.id as number)
      } else {
        setActivePlanId(null)
      }
    } catch {
      setActivePlanId(null)
    }
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      setIsLoading(false)
      return
    }

    apiFetch('/users/me')
      .then(async (data) => {
        setUser(data as User)
        await fetchActivePlan()
      })
      .catch(() => {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [fetchActivePlan])

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password)
    localStorage.setItem('accessToken', result.accessToken)
    localStorage.setItem('refreshToken', result.refreshToken)
    setUser(result.user)
    await fetchActivePlan()
  }, [fetchActivePlan])

  const register = useCallback(
    async (
      email: string,
      password: string,
      displayName: string,
      unitPreference: UnitPreference,
    ) => {
      const result = await authApi.register(
        email,
        password,
        displayName,
        unitPreference,
      )
      localStorage.setItem('accessToken', result.accessToken)
      localStorage.setItem('refreshToken', result.refreshToken)
      setUser(result.user)
      await fetchActivePlan()
    },
    [fetchActivePlan],
  )

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    setUser(null)
    setActivePlanId(null)
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiFetch('/users/me')
      setUser(data as User)
    } catch (error) {
      console.error('Failed to refresh user data:', error)
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAdmin: user?.isAdmin ?? false,
      activePlanId,
      login,
      logout,
      register,
      refreshActivePlan: fetchActivePlan,
      refreshUser,
    }),
    [user, isLoading, activePlanId, login, logout, register, fetchActivePlan, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
