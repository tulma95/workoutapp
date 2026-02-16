import { test, expect, type Page } from '@playwright/test';

async function registerUser(page: Page, email: string, password: string, displayName: string) {
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByLabel(/display name/i).fill(displayName);
  await page.getByRole('button', { name: /create account/i }).click();
}

async function selectPlanAfterRegistration(page: Page) {
  await page.waitForURL('/select-plan');
  await page.getByRole('button', { name: /select plan/i }).first().click();
  await page.waitForURL(/\/setup/);
  await expect(page.getByRole('heading', { name: /enter your 1 rep maxes/i })).toBeVisible();
  await expect(page.locator('.form-group')).toHaveCount(4);
}

async function logoutViaSettings(page: Page) {
  await page.getByRole('link', { name: /settings/i }).click();
  await page.waitForURL('/settings');
  await page.getByRole('button', { name: /log out/i }).click();
  await page.waitForURL('/login');
  await expect(page.getByRole('heading', { name: /log in/i })).toBeVisible();
}

test.describe('Authentication', () => {
  test('register a new user with valid credentials -> redirected to setup page', async ({ page }) => {
    const email = `test-${Date.now()}@example.com`;

    await registerUser(page, email, 'ValidPassword123', 'Test User');
    await selectPlanAfterRegistration(page);
    expect(page.url()).toContain('/setup');
  });

  test('register with duplicate email -> shows error message', async ({ page }) => {
    const email = `duplicate-${Date.now()}@example.com`;

    await registerUser(page, email, 'ValidPassword123', 'Test User');
    await selectPlanAfterRegistration(page);
    await logoutViaSettings(page);

    // Try to register again with same email
    await registerUser(page, email, 'ValidPassword123', 'Test User');

    const errorMessage = page.locator('.error, [role="alert"], .alert-error');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText(/email.*already.*exist/i);
  });

  test('login with valid credentials -> redirected to dashboard or setup', async ({ page }) => {
    const email = `login-${Date.now()}@example.com`;

    await registerUser(page, email, 'ValidPassword123', 'Login Test User');
    await selectPlanAfterRegistration(page);
    await logoutViaSettings(page);

    // Login
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill('ValidPassword123');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL(/\/setup/);
    expect(page.url()).toContain('/setup');
  });

  test('login with wrong password -> shows error message', async ({ page }) => {
    const email = `wrongpass-${Date.now()}@example.com`;

    await registerUser(page, email, 'ValidPassword123', 'Wrong Pass User');
    await selectPlanAfterRegistration(page);
    await logoutViaSettings(page);

    // Try to login with wrong password
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill('WrongPassword456');
    await page.getByRole('button', { name: /log in/i }).click();

    const errorMessage = page.locator('.error, [role="alert"], .alert-error');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText(/invalid.*credentials|password|incorrect/i);
  });

  test('logout -> redirected to login page', async ({ page }) => {
    const email = `logout-${Date.now()}@example.com`;

    await registerUser(page, email, 'ValidPassword123', 'Logout Test User');
    await selectPlanAfterRegistration(page);

    // Setup TMs
    await page.getByLabel(/Bench Press/i).fill('100');
    await page.getByLabel(/^Squat/i).fill('140');
    await page.getByLabel(/Overhead Press/i).fill('60');
    await page.getByLabel(/^Deadlift/i).fill('180');
    await page.getByRole('button', { name: /calculate/i }).click();
    await page.waitForURL('/');

    // Logout via settings
    await page.getByRole('link', { name: /settings/i }).click();
    await page.waitForURL('/settings');

    const logoutButton = page.getByRole('button', { name: /log out/i });
    await expect(logoutButton).toBeVisible();
    await logoutButton.click();

    await page.waitForURL('/login');
    expect(page.url()).toContain('/login');
  });
});
