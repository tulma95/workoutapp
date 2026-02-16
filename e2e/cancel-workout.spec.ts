import { test, expect } from './fixtures';
import { DashboardPage } from './pages/dashboard.page';
import { WorkoutPage } from './pages/workout.page';

test.describe('Cancel Workout', () => {
  test('starting a workout, clicking Cancel, accepting dialog redirects to dashboard', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const workout = new WorkoutPage(page);

    await dashboard.expectLoaded();
    await dashboard.startWorkout();
    await page.waitForURL(/\/workout\/\d+/);
    await workout.expectLoaded(1);

    await workout.cancel();

    await expect(workout.confirmDialog).toBeVisible();
    await expect(workout.confirmDialog.locator('.confirm-dialog__message')).toContainText(/cancel/i);
    await expect(workout.confirmDialog.locator('.confirm-dialog__message')).toContainText(/progress/i);

    await workout.confirmDialog.getByRole('button', { name: /cancel workout/i }).click();

    await page.waitForURL('/');
    await dashboard.expectLoaded();
  });

  test('cancel workout returns success response', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const workout = new WorkoutPage(page);

    await dashboard.expectLoaded();
    await dashboard.startWorkout();
    await page.waitForURL(/\/workout\/\d+/);
    await workout.expectLoaded(1);

    const deleteResponsePromise = page.waitForResponse(
      response => response.url().includes('/api/workouts/') && response.request().method() === 'DELETE',
      { timeout: 10000 }
    );

    await workout.cancel();
    await expect(workout.confirmDialog).toBeVisible();
    await workout.confirmDialog.getByRole('button', { name: /cancel workout/i }).click();

    const deleteResponse = await deleteResponsePromise;
    expect(deleteResponse.status()).toBe(200);
    const deleteBody = await deleteResponse.json();
    expect(deleteBody.success).toBe(true);

    await page.waitForURL('/');
    await dashboard.expectLoaded();
  });

  test('clicking Cancel, dismissing dialog keeps user on workout page', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const workout = new WorkoutPage(page);

    await dashboard.expectLoaded();
    await dashboard.startWorkout();
    await page.waitForURL(/\/workout\/\d+/);
    await workout.expectLoaded(1);

    await workout.cancel();

    await expect(workout.confirmDialog).toBeVisible();
    await workout.confirmDialog.getByRole('button', { name: /^cancel$/i }).click();

    expect(page.url()).toMatch(/\/workout\/\d+/);
    await expect(workout.dayHeading(1)).toBeVisible();
    expect(await workout.checkboxes.count()).toBeGreaterThan(0);
  });
});
