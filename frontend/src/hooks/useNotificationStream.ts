import { useEffect, useRef, useContext } from 'react'
import { AuthContext } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { notificationEventSchema } from '../api/schemas'

export function useNotificationStream() {
  const auth = useContext(AuthContext)
  const toast = useToast()
  const token = auth?.token ?? null

  // Keep toast ref stable so the effect doesn't re-run when toast object changes
  const toastRef = useRef(toast)
  toastRef.current = toast

  useEffect(() => {
    if (!token) return

    const eventSource = new EventSource('/api/notifications/stream?token=' + encodeURIComponent(token))

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string)
        const parsed = notificationEventSchema.safeParse(data)
        if (parsed.success) {
          toastRef.current.success(parsed.data.message)
        }
      } catch {
        // ignore malformed messages
      }
    }

    return () => {
      eventSource.close()
    }
  }, [token])
}
