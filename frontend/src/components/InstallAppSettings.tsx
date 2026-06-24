import { useSyncExternalStore } from 'react'
import {
  subscribeInstall,
  getDeferredInstall,
  runInstall,
  isStandalone,
  isIos,
} from '../utils/installPrompt'
import styles from '../styles/InstallAppSettings.module.css'

// "Install app" affordance, shown in Settings so it's discoverable without an
// intrusive overlay. Chromium gets a one-tap Install button (driven by the
// captured beforeinstallprompt); iOS Safari gets manual instructions.
export function InstallAppSettings() {
  const deferred = useSyncExternalStore(subscribeInstall, getDeferredInstall)

  // Already installed/running standalone — nothing to offer.
  if (isStandalone()) return null

  if (deferred) {
    return (
      <section className={styles.card}>
        <h3 className={styles.label}>Install app</h3>
        <p className={styles.text}>
          Install SetForge for offline workouts and a full-screen, app-like experience.
        </p>
        <button className={styles.button} onClick={() => void runInstall()}>
          Install
        </button>
      </section>
    )
  }

  if (isIos()) {
    return (
      <section className={styles.card}>
        <h3 className={styles.label}>Install app</h3>
        <p className={styles.text}>
          To install: tap the Share button, then “Add to Home Screen”.
        </p>
      </section>
    )
  }

  return null
}
