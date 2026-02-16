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

/** Register a new user via the UI and subscribe to the default plan. */
async function registerAndSelectPlan(page: Page, user: User) {
  await page.goto('/register');
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByLabel(/display name/i).fill(user.displayName);
  await page.getByRole('button', { name: /create account/i }).click();

  await page.waitForURL('/select-plan');
  await page.getByRole('button', { name: /select plan/i }).first().click();
  await page.waitForURL(/\/setup/);
}

export const test = base.extend<{
  authenticatedPage: AuthenticatedPageFixture;
  setupCompletePage: SetupCompletePageFixture;
}>({
  authenticatedPage: async ({ page }, use) => {
    const uniqueId = crypto.randomUUID();
    const user: User = {
      email: `test-${uniqueId}@example.com`,
      password: 'ValidPassword123',
      displayName: 'Test User',
    };

    await registerAndSelectPlan(page, user);
    await use({ page, user });
  },

  setupCompletePage: async ({ authenticatedPage }, use) => {
    const { page, user } = authenticatedPage;

    await expect(page.getByRole('heading', { name: /enter your 1 rep maxes/i })).toBeVisible();
    await expect(page.locator('.form-group')).toHaveCount(4);

    await page.getByLabel(/Bench Press/i).fill('100');
    await page.getByLabel(/^Squat/i).fill('140');
    await page.getByLabel(/Overhead Press/i).fill('60');
    await page.getByLabel(/^Deadlift/i).fill('180');

    await page.getByRole('button', { name: /calculate/i }).click();
    await page.waitForURL('/');

    await use({ page, user });
  },
});

export { expect } from '@playwright/test';
