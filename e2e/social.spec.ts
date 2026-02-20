import { test, expect, type Page } from '@playwright/test';
import { RegisterPage } from './pages/register.page';
import { PlanSelectionPage } from './pages/plan-selection.page';
import { SetupPage } from './pages/setup.page';
import { WorkoutPage } from './pages/workout.page';

async function registerAndSetup(page: Page, email: string, displayName: string) {
  const register = new RegisterPage(page);
  await register.register(email, 'ValidPassword123', displayName);

  const planSelection = new PlanSelectionPage(page);
  await planSelection.selectFirstPlan();

  const setup = new SetupPage(page);
  await setup.expectHeading();
  await setup.fillOneRepMaxes('100', '140', '60', '180');
  await setup.submitAndWaitForDashboard();
}

test.describe('Social features', () => {
  test.setTimeout(60000);

  test('friend request, feed event, and leaderboard with two users', async ({ browser, baseURL }) => {
    const uniqueA = crypto.randomUUID().slice(0, 8);
    const uniqueB = crypto.randomUUID().slice(0, 8);
    const emailA = `social-a-${uniqueA}@example.com`;
    const emailB = `social-b-${uniqueB}@example.com`;
    const displayNameA = `Alpha ${uniqueA}`;
    const displayNameB = `Beta ${uniqueB}`;

    const contextA = await browser.newContext({ baseURL });
    const contextB = await browser.newContext({ baseURL });
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
      const workout = new WorkoutPage(pageA);
      await expect(workout.completeButton).toBeVisible({ timeout: 15000 });

      await workout.completeWithDialog();
      await workout.dismissAchievementDialogIfPresent();
      await expect(workout.backToDashboardButton).toBeVisible({ timeout: 10000 });

      // --- userB's feed shows userA's workout_completed event ---
      // The feed endpoint shows friends' events; userB is a friend of userA
      await pageB.getByRole('tab', { name: /feed/i }).click();
      await expect(
        pageB.getByText(new RegExp(`${displayNameA}.*completed Day`, 'i')),
      ).toBeVisible({ timeout: 10000 });

      // --- Both users check the leaderboard and see each other ---

      // userA navigates to Social > Leaderboard
      await pageA.getByRole('link', { name: /social/i }).click();
      await expect(pageA.getByRole('heading', { name: /social/i })).toBeVisible();
      await pageA.getByRole('tab', { name: /leaderboard/i }).click();

      // userA sees userB in the leaderboard
      await expect(pageA.getByText(new RegExp(displayNameB)).first()).toBeVisible();

      // userB switches to the leaderboard tab and sees userA
      await pageB.getByRole('tab', { name: /leaderboard/i }).click();
      await expect(pageB.getByText(new RegExp(displayNameA)).first()).toBeVisible();
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
