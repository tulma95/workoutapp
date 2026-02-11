import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('register a new user with valid credentials -> redirected to setup page', async ({ page }) => {
    const timestamp = Date.now();
    const email = `test-${timestamp}@example.com`;
    const password = 'ValidPassword123';
    const displayName = 'Test User';

    await page.goto('/register');

    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="displayName"]', displayName);
    await page.click('button[type="submit"]');

    // After successful registration, user should be redirected to setup page
    await page.waitForURL('/setup');
    expect(page.url()).toContain('/setup');
  });

  test('register with duplicate email -> shows error message', async ({ page }) => {
    const timestamp = Date.now();
    const email = `duplicate-${timestamp}@example.com`;
    const password = 'ValidPassword123';
    const displayName = 'Test User';

    // Register first time
    await page.goto('/register');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="displayName"]', displayName);
    await page.click('button[type="submit"]');
    await page.waitForURL('/setup');

    // Logout
    await page.goto('/login');

    // Try to register again with same email
    await page.goto('/register');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="displayName"]', displayName);
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
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="displayName"]', displayName);
    await page.click('button[type="submit"]');
    await page.waitForURL('/setup');

    // Logout by going to login page (simpler than clicking logout)
    await page.goto('/login');

    // Login with valid credentials
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
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
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="displayName"]', displayName);
    await page.click('button[type="submit"]');
    await page.waitForURL('/setup');

    // Go to login
    await page.goto('/login');

    // Try to login with wrong password
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'WrongPassword456');
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

    // Register and login
    await page.goto('/register');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="displayName"]', displayName);
    await page.click('button[type="submit"]');
    await page.waitForURL('/setup');

    // Find and click logout button
    const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout"), button:has-text("Log out"), a:has-text("Log out")');
    await logoutButton.click();

    // Should redirect to login page
    await page.waitForURL('/login');
    expect(page.url()).toContain('/login');
  });
});
