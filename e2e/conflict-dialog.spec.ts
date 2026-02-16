import { test, expect } from './fixtures';
import { DashboardPage } from './pages/dashboard.page';
import { WorkoutPage } from './pages/workout.page';
import type { Page } from '@playwright/test';

async function startDay1Workout(page: Page) {
  const dashboard = new DashboardPage(page);
  const workout = new WorkoutPage(page);

  await dashboard.expectLoaded();
  await dashboard.startWorkout(1);
  await page.waitForURL(/\/workout\/\d+/);
  await workout.expectLoaded(1);
  await expect(workout.checkboxes.first()).toBeVisible();
}

async function triggerConflictDialog(page: Page) {
  const dashboard = new DashboardPage(page);

  await page.goto('/');
  await dashboard.expectLoaded();
  await dashboard.getDayCard(2).getByRole('button').click();
  await expect(
    page.getByRole('heading', { name: /workout in progress/i }),
  ).toBeVisible({ timeout: 5000 });
}

test.describe('Conflict Dialog', () => {
  test('starting a different day workout while one is in-progress shows conflict dialog', async ({
    setupCompletePage,
  }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);

    await startDay1Workout(page);

    await page.goto('/');
    await dashboard.expectLoaded();
    await dashboard.getDayCard(2).getByRole('button').click();

    await expect(page.getByText(/you have a day 1 workout/i)).toBeVisible({ timeout: 5000 });
  });

  test('clicking Continue button in conflict dialog navigates to existing workout', async ({
    setupCompletePage,
  }) => {
    const { page } = setupCompletePage;
    await startDay1Workout(page);
    await triggerConflictDialog(page);

    const continueButton = page.getByRole('button', { name: 'Continue Day 1' });
    await expect(continueButton).toBeVisible();
    await continueButton.click();

    await page.waitForURL(/\/workout\/\d+/);
    const workout = new WorkoutPage(page);
    await expect(workout.dayHeading(1)).toBeVisible();
    await expect(page.getByText(/bench press/i).first()).toBeVisible();
  });

  test('clicking Discard & Start New button in conflict dialog starts the new workout', async ({
    setupCompletePage,
  }) => {
    const { page } = setupCompletePage;
    await startDay1Workout(page);
    await triggerConflictDialog(page);

    const discardButton = page.getByRole('button', { name: /discard.*start.*new/i });
    await expect(discardButton).toBeVisible();
    await discardButton.click();

    await page.waitForURL(/\/workout\/\d+/);
    const workout = new WorkoutPage(page);
    await expect(workout.dayHeading(2)).toBeVisible();
    await expect(page.getByText(/squat/i)).toBeVisible();
    await expect(page.getByText(/sumo.*deadlift/i)).toBeVisible();
  });

  test('clicking overlay outside conflict dialog navigates back to dashboard', async ({
    setupCompletePage,
  }) => {
    const { page } = setupCompletePage;
    await startDay1Workout(page);
    await triggerConflictDialog(page);

    const dialog = page.locator('dialog.conflict-dialog');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');

    await page.waitForURL('/');
    await expect(page.getByText(/workout days/i)).toBeVisible();
  });
});
