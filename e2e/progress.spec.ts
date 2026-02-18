import { test, expect } from './fixtures';
import { DashboardPage } from './pages/dashboard.page';
import { WorkoutPage } from './pages/workout.page';
import { ProgressPage } from './pages/progress.page';
import type { Page } from '@playwright/test';

async function completeWorkout(page: Page, dayNumber: number, amrapReps: number) {
  const dashboard = new DashboardPage(page);
  const workout = new WorkoutPage(page);

  await dashboard.expectLoaded();
  await dashboard.startWorkout(dayNumber);
  await workout.expectLoaded(dayNumber);

  await workout.fillAmrap(amrapReps.toString());
  await page.waitForResponse(
    resp => resp.url().includes('/api/workouts/') && resp.request().method() === 'PATCH' && resp.ok(),
  );

  await workout.completeWithDialog();
  await workout.goBackToDashboard();
}

test.describe('Progress Page', () => {
  test('shows heading and time range selector', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const progress = new ProgressPage(page);

    await progress.navigate();
    await progress.expectLoaded();

    // Time range selector should be visible with radio buttons
    await expect(page.getByRole('radio', { name: '3M' })).toBeChecked();
    await expect(page.getByRole('radio', { name: '1M' })).toBeVisible();
  });

  test('shows exercise summary cards with TM weights', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const progress = new ProgressPage(page);

    await progress.navigate();
    await progress.expectLoaded();

    // Should show all 4 exercises with kg weights
    await expect(page.getByText(/bench/i).first()).toBeVisible();
    await expect(page.getByText(/squat/i).first()).toBeVisible();
    await expect(page.getByText(/ohp/i).first()).toBeVisible();
    await expect(page.getByText(/deadlift/i).first()).toBeVisible();
    await expect(page.getByText(/kg/).first()).toBeVisible();
  });

  test('shows motivational empty state before any workouts', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const progress = new ProgressPage(page);

    await progress.navigate();
    await progress.expectLoaded();

    // Should show motivational copy (user has TMs but no completed workouts)
    await expect(page.getByText(/complete your first workout/i)).toBeVisible();
  });

  test('time range persists across navigation', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const progress = new ProgressPage(page);

    await progress.navigate();
    await progress.expectLoaded();

    // Select 6M
    await progress.selectTimeRange('6M');
    await expect(page.getByRole('radio', { name: '6M' })).toBeChecked();

    // Navigate away and back
    await page.getByRole('link', { name: /dashboard/i }).click();
    await progress.navigate();
    await progress.expectLoaded();

    // 6M should still be selected
    await expect(page.getByRole('radio', { name: '6M' })).toBeChecked();
  });

  test('shows updated TM after completing a workout with progression', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    // Complete Day 1 with high AMRAP reps to trigger bench progression
    await completeWorkout(page, 1, 10);

    const progress = new ProgressPage(page);
    await progress.navigate();
    await progress.expectLoaded();

    // Bench TM should have increased from 90 kg to 95 kg (10 reps = +5 kg)
    await expect(page.getByText('95 kg').first()).toBeVisible();

    // Cards should still be visible with all exercises
    await expect(page.getByText(/squat/i).first()).toBeVisible();
    await expect(page.getByText(/deadlift/i).first()).toBeVisible();
  });
});
