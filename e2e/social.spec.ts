import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

async function registerAndSetup(page: Page, email: string, displayName: string) {
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill('ValidPassword123');
  await page.getByLabel(/display name/i).fill(displayName);
  await page.getByRole('button', { name: /create account/i }).click();

  // Select first plan
  await page.getByRole('button', { name: /select plan/i }).first().click();
  await page.waitForURL(/\/setup/);

  // Fill 1RMs
  await expect(page.getByRole('heading', { name: /enter your 1 rep maxes/i })).toBeVisible();
  await page.getByLabel(/Bench Press/i).fill('100');
  await page.getByLabel(/^Squat/i).fill('140');
  await page.getByLabel(/Overhead Press/i).fill('60');
  await page.getByLabel(/^Deadlift/i).fill('180');
  await page.getByRole('button', { name: /calculate/i }).click();

  await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
}

test.describe('Social features', () => {
  test('friend request, feed event, and leaderboard with two users', async ({ browser }) => {
    // Give this multi-step test more time than the default
    test.setTimeout(60000);

    const uniqueA = crypto.randomUUID().slice(0, 8);
    const uniqueB = crypto.randomUUID().slice(0, 8);
    const emailA = `social-a-${uniqueA}@example.com`;
    const emailB = `social-b-${uniqueB}@example.com`;
    const displayNameA = `Alpha ${uniqueA}`;
    const displayNameB = `Beta ${uniqueB}`;

    const contextA = await browser.newContext({ baseURL: BASE_URL });
    const contextB = await browser.newContext({ baseURL: BASE_URL });
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // --- Register both users ---
      await registerAndSetup(pageA, emailA, displayNameA);
      await registerAndSetup(pageB, emailB, displayNameB);

      // --- userA navigates to Social > Friends and sends a request ---
      await pageA.getByRole('link', { name: /social/i }).click();
      await expect(pageA.getByRole('heading', { name: /social/i })).toBeVisible();
      await pageA.getByRole('tab', { name: /friends/i }).click();

      await expect(pageA.getByLabel(/friend's email address/i)).toBeVisible();
      await pageA.getByLabel(/friend's email address/i).fill(emailB);
      await pageA.getByRole('button', { name: /^send$/i }).click();

      await expect(pageA.getByRole('status')).toContainText(/friend request sent/i);

      // --- userB opens Social > Friends and sees the pending request ---
      await pageB.getByRole('link', { name: /social/i }).click();
      await expect(pageB.getByRole('heading', { name: /social/i })).toBeVisible();
      await pageB.getByRole('tab', { name: /friends/i }).click();

      const acceptButton = pageB.getByRole('button', {
        name: `Accept friend request from ${displayNameA}`,
      });
      await expect(acceptButton).toBeVisible();
      await acceptButton.click();

      // userA should now appear in userB's confirmed friends list
      await expect(pageB.getByText(new RegExp(displayNameA))).toBeVisible();

      // --- userA completes a workout ---
      await pageA.getByRole('link', { name: /home/i }).click();
      await expect(pageA.getByText('Workout Days')).toBeVisible();
      await pageA.getByRole('link', { name: /start workout/i }).first().click();
      await expect(pageA.getByRole('heading', { name: /day \d/i })).toBeVisible();

      // Complete workout — skip AMRAP, use "complete anyway" dialog
      await pageA.getByRole('button', { name: /complete workout/i }).click();
      const confirmDialog = pageA.locator('[data-testid="confirm-dialog"]');
      const backButton = pageA.getByRole('link', { name: 'Back to Dashboard' });
      await expect(confirmDialog.or(backButton)).toBeVisible();
      if (await confirmDialog.isVisible()) {
        await confirmDialog.getByRole('button', { name: /complete anyway/i }).click();
      }
      await expect(backButton).toBeVisible();

      // --- userB's feed shows userA's workout_completed event ---
      // The feed endpoint shows friends' events; userB is a friend of userA
      await pageB.getByRole('tab', { name: /feed/i }).click();
      await expect(
        pageB.getByText(new RegExp(`${displayNameA}.*completed Day`, 'i')),
      ).toBeVisible();

      // --- Both users check the leaderboard and see each other ---

      // userA navigates back to Social > Leaderboard
      await pageA.getByRole('link', { name: /social/i }).click();
      await expect(pageA.getByRole('heading', { name: /social/i })).toBeVisible();
      await pageA.getByRole('tab', { name: /leaderboard/i }).click();

      // userA sees userB in the leaderboard
      await expect(pageA.getByText(new RegExp(displayNameB))).toBeVisible();

      // userB switches to the leaderboard tab and sees userA
      await pageB.getByRole('tab', { name: /leaderboard/i }).click();
      await expect(pageB.getByText(new RegExp(displayNameA))).toBeVisible();
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
