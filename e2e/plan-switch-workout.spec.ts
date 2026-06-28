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
    const planName = await createSecondPlan(page);

    // 5. Navigate to settings and switch plans
    const settings = new SettingsPage(page);
    await settings.navigate();
    await settings.expectLoaded();
    await page.getByRole('link', { name: /change plan/i }).click();
    await expect(page.getByRole('heading', { name: /choose a workout plan/i })).toBeVisible();

    // Select the created test plan
    await page
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: planName, exact: true }) })
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

  // Regression for ticket 190: arriving at /select-plan via a full (cold-cache)
  // navigation must still open the confirmation modal — previously the decision
  // read plan.current() from the React Query cache, which is empty on direct load,
  // so the switch happened silently. Also covers ticket 195 (current-plan marker).
  test('direct navigation to select-plan still confirms before switching', async ({
    setupCompletePage,
  }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    await dashboard.expectLoaded();

    const planName = await createSecondPlan(page);

    // Full-page navigation -> React Query in-memory cache starts cold.
    await page.goto('/select-plan');
    await expect(page.getByRole('heading', { name: /choose a workout plan/i })).toBeVisible();

    // Ticket 195: the active plan is marked and cannot be re-selected.
    await expect(page.getByRole('button', { name: 'Current Plan', exact: true })).toBeDisabled();

    // Ticket 190: selecting a different plan opens the confirmation modal
    // instead of switching immediately.
    await page
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: planName, exact: true }) })
      .getByRole('button', { name: /select plan/i })
      .click();

    await expect(page.getByRole('heading', { name: /switch to/i })).toBeVisible();

    // Cancel leaves us on the page with no switch performed.
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByRole('heading', { name: /choose a workout plan/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Current Plan', exact: true })).toBeDisabled();
  });
});
