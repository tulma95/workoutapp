import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { router, queryClient } from './router'
import { initInstallCapture } from './utils/installPrompt'
import { applyTheme, getThemePreference, watchSystemTheme } from './utils/theme'
import './styles/global.css'

initInstallCapture()
// The inline script in index.html sets the initial theme pre-paint; re-assert it
// and keep it in sync with the OS while the preference is "system".
applyTheme(getThemePreference())
watchSystemTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
