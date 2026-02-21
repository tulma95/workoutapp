import { test, expect, type Page } from '@playwright/test';
import { RegisterPage } from './pages/register.page';
import { PlanSelectionPage } from './pages/plan-selection.page';
import { SetupPage } from './pages/setup.page';
import { WorkoutPage } from './pages/workout.page';

async function registerAndSetup(page: Page, email: string, username: string) {
  const register = new RegisterPage(page);
  await register.register(email, 'ValidPassword123', username);

  const planSelection = new PlanSelectionPage(page);
  await planSelection.selectFirstPlan();

  const setup = new SetupPage(page);
  await setup.expectHeading();
  await setup.fillOneRepMaxes('100', '140', '60', '180');
  await setup.submitAndWaitForDashboard();
}

test.describe('Feed reactions', () => {
  test.setTimeout(60000);

  test('B can react to A\'s feed event and toggle the reaction off', async ({ browser, baseURL }) => {
    const uniqueA = crypto.randomUUID().slice(0, 8);
    const uniqueB = crypto.randomUUID().slice(0, 8);
    const emailA = `react-a-${uniqueA}@example.com`;
    const emailB = `react-b-${uniqueB}@example.com`;
    const usernameA = `alpha${uniqueA}`;
    const usernameB = `beta${uniqueB}`;

    const contextA = await browser.newContext({ baseURL });
    const contextB = await browser.newContext({ baseURL });
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // --- Register both users ---
      await registerAndSetup(pageA, emailA, usernameA);
      await registerAndSetup(pageB, emailB, usernameB);

      // --- userA sends a friend request to userB ---
      await pageA.getByRole('link', { name: /social/i }).click();
      await expect(pageA.getByRole('heading', { name: /social/i })).toBeVisible();
      await pageA.getByRole('tab', { name: /friends/i }).click();
      await pageA.getByRole('button', { name: /send by email/i }).click();

      await expect(pageA.getByLabel(/friend's email address/i)).toBeVisible();
      await pageA.getByLabel(/friend's email address/i).fill(emailB);
      await pageA.getByRole('button', { name: /^send$/i }).click();

      await expect(pageA.getByRole('status')).toContainText(/friend request sent/i);

      // --- userB accepts the friend request ---
      await pageB.getByRole('link', { name: /social/i }).click();
      await expect(pageB.getByRole('heading', { name: /social/i })).toBeVisible();
      await pageB.getByRole('tab', { name: /friends/i }).click();

      const acceptButton = pageB.getByRole('button', {
        name: `Accept friend request from ${usernameA}`,
      });
      await expect(acceptButton).toBeVisible();
      await acceptButton.click();
      await expect(pageB.getByText(new RegExp(usernameA))).toBeVisible();

      // --- userA completes a workout (creates a feed event) ---
      await pageA.getByRole('link', { name: /home/i }).click();
      await expect(pageA.getByText('Workout Days')).toBeVisible();
      await pageA.getByRole('link', { name: /start workout/i }).first().click();
      const workout = new WorkoutPage(pageA);
      await expect(workout.completeButton).toBeVisible({ timeout: 15000 });

      await workout.completeWithDialog();
      await workout.dismissAchievementDialogIfPresent();
      await expect(workout.backToDashboardButton).toBeVisible({ timeout: 10000 });

      // --- userB navigates to Feed tab and sees A's workout_completed event ---
      await pageB.getByRole('tab', { name: /feed/i }).click();
      await expect(
        pageB.getByText(new RegExp(`${usernameA}.*completed Day`, 'i')),
      ).toBeVisible({ timeout: 10000 });

      // --- userB taps the 🔥 button ---
      // Initially: aria-label="React with 🔥", aria-pressed="false"
      const fireButton = pageB.getByRole('button', { name: 'React with 🔥', exact: true }).first();
      await expect(fireButton).toBeVisible();
      await expect(fireButton).toHaveAttribute('aria-pressed', 'false');
      await fireButton.click();

      // After react: aria-label="React with 🔥 (1)", aria-pressed="true"
      const activeFireButton = pageB
        .getByRole('button', { name: 'React with 🔥 (1)', exact: true })
        .first();
      await expect(activeFireButton).toBeVisible({ timeout: 5000 });
      await expect(activeFireButton).toHaveAttribute('aria-pressed', 'true');

      // --- Tap again to toggle off ---
      await activeFireButton.click();

      // After toggle off: aria-label="React with 🔥", aria-pressed="false", count gone
      const inactiveFireButton = pageB
        .getByRole('button', { name: 'React with 🔥', exact: true })
        .first();
      await expect(inactiveFireButton).toHaveAttribute('aria-pressed', 'false', { timeout: 5000 });
      await expect(
        pageB.getByRole('button', { name: 'React with 🔥 (1)', exact: true }),
      ).toHaveCount(0);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
