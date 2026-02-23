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

  test("B can react to A's feed event with emoji picker and toggle off", async ({ browser, baseURL }) => {
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

      // (a) Verify "React" button is visible in the action row
      const reactButton = pageB.getByRole('button', { name: 'React', exact: true }).first();
      await expect(reactButton).toBeVisible();

      // (b) Click the React button — EmojiPicker should appear
      await reactButton.click();
      const fireEmojiButton = pageB.getByRole('button', { name: '🔥' }).first();
      await expect(fireEmojiButton).toBeVisible();

      // (d) Click outside the picker to close it without selecting a reaction
      await pageB.getByText(new RegExp(`${usernameA}.*completed Day`, 'i')).first().click();
      // Picker should close — no emoji buttons visible
      await expect(pageB.getByRole('button', { name: '🔥' })).toHaveCount(0);
      // React button still shows no reaction (aria-pressed="false")
      await expect(
        pageB.getByRole('button', { name: 'React', exact: true }).first(),
      ).toHaveAttribute('aria-pressed', 'false');

      // (b again) Click React button again — picker opens
      await pageB.getByRole('button', { name: 'React', exact: true }).first().click();
      await expect(pageB.getByRole('button', { name: '🔥' }).first()).toBeVisible();

      // (c) Click 🔥 emoji — reaction toggled on, picker closes
      await pageB.getByRole('button', { name: '🔥' }).first().click();
      // Picker should be gone
      await expect(pageB.getByRole('button', { name: '🔥' })).toHaveCount(0);
      // React button now reflects the active reaction
      const activeReactButton = pageB
        .getByRole('button', { name: 'You reacted with 🔥', exact: true })
        .first();
      await expect(activeReactButton).toBeVisible({ timeout: 5000 });
      await expect(activeReactButton).toHaveAttribute('aria-pressed', 'true');

      // (e) ReactionSummary shows the emoji count — "1" visible in the first feed item
      await expect(
        pageB.getByRole('listitem').first().getByText('1'),
      ).toBeVisible({ timeout: 5000 });

      // (f) Click the active React button to open picker, then click 🔥 again to toggle off
      await activeReactButton.click();
      await expect(pageB.getByRole('button', { name: '🔥' }).first()).toBeVisible();
      await pageB.getByRole('button', { name: '🔥' }).first().click();

      // Picker closes and reaction is removed
      await expect(pageB.getByRole('button', { name: '🔥' })).toHaveCount(0);
      const inactiveReactButton = pageB
        .getByRole('button', { name: 'React', exact: true })
        .first();
      await expect(inactiveReactButton).toHaveAttribute('aria-pressed', 'false', { timeout: 5000 });
      // ReactionSummary should no longer show count "1" in the feed item
      await expect(
        pageB.getByRole('listitem').first().getByText('1'),
      ).toHaveCount(0);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
