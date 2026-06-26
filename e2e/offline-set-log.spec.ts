import { test, expect } from './fixtures';
import { DashboardPage } from './pages/dashboard.page';
import { WorkoutPage } from './pages/workout.page';
import { SettingsPage } from './pages/settings.page';

const QUEUE_KEY = 'setforge:pendingSetLogs';

test.describe('Offline set logging', () => {
  test('a set logged while offline is queued and delivered on reconnect', async ({
    setupCompletePage,
  }) => {
    const { page } = setupCompletePage;
    const context = page.context();
    const dashboard = new DashboardPage(page);
    const workout = new WorkoutPage(page);

    await dashboard.expectLoaded();
    await dashboard.startWorkout();
    await workout.expectLoaded(1);
    await expect(workout.repsInputs.first()).toBeVisible();

    // Drop the connection, then log an AMRAP set. The optimistic UI still
    // updates, but the debounced PATCH fails and must be persisted.
    await context.setOffline(true);
    await workout.fillAmrap('10');

    await expect
      .poll(() => page.evaluate((k) => localStorage.getItem(k), QUEUE_KEY))
      .not.toBeNull();

    // Reconnect: the queue flushes on the `online` event and the PATCH lands.
    const patch = page.waitForResponse(
      (r) =>
        r.url().includes('/api/workouts/') &&
        r.request().method() === 'PATCH' &&
        r.ok(),
    );
    await context.setOffline(false);
    await patch;

    // Queue is drained once delivery succeeds.
    await expect
      .poll(() => page.evaluate((k) => localStorage.getItem(k), QUEUE_KEY))
      .toBeNull();

    // And the value survives a reload (it really reached the server).
    await page.reload();
    await workout.expectLoaded(1);
    const amrapReps = page
      .locator('[data-testid="set-row"][data-amrap]')
      .first()
      .getByTestId('reps-value');
    await expect(amrapReps).toHaveText('10');
  });

  test('queued set-logs still flush on reconnect when the online event is missed', async ({
    setupCompletePage,
  }) => {
    const { page } = setupCompletePage;
    const context = page.context();
    const dashboard = new DashboardPage(page);
    const workout = new WorkoutPage(page);

    await dashboard.expectLoaded();
    await dashboard.startWorkout();
    await workout.expectLoaded(1);
    await expect(workout.repsInputs.first()).toBeVisible();

    // Simulate WebKit/iOS Safari dropping the `online` event: a capture-phase
    // listener swallows it before the app's reconnect handler ever runs. Delivery
    // must still happen via the interval fallback, not the event.
    await page.evaluate(() => {
      window.addEventListener('online', (e) => e.stopImmediatePropagation(), true);
    });

    await context.setOffline(true);
    await workout.fillAmrap('10');

    await expect
      .poll(() => page.evaluate((k) => localStorage.getItem(k), QUEUE_KEY))
      .not.toBeNull();

    const patch = page.waitForResponse(
      (r) =>
        r.url().includes('/api/workouts/') &&
        r.request().method() === 'PATCH' &&
        r.ok(),
    );
    await context.setOffline(false);
    await patch;

    await expect
      .poll(() => page.evaluate((k) => localStorage.getItem(k), QUEUE_KEY))
      .toBeNull();
  });

  test('logout clears any queued set-logs so they cannot flush under another user', async ({
    setupCompletePage,
  }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const settings = new SettingsPage(page);

    await dashboard.expectLoaded();

    // Simulate a set-log that was queued while offline (the Settings page never
    // auto-flushes, so this stays put until logout).
    await settings.navigate();
    await page.evaluate((k) => {
      localStorage.setItem(
        k,
        JSON.stringify({ '1:1': { workoutId: 1, setId: 1, data: { actualReps: 5, completed: true } } }),
      );
    }, QUEUE_KEY);
    await expect
      .poll(() => page.evaluate((k) => localStorage.getItem(k), QUEUE_KEY))
      .not.toBeNull();

    await settings.logout();
    await expect(page).toHaveURL(/\/login/);

    expect(await page.evaluate((k) => localStorage.getItem(k), QUEUE_KEY)).toBeNull();
  });
});
