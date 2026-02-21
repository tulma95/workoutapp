import { test, expect, type Page } from '@playwright/test';
import { PlanSelectionPage } from './pages/plan-selection.page';
import { SetupPage } from './pages/setup.page';

function uniqueUsername() {
  return `u${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

async function registerWithOptionalUsername(
  page: Page,
  email: string,
  displayName: string,
  username?: string,
) {
  await page.goto('/register');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill('ValidPassword123');
  await page.getByLabel(/display name/i).fill(displayName);
  if (username) {
    await page.getByLabel(/username \(optional\)/i).fill(username);
  }
  await page.getByRole('button', { name: /create account/i }).click();
}

async function registerAndSetup(
  page: Page,
  email: string,
  displayName: string,
  username?: string,
) {
  await registerWithOptionalUsername(page, email, displayName, username);

  const planSelection = new PlanSelectionPage(page);
  await planSelection.selectFirstPlan();

  const setup = new SetupPage(page);
  await setup.expectHeading();
  await setup.fillOneRepMaxes('100', '140', '60', '180');
  await setup.submitAndWaitForDashboard();
}

async function navigateToFriendsTab(page: Page) {
  await page.getByRole('link', { name: /social/i }).click();
  await page.getByRole('tab', { name: /friends/i }).click();
}

async function typeInSearchAndWaitForResults(page: Page, query: string) {
  const searchInput = page.getByLabel('Search by username');
  await searchInput.fill(query);
  // Wait for dropdown to appear (debounce 300ms + network)
  await expect(
    page.getByRole('listbox', { name: /search results/i }),
  ).toBeVisible({ timeout: 5000 });
}

test.describe('Username: full friend request flow via autocomplete', () => {
  test.setTimeout(90000);

  test('userA registers with username, userB searches and finds them, sends request, userA accepts — both are friends', async ({
    browser,
    baseURL,
  }) => {
    const idA = crypto.randomUUID().slice(0, 8);
    const idB = crypto.randomUUID().slice(0, 8);
    const emailA = `un-a-${idA}@example.com`;
    const emailB = `un-b-${idB}@example.com`;
    const displayNameA = `AlphaUser ${idA}`;
    const displayNameB = `BetaUser ${idB}`;
    const usernameA = uniqueUsername();

    const ctxA = await browser.newContext({ baseURL });
    const ctxB = await browser.newContext({ baseURL });
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      await registerAndSetup(pageA, emailA, displayNameA, usernameA);
      await registerAndSetup(pageB, emailB, displayNameB);

      // userB navigates to Friends tab (default search mode)
      await navigateToFriendsTab(pageB);
      await expect(pageB.getByLabel('Search by username')).toBeVisible();

      // userB types part of userA's username in the search
      const partial = usernameA.slice(0, 6);
      await typeInSearchAndWaitForResults(pageB, partial);

      // userA's display name should appear in the dropdown
      const resultButton = pageB.getByRole('button', {
        name: new RegExp(displayNameA),
      });
      await expect(resultButton).toBeVisible();

      // userB clicks the result to send friend request
      await resultButton.click();

      // Success message
      await expect(pageB.getByRole('status')).toContainText(/friend request sent/i);

      // userA navigates to Friends tab and accepts
      await navigateToFriendsTab(pageA);
      const acceptButton = pageA.getByRole('button', {
        name: `Accept friend request from ${displayNameB}`,
      });
      await expect(acceptButton).toBeVisible();
      await acceptButton.click();

      // userA now sees userB in friends list
      await expect(pageA.getByText(new RegExp(displayNameB))).toBeVisible();

      // userB now sees userA in friends list (navigate to refresh)
      await navigateToFriendsTab(pageB);
      await expect(pageB.getByText(new RegExp(displayNameA))).toBeVisible();
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});

test.describe('Username: set username in settings after registration', () => {
  test.setTimeout(90000);

  test('user sets username in settings, second user searches and finds them', async ({
    browser,
    baseURL,
  }) => {
    const idA = crypto.randomUUID().slice(0, 8);
    const idB = crypto.randomUUID().slice(0, 8);
    const emailA = `un-settings-a-${idA}@example.com`;
    const emailB = `un-settings-b-${idB}@example.com`;
    const displayNameA = `SettingsAlpha ${idA}`;
    const displayNameB = `SettingsBeta ${idB}`;
    const usernameA = uniqueUsername();

    const ctxA = await browser.newContext({ baseURL });
    const ctxB = await browser.newContext({ baseURL });
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      // userA registers WITHOUT username
      await registerAndSetup(pageA, emailA, displayNameA);

      // userB registers (for the search)
      await registerAndSetup(pageB, emailB, displayNameB);

      // userA goes to Settings and sets their username
      await pageA.getByRole('link', { name: /settings/i }).click();
      const usernameInput = pageA.getByLabel('Username');
      await expect(usernameInput).toBeVisible();
      await usernameInput.fill(usernameA);

      // Wait for the PATCH to confirm the username was saved
      const [saveResponse] = await Promise.all([
        pageA.waitForResponse(
          (r) => r.url().includes('/api/users/me') && r.request().method() === 'PATCH',
        ),
        pageA.getByRole('button', { name: /^save$/i }).click(),
      ]);
      expect(saveResponse.status()).toBe(200);

      // userB searches for userA's username
      await navigateToFriendsTab(pageB);
      const partial = usernameA.slice(0, 6);
      await typeInSearchAndWaitForResults(pageB, partial);

      // userA appears in results
      const resultButton = pageB.getByRole('button', {
        name: new RegExp(displayNameA),
      });
      await expect(resultButton).toBeVisible();
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});

test.describe('Username: search excludes self', () => {
  test.setTimeout(60000);

  test('user does not see themselves in search results', async ({ page }) => {
    const id = crypto.randomUUID().slice(0, 8);
    const email = `un-self-${id}@example.com`;
    const displayName = `SelfSearch ${id}`;
    const username = uniqueUsername();

    await registerAndSetup(page, email, displayName, username);

    await navigateToFriendsTab(page);

    // Search for own username
    const searchInput = page.getByLabel('Search by username');
    await searchInput.fill(username);

    // Wait for debounce + request
    const dropdown = page.getByRole('listbox', { name: /search results/i });
    await expect(dropdown).toBeVisible({ timeout: 5000 });

    // Should show "No users found" (self excluded)
    await expect(dropdown).toContainText(/no users found/i);
  });
});

test.describe('Username: search excludes accepted friends', () => {
  test.setTimeout(90000);

  test('already-accepted friends do not appear in search results', async ({
    browser,
    baseURL,
  }) => {
    const idA = crypto.randomUUID().slice(0, 8);
    const idB = crypto.randomUUID().slice(0, 8);
    const emailA = `un-excl-a-${idA}@example.com`;
    const emailB = `un-excl-b-${idB}@example.com`;
    const displayNameA = `ExclAlpha ${idA}`;
    const displayNameB = `ExclBeta ${idB}`;
    const usernameA = uniqueUsername();
    const usernameB = uniqueUsername();

    const ctxA = await browser.newContext({ baseURL });
    const ctxB = await browser.newContext({ baseURL });
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      await registerAndSetup(pageA, emailA, displayNameA, usernameA);
      await registerAndSetup(pageB, emailB, displayNameB, usernameB);

      // userA sends friend request to userB via email (simpler for setup)
      await navigateToFriendsTab(pageA);
      // Switch to email mode
      await pageA.getByRole('button', { name: /send by email/i }).click();
      await pageA.getByLabel(/friend's email address/i).fill(emailB);
      await pageA.getByRole('button', { name: /^send$/i }).click();
      await expect(pageA.getByRole('status')).toContainText(/friend request sent/i);

      // userB accepts
      await navigateToFriendsTab(pageB);
      const acceptButton = pageB.getByRole('button', {
        name: `Accept friend request from ${displayNameA}`,
      });
      await expect(acceptButton).toBeVisible();
      await acceptButton.click();
      await expect(pageB.getByText(new RegExp(displayNameA))).toBeVisible();

      // Now userB searches for userA — should NOT appear (they're friends)
      const searchInput = pageB.getByLabel('Search by username');
      // Make sure we're in search mode
      await pageB.getByRole('button', { name: /search by username/i }).click();
      await searchInput.fill(usernameA.slice(0, 6));

      const dropdown = pageB.getByRole('listbox', { name: /search results/i });
      await expect(dropdown).toBeVisible({ timeout: 5000 });
      await expect(dropdown).toContainText(/no users found/i);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});

test.describe('Username: search excludes pending requests', () => {
  test.setTimeout(90000);

  test('pending request recipient does not appear in sender search', async ({
    browser,
    baseURL,
  }) => {
    const idA = crypto.randomUUID().slice(0, 8);
    const idB = crypto.randomUUID().slice(0, 8);
    const emailA = `un-pend-a-${idA}@example.com`;
    const emailB = `un-pend-b-${idB}@example.com`;
    const displayNameA = `PendAlpha ${idA}`;
    const displayNameB = `PendBeta ${idB}`;
    const usernameA = uniqueUsername();
    const usernameB = uniqueUsername();

    const ctxA = await browser.newContext({ baseURL });
    const ctxB = await browser.newContext({ baseURL });
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      await registerAndSetup(pageA, emailA, displayNameA, usernameA);
      await registerAndSetup(pageB, emailB, displayNameB, usernameB);

      // userA sends friend request to userB (request is now pending)
      await navigateToFriendsTab(pageA);
      await typeInSearchAndWaitForResults(pageA, usernameB.slice(0, 6));
      const resultButton = pageA.getByRole('button', {
        name: new RegExp(displayNameB),
      });
      await expect(resultButton).toBeVisible();
      await resultButton.click();
      await expect(pageA.getByRole('status')).toContainText(/friend request sent/i);

      // Now userA searches for userB again — should NOT appear (pending sent)
      const searchInput = pageA.getByLabel('Search by username');
      await searchInput.fill('');
      await searchInput.fill(usernameB.slice(0, 6));

      const dropdown = pageA.getByRole('listbox', { name: /search results/i });
      await expect(dropdown).toBeVisible({ timeout: 5000 });
      // Wait for fresh results (cache cleared after send)
      await expect(dropdown).toContainText(/no users found/i, { timeout: 8000 });

      // Also: userB searches for userA — should NOT appear (pending received)
      await navigateToFriendsTab(pageB);
      await typeInSearchAndWaitForResults(pageB, usernameA.slice(0, 6));
      const dropdownB = pageB.getByRole('listbox', { name: /search results/i });
      await expect(dropdownB).toBeVisible({ timeout: 5000 });
      await expect(dropdownB).toContainText(/no users found/i);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});

test.describe('Username: case-insensitive search', () => {
  test.setTimeout(90000);

  test('typing uppercase query finds lowercase username', async ({
    browser,
    baseURL,
  }) => {
    const idA = crypto.randomUUID().slice(0, 8);
    const idB = crypto.randomUUID().slice(0, 8);
    const emailA = `un-case-a-${idA}@example.com`;
    const emailB = `un-case-b-${idB}@example.com`;
    const displayNameA = `CaseAlpha ${idA}`;
    const displayNameB = `CaseBeta ${idB}`;
    // lowercase username for userA
    const usernameA = `lower${idA}`;

    const ctxA = await browser.newContext({ baseURL });
    const ctxB = await browser.newContext({ baseURL });
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      await registerAndSetup(pageA, emailA, displayNameA, usernameA);
      await registerAndSetup(pageB, emailB, displayNameB);

      // userB searches using uppercase
      await navigateToFriendsTab(pageB);
      const upperQuery = usernameA.slice(0, 6).toUpperCase();
      await typeInSearchAndWaitForResults(pageB, upperQuery);

      // userA should still appear in results
      const resultButton = pageB.getByRole('button', {
        name: new RegExp(displayNameA),
      });
      await expect(resultButton).toBeVisible();
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});

test.describe('Username: registration validation', () => {
  test.setTimeout(60000);

  test('invalid username at registration shows inline error', async ({ page }) => {
    const id = crypto.randomUUID().slice(0, 8);
    const email = `un-invalid-${id}@example.com`;

    await page.goto('/register');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill('ValidPassword123');
    await page.getByLabel(/display name/i).fill('Test User');

    // Enter a username with invalid characters (valid length, bad chars)
    const usernameInput = page.getByLabel(/username \(optional\)/i);
    await usernameInput.fill('abc!def');
    // Blur to trigger validation
    await usernameInput.blur();

    // Should show inline validation error about invalid characters
    await expect(page.getByText(/username can only contain letters, numbers, and underscores/i)).toBeVisible();
  });

  test('too short username at registration shows inline error', async ({ page }) => {
    const id = crypto.randomUUID().slice(0, 8);
    const email = `un-short-${id}@example.com`;

    await page.goto('/register');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill('ValidPassword123');
    await page.getByLabel(/display name/i).fill('Test User');

    const usernameInput = page.getByLabel(/username \(optional\)/i);
    await usernameInput.fill('ab');
    await usernameInput.blur();

    await expect(page.getByText(/username must be at least 3 characters/i)).toBeVisible();
  });

  test('duplicate username at registration shows already taken error', async ({ browser, baseURL }) => {
    const id = crypto.randomUUID().slice(0, 8);
    const emailA = `un-dup-a-${id}@example.com`;
    const emailB = `un-dup-b-${id}@example.com`;
    const username = uniqueUsername();

    // Register first user with that username in context A
    const ctxA = await browser.newContext({ baseURL });
    const pageA = await ctxA.newPage();
    await registerWithOptionalUsername(pageA, emailA, `DupAlpha ${id}`, username);
    await pageA.waitForURL(/\/(select-plan|setup)/);
    await ctxA.close();

    // Register second user with the same username in a fresh context
    const ctxB = await browser.newContext({ baseURL });
    const pageB = await ctxB.newPage();
    try {
      await pageB.goto('/register');
      await pageB.getByLabel(/email/i).fill(emailB);
      await pageB.getByLabel(/password/i).fill('ValidPassword123');
      await pageB.getByLabel(/display name/i).fill(`DupBeta ${id}`);
      await pageB.getByLabel(/username \(optional\)/i).fill(username);
      await pageB.getByRole('button', { name: /create account/i }).click();

      // Should show error about username already taken
      await expect(pageB.getByRole('alert')).toContainText(/already taken/i);
    } finally {
      await ctxB.close();
    }
  });
});
