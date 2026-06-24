// App-level capture of the PWA install prompt. Chromium fires
// `beforeinstallprompt` once, early — often before any settings UI mounts — so
// we stash it in a module singleton and let components subscribe. iOS Safari
// never fires it (install is manual via Share -> Add to Home Screen).

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
const subscribers = new Set<() => void>()
const emit = () => subscribers.forEach((cb) => cb())

// Call once at app startup (main.tsx) so early events aren't missed.
export function initInstallCapture(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    emit()
  })
}

export function subscribeInstall(cb: () => void): () => void {
  subscribers.add(cb)
  return () => {
    subscribers.delete(cb)
  }
}

export function getDeferredInstall(): BeforeInstallPromptEvent | null {
  return deferred
}

export async function runInstall(): Promise<void> {
  if (!deferred) return
  await deferred.prompt()
  await deferred.userChoice
  deferred = null
  emit()
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}
