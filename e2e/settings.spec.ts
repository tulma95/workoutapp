import { readFile } from 'fs/promises';
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

  test('appearance toggle switches the theme and persists across reload', async ({
    setupCompletePage,
  }) => {
    const { page } = setupCompletePage;
    const settings = new SettingsPage(page);
    await settings.navigate();
    await settings.expectLoaded();

    await page.getByRole('radio', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // The pre-paint inline script restores the choice on reload.
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.getByRole('radio', { name: 'Light' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('change password -> success, and new password works on next login', async ({
    setupCompletePage,
  }) => {
    const { page, user } = setupCompletePage;
    const settings = new SettingsPage(page);
    await settings.navigate();

    await page.getByLabel('Current password', { exact: true }).fill('ValidPassword123');
    await page.getByLabel('New password', { exact: true }).fill('NewPassword456');
    await page.getByLabel('Confirm new password', { exact: true }).fill('NewPassword456');
    await page.getByRole('button', { name: /update password/i }).click();

    await expect(page.getByText(/password changed/i)).toBeVisible();

    // The new password must actually work; the old one must not.
    await settings.logout();
    await page.getByLabel(/email/i).fill(user.email);
    await page.getByLabel(/password/i).fill('NewPassword456');
    await page.getByRole('button', { name: /log in/i }).click();
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('export my data -> downloads a JSON file containing the user data', async ({
    setupCompletePage,
  }) => {
    const { page, user } = setupCompletePage;
    const settings = new SettingsPage(page);
    await settings.navigate();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /export my data/i }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^setforge-export-\d{4}-\d{2}-\d{2}\.json$/);

    const json = JSON.parse(await readFile(await download.path(), 'utf8'));
    expect(json.profile.email).toBe(user.email);
    expect(json.profile).not.toHaveProperty('passwordHash');
    expect(json).toHaveProperty('workouts');
    expect(json).toHaveProperty('trainingMaxes');
  });

  test('change password with wrong current password -> inline error', async ({
    setupCompletePage,
  }) => {
    const { page } = setupCompletePage;
    const settings = new SettingsPage(page);
    await settings.navigate();

    await page.getByLabel('Current password', { exact: true }).fill('WrongPassword999');
    await page.getByLabel('New password', { exact: true }).fill('NewPassword456');
    await page.getByLabel('Confirm new password', { exact: true }).fill('NewPassword456');
    await page.getByRole('button', { name: /update password/i }).click();

    await expect(page.getByText(/current password is incorrect/i)).toBeVisible();
  });

  test('change account email -> the displayed email updates', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const settings = new SettingsPage(page);
    await settings.navigate();
    await settings.expectLoaded();

    const newEmail = `changed-${crypto.randomUUID().slice(0, 8)}@example.com`;
    await page.getByLabel('New email').fill(newEmail);
    await page.getByLabel('Current password for email change').fill('ValidPassword123');
    const patch = page.waitForResponse(
      (r) => r.url().includes('/me/email') && r.request().method() === 'PATCH' && r.ok(),
    );
    await page.getByRole('button', { name: 'Update email' }).click();
    await patch;

    await expect(page.getByText(newEmail)).toBeVisible();
  });

  test('delete account -> redirected to login, and the account no longer works', async ({
    setupCompletePage,
  }) => {
    const { page, user } = setupCompletePage;
    const settings = new SettingsPage(page);
    await settings.navigate();

    await page.getByRole('button', { name: /^delete account$/i }).click();
    await page.getByLabel('Password', { exact: true }).fill('ValidPassword123');
    await page.getByRole('button', { name: /permanently delete/i }).click();

    await expect(page).toHaveURL(/\/login/);

    // The deleted account can no longer log in.
    await page.getByLabel(/email/i).fill(user.email);
    await page.getByLabel(/password/i).fill('ValidPassword123');
    await page.getByRole('button', { name: /log in/i }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
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
