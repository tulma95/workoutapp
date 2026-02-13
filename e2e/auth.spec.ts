import { test, expect, Page } from '@playwright/test';

/** After registration, user lands on /select-plan. Select the first plan to proceed to /setup. */
async function selectPlanAfterRegistration(page: Page) {
  await page.waitForURL('/select-plan');
  await page.click('button:has-text("Select Plan")');
  await page.waitForURL('/setup');
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

    // Logout
    await page.goto('/login');

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

    // Logout by going to login page
    await page.goto('/login');

    // Login with valid credentials
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('button[type="submit"]');

    // Should redirect to setup (user has no TMs yet)
    await page.waitForURL('/setup');
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

    // Go to login
    await page.goto('/login');

    // Try to login with wrong password
    await page.fill('#email', email);
    await page.fill('#password', 'WrongPassword456');
    await page.click('button[type="submit"]');

    // Should show error message
    const errorMessage = page.locator('.error, [role="alert"], .alert-error');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText(/invalid.*credentials|password|incorrect/i);
  });

  test.skip('logout -> redirected to login page', async ({ page }) => {
    const timestamp = Date.now();
    const email = `logout-${timestamp}@example.com`;
    const password = 'ValidPassword123';
    const displayName = 'Logout Test User';

    // Register and login
    await page.goto('/register');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.fill('#displayName', displayName);
    await page.click('button[type="submit"]');
    await selectPlanAfterRegistration(page);

    // Find and click logout button
    const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout"), button:has-text("Log out"), a:has-text("Log out")');
    await logoutButton.click();

    // Should redirect to login page
    await page.waitForURL('/login');
    expect(page.url()).toContain('/login');
  });
});
