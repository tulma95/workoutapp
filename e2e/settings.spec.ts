import { test, expect } from './fixtures';
import { test as baseTest } from '@playwright/test';
import { SettingsPage } from './pages/settings.page';
import { RegisterPage } from './pages/register.page';
import { PlanSelectionPage } from './pages/plan-selection.page';
import { SetupPage } from './pages/setup.page';

test.describe('Settings Page', () => {
  test('navigate to settings -> see current user info (username, email)', async ({ setupCompletePage }) => {
    const { page, user } = setupCompletePage;
    const settings = new SettingsPage(page);

    await settings.navigate();

    await expect(page.getByRole('textbox', { name: /username/i })).toHaveValue(user.username);
    await expect(page.getByText(new RegExp(user.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeVisible();
  });

  test('logout from settings page -> redirected to login page', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const settings = new SettingsPage(page);

    await settings.navigate();
    await settings.logout();
    expect(page.url()).toContain('/login');
  });

  test('edit TM with a reason -> dialog closes without error', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const settings = new SettingsPage(page);

    await settings.navigate();
    await settings.expectLoaded();
    await settings.editTM(0, '120', 'deload reset');

    await expect(page.getByText(/error/i)).not.toBeVisible();
  });

  test('edit TM without a reason -> dialog closes (backward compatible)', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const settings = new SettingsPage(page);

    await settings.navigate();
    await settings.expectLoaded();
    await settings.editTM(0, '110');

    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});

baseTest.describe('Settings: duplicate username shows field-level error', () => {
  baseTest.setTimeout(90000);

  baseTest('saving a username already taken by another user shows inline error', async ({ browser, baseURL }) => {
    const idA = crypto.randomUUID().slice(0, 8);
    const idB = crypto.randomUUID().slice(0, 8);
    const emailA = `settings-dup-a-${idA}@example.com`;
    const emailB = `settings-dup-b-${idB}@example.com`;
    const takenUsername = `taken${idA}`;

    const ctxA = await browser.newContext({ baseURL });
    const ctxB = await browser.newContext({ baseURL });
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      // Register userA with the username we want to conflict on
      const registerA = new RegisterPage(pageA);
      await registerA.register(emailA, 'ValidPassword123', takenUsername);
      await new PlanSelectionPage(pageA).selectFirstPlan();
      const setupA = new SetupPage(pageA);
      await setupA.expectHeading();
      await setupA.fillOneRepMaxes('100', '140', '60', '180');
      await setupA.submitAndWaitForDashboard();

      // Register userB with their own unique username
      const registerB = new RegisterPage(pageB);
      await registerB.register(emailB, 'ValidPassword123', `other${idB}`);
      await new PlanSelectionPage(pageB).selectFirstPlan();
      const setupB = new SetupPage(pageB);
      await setupB.expectHeading();
      await setupB.fillOneRepMaxes('100', '140', '60', '180');
      await setupB.submitAndWaitForDashboard();

      // userB goes to settings and tries to claim userA's username
      const settingsB = new SettingsPage(pageB);
      await settingsB.navigate();
      await settingsB.expectLoaded();

      const usernameInput = pageB.getByRole('textbox', { name: /username/i });
      await usernameInput.fill(takenUsername);

      await Promise.all([
        pageB.waitForResponse(
          (r) => r.url().includes('/api/users/me') && r.request().method() === 'PATCH',
        ),
        pageB.getByRole('button', { name: /^save$/i }).click(),
      ]);

      // Field-level error should be visible near the username input
      await expect(pageB.getByRole('alert')).toContainText(/already taken/i);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
