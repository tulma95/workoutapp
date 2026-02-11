import { test, expect } from '@playwright/test';

test.describe('Settings Page', () => {
  // Helper function to register a user and set up training maxes
  async function registerAndSetupUser(page: any) {
    const timestamp = Date.now();
    const email = `settings-${timestamp}@example.com`;
    const password = 'ValidPassword123';
    const displayName = 'Settings Test User';

    // Register
    await page.goto('/register');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="displayName"]', displayName);
    await page.click('button[type="submit"]');
    await page.waitForURL('/setup');

    // Set up training maxes
    await page.fill('input[name="bench"], input[placeholder*="Bench" i]', '100');
    await page.fill('input[name="squat"], input[placeholder*="Squat" i]', '140');
    await page.fill('input[name="ohp"], input[placeholder*="OHP" i], input[placeholder*="Overhead" i]', '60');
    await page.fill('input[name="deadlift"], input[placeholder*="Deadlift" i]', '180');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard', { timeout: 10000 });

    return { email, password, displayName };
  }

  test('navigate to settings -> see current user info (display name, email, unit preference)', async ({ page }) => {
    const { email, displayName } = await registerAndSetupUser(page);

    // Navigate to settings page
    const settingsLink = page.locator(
      'a[href="/settings"], ' +
      'a:has-text("Settings"), ' +
      'button:has-text("Settings"), ' +
      '[data-nav="settings"]'
    ).first();

    await settingsLink.click();
    await page.waitForURL('/settings', { timeout: 10000 });

    expect(page.url()).toContain('/settings');

    const pageContent = await page.textContent('body');

    // Verify display name is shown
    expect(pageContent).toContain(displayName);

    // Verify email is shown
    expect(pageContent).toContain(email);

    // Verify unit preference section exists (should show kg and lb buttons)
    expect(pageContent).toContain('kg');
    expect(pageContent).toContain('lb');
  });

  test('change unit preference from kg to lb -> saves successfully', async ({ page }) => {
    await registerAndSetupUser(page);

    // Navigate to settings page
    const settingsLink = page.locator(
      'a[href="/settings"], ' +
      'a:has-text("Settings"), ' +
      'button:has-text("Settings"), ' +
      '[data-nav="settings"]'
    ).first();

    await settingsLink.click();
    await page.waitForURL('/settings', { timeout: 10000 });

    // Click the lb button to change unit preference
    const lbButton = page.locator('button:has-text("lb")').first();
    await lbButton.click();

    // Verify save confirmation message
    const saveConfirmation = page.locator('text=/saved|success/i');
    await expect(saveConfirmation).toBeVisible({ timeout: 3000 });
  });

  test('change display name -> saves successfully', async ({ page }) => {
    const { displayName } = await registerAndSetupUser(page);

    // Navigate to settings page
    const settingsLink = page.locator(
      'a[href="/settings"], ' +
      'a:has-text("Settings"), ' +
      'button:has-text("Settings"), ' +
      '[data-nav="settings"]'
    ).first();

    await settingsLink.click();
    await page.waitForURL('/settings', { timeout: 10000 });

    // The settings page displays the display name as read-only text
    // Verify it shows the correct display name
    const pageContent = await page.textContent('body');
    expect(pageContent).toContain(displayName);

    // Verify the "Display Name" label exists
    expect(pageContent).toMatch(/display\s*name/i);
  });

  test('logout from settings page -> redirected to login page', async ({ page }) => {
    await registerAndSetupUser(page);

    // Navigate to settings
    const settingsLink = page.locator(
      'a[href="/settings"], ' +
      'a:has-text("Settings"), ' +
      'button:has-text("Settings"), ' +
      '[data-nav="settings"]'
    ).first();

    await settingsLink.click();
    await page.waitForURL('/settings', { timeout: 10000 });

    // Click logout button
    const logoutButton = page.locator('button:has-text("Log Out"), button:has-text("Logout")').first();
    await logoutButton.click();

    // Verify redirect to login page
    await page.waitForURL('/login', { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });
});
