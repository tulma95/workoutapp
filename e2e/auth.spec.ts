import { test, expect, type Page } from '@playwright/test';
import { RegisterPage } from './pages/register.page';
import { LoginPage } from './pages/login.page';
import { PlanSelectionPage } from './pages/plan-selection.page';
import { SetupPage } from './pages/setup.page';
import { SettingsPage } from './pages/settings.page';

async function registerAndSetupToLogin(page: Page, email: string) {
  const register = new RegisterPage(page);
  const planSelection = new PlanSelectionPage(page);
  const setup = new SetupPage(page);
  const settings = new SettingsPage(page);

  const username = `u${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  await register.register(email, 'ValidPassword123', username);
  await planSelection.selectFirstPlan();
  await setup.expectHeading();

  return { register, planSelection, setup, settings };
}

test.describe('Authentication', () => {
  test('register a new user with valid credentials -> redirected to setup page', async ({ page }) => {
    const email = `test-${Date.now()}@example.com`;
    const username = `u${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

    const register = new RegisterPage(page);
    const planSelection = new PlanSelectionPage(page);
    const setup = new SetupPage(page);

    await register.register(email, 'ValidPassword123', username);
    await planSelection.selectFirstPlan();
    await setup.expectHeading();
    expect(page.url()).toContain('/setup');
  });

  test('register with duplicate email -> shows error message', async ({ page }) => {
    const email = `duplicate-${Date.now()}@example.com`;
    const register = new RegisterPage(page);
    const planSelection = new PlanSelectionPage(page);
    const setup = new SetupPage(page);
    const settings = new SettingsPage(page);

    const username1 = `u${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    await register.register(email, 'ValidPassword123', username1);
    await planSelection.selectFirstPlan();
    await setup.expectHeading();

    await settings.navigate();
    await settings.logout();

    // Try to register again with same email
    const username2 = `u${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    await register.register(email, 'ValidPassword123', username2);

    await expect(register.errorMessage).toBeVisible();
    await expect(register.errorMessage).toContainText(/email.*already.*exist/i);
  });

  test('login with valid credentials -> redirected to dashboard or setup', async ({ page }) => {
    const email = `login-${Date.now()}@example.com`;
    const { settings } = await registerAndSetupToLogin(page, email);

    await settings.navigate();
    await settings.logout();

    const login = new LoginPage(page);
    await login.login(email, 'ValidPassword123');

    await expect(page).toHaveURL(/\/setup/);
  });

  test('login with wrong password -> shows error message', async ({ page }) => {
    const email = `wrongpass-${Date.now()}@example.com`;
    const { settings } = await registerAndSetupToLogin(page, email);

    await settings.navigate();
    await settings.logout();

    const login = new LoginPage(page);
    await login.login(email, 'WrongPassword456');

    await expect(login.errorMessage).toBeVisible();
    await expect(login.errorMessage).toContainText(/invalid.*credentials|password|incorrect/i);
  });

  test('logout -> redirected to login page', async ({ page }) => {
    const email = `logout-${Date.now()}@example.com`;
    const { setup, settings } = await registerAndSetupToLogin(page, email);

    await setup.fillOneRepMaxes('100', '140', '60', '180');
    await setup.submitAndWaitForDashboard();

    await settings.navigate();

    const logoutButton = settings.logoutButton;
    await expect(logoutButton).toBeVisible();
    await logoutButton.click();

    await expect(page).toHaveURL(/\/login/);
  });
});
