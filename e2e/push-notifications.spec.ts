import { test, expect, type Page } from '@playwright/test';
import { RegisterPage } from './pages/register.page';
import { PlanSelectionPage } from './pages/plan-selection.page';
import { SetupPage } from './pages/setup.page';
import { SettingsPage } from './pages/settings.page';

/**
 * Injects a mock PushManager + serviceWorker so push subscription flows work in
 * Playwright WebKit (which may not expose real PushManager / Web Push APIs).
 *
 * The mock:
 * - makes `'PushManager' in window` return true
 * - replaces navigator.serviceWorker.ready with a mock registration
 * - getSubscription() → null initially
 * - subscribe()        → returns a fake PushSubscription with valid-looking keys
 * - subscription.unsubscribe() → clears currentSubscription, returns true
 */
const PUSH_API_MOCK = `
  let currentSubscription = null;
  const MOCK_ENDPOINT = 'https://push-mock.example.com/test-' + Math.random().toString(36).slice(2);

  function createMockSub(endpoint) {
    return {
      endpoint,
      toJSON() {
        return {
          endpoint: this.endpoint,
          keys: {
            p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtZ5MuHUYHHRbZlKLHH_LyMXmCpfpHMDDpxm_HsNvLNzA3hmNyY5b7wABC',
            auth: 'tBHItJI5svbpez7K',
          },
        };
      },
      unsubscribe() {
        currentSubscription = null;
        return Promise.resolve(true);
      },
    };
  }

  const mockPushManager = {
    getSubscription: () => Promise.resolve(currentSubscription),
    subscribe: (_opts) => {
      currentSubscription = createMockSub(MOCK_ENDPOINT);
      return Promise.resolve(currentSubscription);
    },
  };

  const mockRegistration = { pushManager: mockPushManager };

  // Ensure PushManager is in window so the unsupported check passes
  if (!('PushManager' in window)) {
    window.PushManager = function PushManager() {};
  }

  // Override navigator.serviceWorker so ready resolves with mock registration
  Object.defineProperty(navigator, 'serviceWorker', {
    get() {
      return {
        ready: Promise.resolve(mockRegistration),
        register: () => Promise.resolve(mockRegistration),
        addEventListener: () => {},
      };
    },
    configurable: true,
  });
`;

/**
 * Minimal mock that adds PushManager to window (so unsupported check passes)
 * but sets Notification.permission to 'denied' — exercises the "blocked" path.
 */
const DENIED_PERMISSION_MOCK = `
  if (!('PushManager' in window)) {
    window.PushManager = function PushManager() {};
  }
  if (!('serviceWorker' in navigator)) {
    Object.defineProperty(navigator, 'serviceWorker', {
      get() { return { ready: new Promise(() => {}) }; },
      configurable: true,
    });
  }
  if (typeof Notification !== 'undefined') {
    Object.defineProperty(Notification, 'permission', {
      get() { return 'denied'; },
      configurable: true,
    });
  } else {
    window.Notification = { permission: 'denied' };
  }
`;

async function registerAndSetup(page: Page) {
  const uuid = crypto.randomUUID();
  const email = `push-${uuid}@example.com`;
  const username = `push${uuid.replace(/-/g, '').slice(0, 16)}`;
  const password = 'ValidPassword123';

  const register = new RegisterPage(page);
  const planSelection = new PlanSelectionPage(page);
  const setup = new SetupPage(page);

  await register.register(email, password, username);
  await planSelection.selectFirstPlan();
  await setup.expectHeading();
  await setup.fillOneRepMaxes('100', '140', '60', '180');
  await setup.submitAndWaitForDashboard();
}

test.describe('Push Notification Settings', () => {
  test('shows Push Notifications section with Enable button when permissions are granted', async ({
    page,
  }) => {
    await page.context().grantPermissions(['notifications']);
    await page.addInitScript(PUSH_API_MOCK);

    await registerAndSetup(page);

    const settings = new SettingsPage(page);
    await settings.navigate();

    await expect(page.getByRole('heading', { name: /push notifications/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /enable notifications/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /disable notifications/i })).not.toBeVisible();
  });

  test('clicking Enable calls subscribe endpoint and button changes to Disable', async ({
    page,
  }) => {
    await page.context().grantPermissions(['notifications']);
    await page.addInitScript(PUSH_API_MOCK);

    await registerAndSetup(page);

    const settings = new SettingsPage(page);
    await settings.navigate();

    await expect(page.getByRole('button', { name: /enable notifications/i })).toBeVisible();

    const [subscribeResponse] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/api/notifications/subscribe') && r.request().method() === 'POST',
      ),
      page.getByRole('button', { name: /enable notifications/i }).click(),
    ]);

    expect(subscribeResponse.status()).toBe(201);
    await expect(page.getByRole('button', { name: /disable notifications/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /enable notifications/i })).not.toBeVisible();
  });

  test('clicking Disable calls unsubscribe endpoint and button returns to Enable', async ({
    page,
  }) => {
    await page.context().grantPermissions(['notifications']);
    await page.addInitScript(PUSH_API_MOCK);

    await registerAndSetup(page);

    const settings = new SettingsPage(page);
    await settings.navigate();

    // First enable push notifications
    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/api/notifications/subscribe') && r.request().method() === 'POST',
      ),
      page.getByRole('button', { name: /enable notifications/i }).click(),
    ]);
    await expect(page.getByRole('button', { name: /disable notifications/i })).toBeVisible();

    // Now disable push notifications
    const [unsubscribeResponse] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/api/notifications/subscribe') && r.request().method() === 'DELETE',
      ),
      page.getByRole('button', { name: /disable notifications/i }).click(),
    ]);

    expect(unsubscribeResponse.status()).toBe(200);
    await expect(page.getByRole('button', { name: /enable notifications/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /disable notifications/i })).not.toBeVisible();
  });

  test('shows blocked message when notification permissions are denied', async ({ page }) => {
    await page.addInitScript(DENIED_PERMISSION_MOCK);

    await registerAndSetup(page);

    const settings = new SettingsPage(page);
    await settings.navigate();

    await expect(page.getByRole('heading', { name: /push notifications/i })).toBeVisible();
    await expect(
      page.getByText(/notifications are blocked|enable them in your browser/i),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /enable notifications/i })).not.toBeVisible();
  });
});
