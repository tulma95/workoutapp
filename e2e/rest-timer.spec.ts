import { test, expect } from './fixtures';
import { DashboardPage } from './pages/dashboard.page';
import { WorkoutPage } from './pages/workout.page';

test.describe('Rest Timer', () => {
  test('completing a set shows the rest timer banner', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const workout = new WorkoutPage(page);

    await dashboard.expectLoaded();
    await dashboard.startWorkout();
    await workout.expectLoaded(1);

    // Complete a set
    await workout.confirmSet(0);

    // Timer banner should appear
    await expect(workout.restTimerBanner).toBeVisible();
  });

  test('tapping Skip dismisses the rest timer', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const workout = new WorkoutPage(page);

    await dashboard.expectLoaded();
    await dashboard.startWorkout();
    await workout.expectLoaded(1);

    await workout.confirmSet(0);
    await expect(workout.restTimerBanner).toBeVisible();

    await workout.skipRestButton.click();
    await expect(workout.restTimerBanner).not.toBeVisible();
  });

  test('+30s and -30s buttons adjust the timer', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const workout = new WorkoutPage(page);

    await dashboard.expectLoaded();
    await dashboard.startWorkout();
    await workout.expectLoaded(1);

    await workout.confirmSet(0);
    await expect(workout.restTimerBanner).toBeVisible();

    // Read initial time text
    const initialText = await workout.restTimerBanner.locator('span').first().textContent();

    // Tap +30s
    await workout.increaseRestButton.click();
    const afterIncrease = await workout.restTimerBanner.locator('span').first().textContent();
    expect(afterIncrease).not.toBe(initialText);

    // Tap -30s
    await workout.decreaseRestButton.click();
    // Timer should still be visible
    await expect(workout.restTimerBanner).toBeVisible();
  });

  test('completing the last set does not start the timer', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const workout = new WorkoutPage(page);

    await dashboard.expectLoaded();
    await dashboard.startWorkout();
    await workout.expectLoaded(1);

    // Complete all sets
    const setRows = page.locator('[data-testid="set-row"]');
    const count = await setRows.count();

    for (let i = 0; i < count; i++) {
      // Skip rest timer if it appears (from previous set completion)
      if (await workout.restTimerBanner.isVisible()) {
        await workout.skipRestButton.click();
      }
      await workout.confirmSet(i);
    }

    // After last set, timer should NOT appear
    // Small wait to ensure timer would have started if it was going to
    await page.waitForTimeout(200);
    await expect(workout.restTimerBanner).not.toBeVisible();
  });

  test('disabling rest timer in settings prevents timer from appearing', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const workout = new WorkoutPage(page);

    // Disable rest timer via settings page
    await page.getByRole('link', { name: /settings/i }).click();
    const checkbox = page.locator('#rest-timer-enabled');
    await expect(checkbox).toBeVisible();
    await checkbox.uncheck();

    // Go back and start workout
    await page.getByRole('link', { name: /dashboard/i }).first().click();
    await dashboard.expectLoaded();
    await dashboard.startWorkout();
    await workout.expectLoaded(1);

    await workout.confirmSet(0);

    // Timer should NOT appear
    await page.waitForTimeout(200);
    await expect(workout.restTimerBanner).not.toBeVisible();
  });
});
