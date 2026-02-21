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

test.describe('Streak visibility', () => {
  test.setTimeout(60000);

  test('userA sees userB 2-day streak in Friends tab and Feed', async ({ browser, baseURL }) => {
    const uniqueA = crypto.randomUUID().slice(0, 8);
    const uniqueB = crypto.randomUUID().slice(0, 8);
    const emailA = `streak-a-${uniqueA}@example.com`;
    const emailB = `streak-b-${uniqueB}@example.com`;
    const usernameA = `streaka${uniqueA}`;
    const usernameB = `streakb${uniqueB}`;

    const contextA = await browser.newContext({ baseURL });
    const contextB = await browser.newContext({ baseURL });
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // Register both users
      await registerAndSetup(pageA, emailA, usernameA);
      await registerAndSetup(pageB, emailB, usernameB);

      // userA sends friend request to userB
      await pageA.getByRole('link', { name: /social/i }).click();
      await pageA.getByRole('tab', { name: /friends/i }).click();
      await pageA.getByRole('button', { name: /send by email/i }).click();
      await pageA.getByLabel(/friend's email address/i).fill(emailB);
      await pageA.getByRole('button', { name: /^send$/i }).click();
      await expect(pageA.getByRole('status')).toContainText(/friend request sent/i);

      // userB accepts the friend request
      await pageB.getByRole('link', { name: /social/i }).click();
      await pageB.getByRole('tab', { name: /friends/i }).click();
      const acceptButton = pageB.getByRole('button', {
        name: `Accept friend request from ${usernameA}`,
      });
      await expect(acceptButton).toBeVisible();
      await acceptButton.click();
      await expect(pageB.getByText(new RegExp(usernameA))).toBeVisible();

      // Get userB's auth token and an exercise ID
      const tokenB = await pageB.evaluate(() => localStorage.getItem('accessToken'));
      const exercisesResp = await pageB.request.get('/api/exercises', {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      const exercisesData = await exercisesResp.json() as { id: number }[];
      const exerciseId = exercisesData[0].id;

      // Create two custom workouts for userB: today and yesterday
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);
      const yesterday = new Date(today);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);

      for (const date of [todayStr, yesterdayStr]) {
        const resp = await pageB.request.post('/api/workouts/custom', {
          headers: { Authorization: `Bearer ${tokenB}` },
          data: { date, exercises: [{ exerciseId, sets: [{ weight: 100, reps: 5 }] }] },
        });
        expect(resp.status()).toBe(201);
      }

      // Reload to clear React Query cache (staleTime=60s, data won't auto-refetch within the test)
      await pageA.reload();
      await pageA.getByRole('link', { name: /social/i }).click();
      await pageA.getByRole('tab', { name: /friends/i }).click();
      await expect(pageA.getByText(/2 day streak/i)).toBeVisible({ timeout: 10000 });

      // userA navigates to Feed tab and sees "2-day streak" suffix on userB's event
      await pageA.getByRole('tab', { name: /feed/i }).click();
      await expect(pageA.getByText(/2-day streak/i).first()).toBeVisible({ timeout: 10000 });
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});

test.describe('Leaderboard toggle', () => {
  test.setTimeout(60000);

  test('TM/e1RM toggle switches mode and shows correct empty state', async ({ page }) => {
    const unique = crypto.randomUUID().slice(0, 8);
    const email = `leaderboard-toggle-${unique}@example.com`;
    const username = `lbtoggle${unique}`;

    const register = new RegisterPage(page);
    await register.register(email, 'ValidPassword123', username);

    const planSelection = new PlanSelectionPage(page);
    await planSelection.selectFirstPlan();

    const setup = new SetupPage(page);
    await setup.expectHeading();
    await setup.fillOneRepMaxes('100', '140', '60', '180');
    await setup.submitAndWaitForDashboard();

    await page.getByRole('link', { name: /social/i }).click();
    await expect(page.getByRole('heading', { name: /social/i })).toBeVisible();
    await page.getByRole('tab', { name: /leaderboard/i }).click();

    // Training Max button is visible and active by default
    const tmButton = page.getByRole('button', { name: 'Training Max' });
    const e1rmButton = page.getByRole('button', { name: 'Est. 1RM' });
    await expect(tmButton).toBeVisible();
    await expect(tmButton).toHaveAttribute('aria-pressed', 'true');

    // Switch to Est. 1RM mode
    await e1rmButton.click();
    await expect(e1rmButton).toHaveAttribute('aria-pressed', 'true');
    await expect(tmButton).toHaveAttribute('aria-pressed', 'false');

    // e1RM empty state text appears
    await expect(
      page.getByText('Complete AMRAP sets to appear on the e1RM leaderboard'),
    ).toBeVisible();

    // Switch back to Training Max
    await tmButton.click();
    await expect(tmButton).toHaveAttribute('aria-pressed', 'true');
    await expect(e1rmButton).toHaveAttribute('aria-pressed', 'false');
  });
});

test.describe('Social features', () => {
  test.setTimeout(60000);

  test('friend request, feed event, and leaderboard with two users', async ({ browser, baseURL }) => {
    const uniqueA = crypto.randomUUID().slice(0, 8);
    const uniqueB = crypto.randomUUID().slice(0, 8);
    const emailA = `social-a-${uniqueA}@example.com`;
    const emailB = `social-b-${uniqueB}@example.com`;
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

      // --- userA navigates to Social > Friends and sends a request ---
      await pageA.getByRole('link', { name: /social/i }).click();
      await expect(pageA.getByRole('heading', { name: /social/i })).toBeVisible();
      await pageA.getByRole('tab', { name: /friends/i }).click();
      await pageA.getByRole('button', { name: /send by email/i }).click();

      await expect(pageA.getByLabel(/friend's email address/i)).toBeVisible();
      await pageA.getByLabel(/friend's email address/i).fill(emailB);
      await pageA.getByRole('button', { name: /^send$/i }).click();

      await expect(pageA.getByRole('status')).toContainText(/friend request sent/i);

      // --- userB opens Social > Friends and sees the pending request ---
      await pageB.getByRole('link', { name: /social/i }).click();
      await expect(pageB.getByRole('heading', { name: /social/i })).toBeVisible();
      await pageB.getByRole('tab', { name: /friends/i }).click();

      const acceptButton = pageB.getByRole('button', {
        name: `Accept friend request from ${usernameA}`,
      });
      await expect(acceptButton).toBeVisible();
      await acceptButton.click();

      // userA should now appear in userB's confirmed friends list
      await expect(pageB.getByText(new RegExp(usernameA))).toBeVisible();

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
        pageB.getByText(new RegExp(`${usernameA}.*completed Day`, 'i')),
      ).toBeVisible({ timeout: 10000 });

      // --- Both users check the leaderboard and see each other ---

      // userA navigates to Social > Leaderboard
      await pageA.getByRole('link', { name: /social/i }).click();
      await expect(pageA.getByRole('heading', { name: /social/i })).toBeVisible();
      await pageA.getByRole('tab', { name: /leaderboard/i }).click();

      // userA sees userB in the leaderboard
      await expect(pageA.getByText(new RegExp(usernameB)).first()).toBeVisible();

      // userB switches to the leaderboard tab and sees userA
      await pageB.getByRole('tab', { name: /leaderboard/i }).click();
      await expect(pageB.getByText(new RegExp(usernameA)).first()).toBeVisible();
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
