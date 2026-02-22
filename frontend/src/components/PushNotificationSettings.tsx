import { useState, useEffect, useRef } from 'react';
import { getVapidPublicKey, subscribePush, unsubscribePush } from '../api/notifications';
import styles from './PushNotificationSettings.module.css';

type PushState = 'loading' | 'unsupported' | 'denied' | 'enabled' | 'disabled';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

export function PushNotificationSettings() {
  const [pushState, setPushState] = useState<PushState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const vapidKeyRef = useRef<string | null>(null);
  const currentSubscriptionRef = useRef<PushSubscription | null>(null);

  useEffect(() => {
    if (!('PushManager' in window) || !('serviceWorker' in navigator)) {
      setPushState('unsupported');
      return;
    }

    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      setPushState('denied');
      return;
    }

    async function init() {
      try {
        const [publicKey, swReg] = await Promise.all([
          getVapidPublicKey(),
          navigator.serviceWorker.ready,
        ]);
        vapidKeyRef.current = publicKey;

        const existing = await swReg.pushManager.getSubscription();
        if (existing) {
          currentSubscriptionRef.current = existing;
          setPushState('enabled');
        } else {
          setPushState('disabled');
        }
      } catch {
        setPushState('disabled');
      }
    }

    void init();
  }, []);

  async function handleEnable() {
    if (!vapidKeyRef.current) return;
    setError(null);
    setActionLoading(true);
    try {
      const swReg = await navigator.serviceWorker.ready;
      const subscription = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKeyRef.current),
      });

      const json = subscription.toJSON();
      const p256dh = json.keys?.p256dh;
      const auth = json.keys?.auth;

      if (!p256dh || !auth) {
        throw new Error('Missing subscription keys');
      }

      await subscribePush({
        endpoint: subscription.endpoint,
        keys: { p256dh, auth },
      });

      currentSubscriptionRef.current = subscription;
      setPushState('enabled');
    } catch (err) {
      if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
        setPushState('denied');
      } else {
        setError('Failed to enable notifications. Please try again.');
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDisable() {
    setError(null);
    setActionLoading(true);
    try {
      const subscription = currentSubscriptionRef.current;
      if (subscription) {
        await unsubscribePush(subscription.endpoint);
        await subscription.unsubscribe();
        currentSubscriptionRef.current = null;
      }
      setPushState('disabled');
    } catch {
      setError('Failed to disable notifications. Please try again.');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <section className={styles.section}>
      <h3 className={styles.heading}>Push Notifications</h3>

      {pushState === 'loading' && (
        <p className={styles.statusText}>Loading...</p>
      )}

      {pushState === 'unsupported' && (
        <p className={styles.statusText}>
          Push notifications are not supported in this browser.
        </p>
      )}

      {pushState === 'denied' && (
        <p className={styles.statusText}>
          Notifications are blocked. Enable them in your browser settings to receive push notifications.
        </p>
      )}

      {pushState === 'disabled' && (
        <>
          <p className={styles.statusText}>
            Get notified when workouts are completed and achievements are unlocked.
          </p>
          <button
            className={styles.actionBtn}
            onClick={handleEnable}
            disabled={actionLoading}
          >
            {actionLoading ? 'Enabling...' : 'Enable Notifications'}
          </button>
        </>
      )}

      {pushState === 'enabled' && (
        <>
          <p className={styles.statusText}>
            Push notifications are enabled.
          </p>
          <button
            className={styles.actionBtnSecondary}
            onClick={handleDisable}
            disabled={actionLoading}
          >
            {actionLoading ? 'Disabling...' : 'Disable Notifications'}
          </button>
        </>
      )}

      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
