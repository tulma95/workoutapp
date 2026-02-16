import { test, expect, Page } from '@playwright/test';

/** After registration, user lands on /select-plan. Select the first plan to proceed to /setup. */
async function selectPlanAfterRegistration(page: Page) {
  await page.waitForURL('/select-plan');
  await page.click('button:has-text("Select Plan")');
  await page.waitForURL(/\/setup/);
  // Wait for setup form to be fully loaded with all exercise fields
  await expect(page.getByRole('heading', { name: /enter your 1 rep maxes/i })).toBeVisible();
  await expect(page.locator('.form-group')).toHaveCount(4);
}

test.describe('Authentication', () => {
  test('register a new user with valid credentials -> redirected to setup page', async ({ page }) => {
    const timestamp = Date.now();
    const email = `test-${timestamp}@example.com`;
    const password = 'ValidPassword123';
    const displayName = 'Test User';

    await page.goto('/register');

    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.fill('#displayName', displayName);
    await page.click('button[type="submit"]');

    // After registration, user must select a plan before reaching setup
    await selectPlanAfterRegistration(page);
    expect(page.url()).toContain('/setup');
  });

  test('register with duplicate email -> shows error message', async ({ page }) => {
    const timestamp = Date.now();
    const email = `duplicate-${timestamp}@example.com`;
    const password = 'ValidPassword123';
    const displayName = 'Test User';

    // Register first time
    await page.goto('/register');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.fill('#displayName', displayName);
    await page.click('button[type="submit"]');
    await selectPlanAfterRegistration(page);

    // Logout via settings page
    await page.getByRole('link', { name: /settings/i }).click();
    await page.waitForURL('/settings');
    await page.getByRole('button', { name: /log out/i }).click();
    await page.waitForURL('/login');

    // Try to register again with same email
    await page.goto('/register');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.fill('#displayName', displayName);
    await page.click('button[type="submit"]');

    // Should show error message
    const errorMessage = page.locator('.error, [role="alert"], .alert-error');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText(/email.*already.*exist/i);
  });

  test('login with valid credentials -> redirected to dashboard or setup', async ({ page }) => {
    const timestamp = Date.now();
    const email = `login-${timestamp}@example.com`;
    const password = 'ValidPassword123';
    const displayName = 'Login Test User';

    // Register first
    await page.goto('/register');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.fill('#displayName', displayName);
    await page.click('button[type="submit"]');
    await selectPlanAfterRegistration(page);

    // Logout via settings page
    await page.getByRole('link', { name: /settings/i }).click();
    await page.waitForURL('/settings');
    await page.getByRole('button', { name: /log out/i }).click();
    await page.waitForURL('/login');

    // Login with valid credentials
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('button[type="submit"]');

    // Should redirect to setup (user has no TMs yet)
    await page.waitForURL(/\/setup/);
    expect(page.url()).toContain('/setup');
  });

  test('login with wrong password -> shows error message', async ({ page }) => {
    const timestamp = Date.now();
    const email = `wrongpass-${timestamp}@example.com`;
    const password = 'ValidPassword123';
    const displayName = 'Wrong Pass User';

    // Register first
    await page.goto('/register');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.fill('#displayName', displayName);
    await page.click('button[type="submit"]');
    await selectPlanAfterRegistration(page);

    // Logout via settings page
    await page.getByRole('link', { name: /settings/i }).click();
    await page.waitForURL('/settings');
    await page.getByRole('button', { name: /log out/i }).click();
    await page.waitForURL('/login');

    // Try to login with wrong password
    await page.fill('#email', email);
    await page.fill('#password', 'WrongPassword456');
    await page.click('button[type="submit"]');

    // Should show error message
    const errorMessage = page.locator('.error, [role="alert"], .alert-error');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText(/invalid.*credentials|password|incorrect/i);
  });

  test('logout -> redirected to login page', async ({ page }) => {
    const timestamp = Date.now();
    const email = `logout-${timestamp}@example.com`;
    const password = 'ValidPassword123';
    const displayName = 'Logout Test User';

    // Register
    await page.goto('/register');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.fill('#displayName', displayName);
    await page.click('button[type="submit"]');

    // Select plan
    await selectPlanAfterRegistration(page);

    // Setup TMs (fill in 1RM values)
    await page.getByLabel(/Bench Press/i).fill('100');
    await page.getByLabel(/^Squat/i).fill('140');
    await page.getByLabel(/Overhead Press/i).fill('60');
    await page.getByLabel(/^Deadlift/i).fill('180');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('/', { timeout: 10000 });

    // Navigate to settings via bottom nav
    await page.getByRole('link', { name: /settings/i }).click();
    await page.waitForURL('/settings');

    // Find and click logout button on settings page
    const logoutButton = page.getByRole('button', { name: /log out/i });
    await expect(logoutButton).toBeVisible();
    await logoutButton.click();

    // Should redirect to login page
    await page.waitForURL('/login');
    expect(page.url()).toContain('/login');
  });
});
