import { test as base, type Page } from '@playwright/test';

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

    // Wait for redirect to setup page (authenticated users with no TMs)
    await page.waitForURL('/setup');

    // Provide the authenticated page and user to the test
    await use({ page, user });
  },

  setupCompletePage: async ({ authenticatedPage }, use) => {
    const { page, user } = authenticatedPage;

    // Fill in 1RM values (in kg)
    await page.fill('input[name="bench"]', '100');
    await page.fill('input[name="squat"]', '140');
    await page.fill('input[name="ohp"]', '60');
    await page.fill('input[name="deadlift"]', '180');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard (root path)
    await page.waitForURL('/', { timeout: 10000 });

    // Provide the page with setup complete and user to the test
    await use({ page, user });
  },
});

export { expect } from '@playwright/test';
