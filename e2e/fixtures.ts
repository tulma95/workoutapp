import { test as base, expect, type Page } from '@playwright/test';

interface User {
  email: string;
  password: string;
  displayName: string;
}

interface AuthenticatedPageFixture {
  page: Page;
  user: User;
}

interface SetupCompletePageFixture extends AuthenticatedPageFixture {}

export const test = base.extend<{
  authenticatedPage: AuthenticatedPageFixture;
  setupCompletePage: SetupCompletePageFixture;
}>({
  authenticatedPage: async ({ page }, use) => {
    // Generate unique user (use crypto.randomUUID to avoid collisions in parallel tests)
    const uniqueId = crypto.randomUUID();
    const user: User = {
      email: `test-${uniqueId}@example.com`,
      password: 'ValidPassword123',
      displayName: 'Test User',
    };

    // Register user
    await page.goto('/register');
    await page.fill('#email', user.email);
    await page.fill('#password', user.password);
    await page.fill('#displayName', user.displayName);
    await page.click('button[type="submit"]');

    // After registration, user must select a plan first
    await page.waitForURL('/select-plan');
    await page.click('button:has-text("Select Plan")');
    await page.waitForURL(/\/setup/);

    // Provide the authenticated page and user to the test
    await use({ page, user });
  },

  setupCompletePage: async ({ authenticatedPage }, use) => {
    const { page, user } = authenticatedPage;

    // Wait for setup form to be fully loaded with all exercise fields
    await page.getByRole('heading', { name: /enter your 1 rep maxes/i }).waitFor();
    await expect(page.locator('.form-group')).toHaveCount(4);

    // Fill in 1RM values (in kg) using label selectors (input names are numeric IDs)
    await page.getByLabel(/Bench Press/i).fill('100');
    await page.getByLabel(/^Squat/i).fill('140');
    await page.getByLabel(/Overhead Press/i).fill('60');
    await page.getByLabel(/^Deadlift/i).fill('180');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard (root path)
    await page.waitForURL('/', { timeout: 10000 });

    // Provide the page with setup complete and user to the test
    await use({ page, user });
  },
});

export { expect } from '@playwright/test';
