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

async function sendAndAcceptFriendRequest(
  pageA: Page,
  emailB: string,
  pageB: Page,
  displayNameA: string,
) {
  // userA sends a friend request to userB
  await pageA.getByRole('link', { name: /social/i }).click();
  await expect(pageA.getByRole('heading', { name: /social/i })).toBeVisible();
  await pageA.getByRole('tab', { name: /friends/i }).click();
  await pageA.getByLabel(/friend's email address/i).fill(emailB);
  await pageA.getByRole('button', { name: /^send$/i }).click();
  await expect(pageA.getByRole('status')).toContainText(/friend request sent/i);

  // userB accepts the friend request
  await pageB.getByRole('link', { name: /social/i }).click();
  await expect(pageB.getByRole('heading', { name: /social/i })).toBeVisible();
  await pageB.getByRole('tab', { name: /friends/i }).click();
  const acceptButton = pageB.getByRole('button', {
    name: `Accept friend request from ${displayNameA}`,
  });
  await expect(acceptButton).toBeVisible();
  await acceptButton.click();
  await expect(pageB.getByText(new RegExp(displayNameA))).toBeVisible();
}

test.describe('Feed new event types', () => {
  test.setTimeout(90000);

  test('badge_unlocked: B sees "unlocked" after A completes first workout', async ({
    browser,
    baseURL,
  }) => {
    const uniqueA = crypto.randomUUID().slice(0, 8);
    const uniqueB = crypto.randomUUID().slice(0, 8);
    const emailA = `badge-a-${uniqueA}@example.com`;
    const emailB = `badge-b-${uniqueB}@example.com`;
    const displayNameA = `BadgeAlpha ${uniqueA}`;

    const contextA = await browser.newContext({ baseURL });
    const contextB = await browser.newContext({ baseURL });
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await registerAndSetup(pageA, emailA, displayNameA);
      await registerAndSetup(pageB, emailB, `BadgeBeta ${uniqueB}`);

      await sendAndAcceptFriendRequest(pageA, emailB, pageB, displayNameA);

      // userA completes their first workout (unlocks first-blood badge -> badge_unlocked feed event)
      await pageA.getByRole('link', { name: /home/i }).click();
      await expect(pageA.getByText('Workout Days')).toBeVisible();
      await pageA.getByRole('link', { name: /start workout/i }).first().click();

      const workout = new WorkoutPage(pageA);
      await expect(workout.completeButton).toBeVisible({ timeout: 15000 });
      await workout.completeWithDialog();
      await workout.dismissAchievementDialogIfPresent();
      await expect(workout.backToDashboardButton).toBeVisible({ timeout: 10000 });

      // userB navigates to Feed tab and sees the badge_unlocked event
      await pageB.getByRole('tab', { name: /feed/i }).click();
      await expect(
        pageB.getByText(/unlocked/i).first(),
      ).toBeVisible({ timeout: 10000 });
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('plan_switched: B sees "switched to" after A subscribes to a plan', async ({
    browser,
    baseURL,
  }) => {
    const uniqueA = crypto.randomUUID().slice(0, 8);
    const uniqueB = crypto.randomUUID().slice(0, 8);
    const emailA = `planswitch-a-${uniqueA}@example.com`;
    const emailB = `planswitch-b-${uniqueB}@example.com`;
    const displayNameA = `PlanSwitchAlpha ${uniqueA}`;

    const contextA = await browser.newContext({ baseURL });
    const contextB = await browser.newContext({ baseURL });
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // Register A fully — plan subscription fires plan_switched feed event during setup
      await registerAndSetup(pageA, emailA, displayNameA);
      await registerAndSetup(pageB, emailB, `PlanSwitchBeta ${uniqueB}`);

      // Friend them — A sends request, B accepts
      // After friendship, B can see A's historical feed events (feed shows all friend events)
      await sendAndAcceptFriendRequest(pageA, emailB, pageB, displayNameA);

      // userB navigates to Feed tab and sees A's plan_switched event
      await pageB.getByRole('tab', { name: /feed/i }).click();
      await expect(
        pageB.getByText(/switched to/i).first(),
      ).toBeVisible({ timeout: 10000 });
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
