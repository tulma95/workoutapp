import { test, expect } from './fixtures';
import { DashboardPage } from './pages/dashboard.page';
import { WorkoutPage } from './pages/workout.page';
import { ProgressPage } from './pages/progress.page';
import { SettingsPage } from './pages/settings.page';
import { createSecondPlan } from './helpers/create-second-plan';
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

  test('shows exercise summary cards with e1RM after completing workout', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    // Complete Day 1 to generate e1RM data
    await completeWorkout(page, 1, 5);

    const progress = new ProgressPage(page);
    await progress.navigate();
    await progress.expectLoaded();

    // Should show exercises that had completed sets, with kg values
    await expect(page.getByText(/bench/i).first()).toBeVisible();
    await expect(page.getByText(/kg/).first()).toBeVisible();
  });

  test('log bodyweight and see it in the history', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const progress = new ProgressPage(page);
    await progress.navigate();
    await progress.expectLoaded();

    await page.getByLabel('Bodyweight (kg)').fill('82.5');
    const post = page.waitForResponse(
      (r) => r.url().includes('/api/bodyweight') && r.request().method() === 'POST' && r.ok(),
    );
    await page.getByRole('button', { name: 'Log' }).click();
    await post;

    const history = page.getByTestId('bodyweight-history');
    await expect(history).toBeVisible();
    await expect(history.getByText('82.5 kg')).toBeVisible();

    // A second, lighter entry shows a downward trend.
    await page.getByLabel('Bodyweight (kg)').fill('81.2');
    const post2 = page.waitForResponse(
      (r) => r.url().includes('/api/bodyweight') && r.request().method() === 'POST' && r.ok(),
    );
    await page.getByRole('button', { name: 'Log' }).click();
    await post2;

    await expect(page.getByText(/↓ 1\.3 kg/)).toBeVisible();

    // With two entries, the trend sparkline appears.
    await expect(page.getByTestId('bodyweight-chart')).toBeVisible();
  });

  test('shows a Personal Records board after completing a workout', async ({
    setupCompletePage,
  }) => {
    const { page } = setupCompletePage;

    await completeWorkout(page, 1, 5);

    const progress = new ProgressPage(page);
    await progress.navigate();
    await progress.expectLoaded();

    await expect(page.getByRole('heading', { name: /personal records/i })).toBeVisible();
    const records = page.getByTestId('personal-records');
    await expect(records).toBeVisible();
    // Each record card shows an est. 1RM with a kg value.
    await expect(records.getByText(/est\. 1rm/i).first()).toBeVisible();
    await expect(records.getByText(/kg/).first()).toBeVisible();
  });

  test('shows empty state before any workouts', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const progress = new ProgressPage(page);

    await progress.navigate();
    await progress.expectLoaded();

    // No completed workout sets = no e1RM data = full empty state
    await expect(page.getByText(/no training data yet/i)).toBeVisible();
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
    await page.getByRole('link', { name: /home/i }).click();
    await progress.navigate();
    await progress.expectLoaded();

    // 6M should still be selected
    await expect(page.getByRole('radio', { name: '6M' })).toBeChecked();
  });

  test('shows e1RM after completing a workout', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    // Complete Day 1 with high AMRAP reps
    await completeWorkout(page, 1, 10);

    const progress = new ProgressPage(page);
    await progress.navigate();
    await progress.expectLoaded();

    // Should show bench press with an e1RM value in kg
    await expect(page.getByText(/bench/i).first()).toBeVisible();
    await expect(page.getByText(/kg/).first()).toBeVisible();
  });

  test('shows plan switch marker on chart after switching plans', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);

    const token = await page.evaluate(() => localStorage.getItem('accessToken'));

    // Create a backdated completed workout (7 days ago) so the chart has 2 data points
    const backdateRes = await page.request.post('/api/dev/backdate-workout', {
      headers: { Authorization: `Bearer ${token}` },
      data: { exerciseSlug: 'squat', weight: 120, reps: 5, daysAgo: 7 },
    });
    expect(backdateRes.ok()).toBeTruthy();

    // Complete Day 2 (which has squat) to create today's data point
    await completeWorkout(page, 2, 5);

    // Create a second plan (promotes to admin, re-logs in, creates plan via API)
    const planName = await createSecondPlan(page);

    // Navigate to settings and switch plans
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

    // Confirm the plan switch via the modal
    await expect(page.getByRole('button', { name: /confirm switch/i })).toBeVisible();
    await page.getByRole('button', { name: /confirm switch/i }).click();

    // Should be on dashboard with the second plan active
    await dashboard.expectLoaded();

    // Navigate to progress page, enable "Show all exercises", select "All" time range
    const progress = new ProgressPage(page);
    await progress.navigate();
    await progress.expectLoaded();

    // The squat exercise is from the old plan, so we need to show all exercises
    const showAllToggle = page.getByLabel(/show all exercises/i);
    if (await showAllToggle.isVisible()) {
      await showAllToggle.check();
    }

    await progress.selectTimeRange('All');

    // Select squat exercise card if visible
    const squatCard = page.getByText(/squat/i).first();
    if (await squatCard.isVisible()) {
      await squatCard.click();
    }

    // The chart should have the plan switch marker between the two data points
    await expect(
      page.locator('svg title').filter({ hasText: /Plan switch:/ }).first(),
    ).toBeAttached();
  });
});
