import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { AuthProvider } from '../context/AuthContext'
import { ToastProvider } from '../components/Toast'
import { RootErrorBoundary } from '../components/RootErrorBoundary'
import { useNotificationStream } from '../hooks/useNotificationStream'

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  errorComponent: RootErrorBoundary,
})

function NotificationSetup() {
  useNotificationStream()
  return null
}

function RootComponent() {
  return (
    <ToastProvider>
      <AuthProvider>
        <NotificationSetup />
        <Outlet />
      </AuthProvider>
    </ToastProvider>
  )
}
