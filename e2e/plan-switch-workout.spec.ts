import { test, expect } from './fixtures';
import { DashboardPage } from './pages/dashboard.page';
import { WorkoutPage } from './pages/workout.page';
import { SettingsPage } from './pages/settings.page';
import { createSecondPlan } from './helpers/create-second-plan';

test.describe('Plan switch discards in-progress workout', () => {
  test('switching plans while having an in-progress workout discards it', async ({
    setupCompletePage,
  }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const workout = new WorkoutPage(page);

    // 1. Start a Day 1 workout on nSuns
    await dashboard.expectLoaded();
    await dashboard.startWorkout(1);
    await workout.expectLoaded(1);

    // 2. Complete some reps so the workout is actually in progress with data
    // Wait for set rows to be rendered (workout creation via useEffect may still be in progress)
    await expect(page.locator('[data-testid="set-row"]').first()).toBeVisible();
    await workout.confirmSet(0);
    await workout.confirmSet(1);
    await workout.confirmSet(2);

    // 3. Go back to dashboard
    await page.goto('/');
    await dashboard.expectLoaded();

    // Verify "Continue Workout" is shown (workout is in progress)
    await expect(
      dashboard.getDayCard(1).getByRole('link', { name: /continue workout/i }),
    ).toBeVisible();

    // 4. Create a second plan (promotes user to admin, re-logs in, creates plan via API)
    await createSecondPlan(page);

    // 5. Navigate to settings and switch plans
    const settings = new SettingsPage(page);
    await settings.navigate();
    await settings.expectLoaded();
    await page.getByRole('link', { name: /change plan/i }).click();
    await expect(page.getByRole('heading', { name: /choose a workout plan/i })).toBeVisible();

    // Select the "Simple Test Plan" — find the button following the plan heading
    await page
      .getByRole('heading', { name: 'Simple Test Plan', exact: true })
      .locator('..')
      .locator('..')
      .getByRole('button', { name: /select plan/i })
      .click();

    // Confirm the plan switch (modal warns about in-progress workout)
    await expect(page.getByText(/in-progress workout/i)).toBeVisible();
    await page.getByRole('button', { name: /confirm switch/i }).click();

    // 6. Should be on dashboard (TMs carry over since we use same exercises)
    await dashboard.expectLoaded();

    // 7. Verify the old workout is discarded - Day 1 should show "Start Workout", not "Continue"
    await expect(
      dashboard.getDayCard(1).getByRole('link', { name: /start workout/i }),
    ).toBeVisible();
  });
});
