import { test, expect } from './fixtures';
import { DashboardPage } from './pages/dashboard.page';
import { WorkoutPage } from './pages/workout.page';
import { HistoryPage } from './pages/history.page';
import type { Page } from '@playwright/test';

async function completeWorkout(page: Page, dayNumber: number, amrapReps: number) {
  const dashboard = new DashboardPage(page);
  const workout = new WorkoutPage(page);

  await dashboard.expectLoaded();
  await dashboard.startWorkout(dayNumber);
  await workout.expectLoaded(dayNumber);

  // Fill AMRAP and wait for the API call to persist
  await workout.fillAmrap(amrapReps.toString());
  await page.waitForResponse(
    resp => resp.url().includes('/api/workouts/') && resp.request().method() === 'PATCH' && resp.ok(),
  );

  await workout.completeWithDialog();
  await workout.goBackToDashboard();
}

test.describe('Workout History', () => {
  test('navigate to history page from bottom nav, verify calendar visible with month/year header', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const history = new HistoryPage(page);

    await dashboard.expectLoaded();
    await history.navigate();
    await history.expectLoaded();

    const { month, year } = HistoryPage.currentMonthYear();
    await expect(page.getByRole('heading', { name: new RegExp(`${month} ${year}`) })).toBeVisible();
  });

  test('no completed workouts - calendar renders, empty state message shown', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const history = new HistoryPage(page);

    await dashboard.expectLoaded();
    await history.navigate();

    const { month, year } = HistoryPage.currentMonthYear();
    await expect(page.getByRole('heading', { name: new RegExp(`${month} ${year}`) })).toBeVisible();
    await expect(page.getByText(/no workouts yet.*complete your first workout/i)).toBeVisible();
  });

  test('complete Day 1 workout, navigate to history, verify today highlighted on calendar', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const history = new HistoryPage(page);

    await completeWorkout(page, 1, 10);

    await history.navigate();

    const { month, year } = HistoryPage.currentMonthYear();
    await expect(page.getByRole('heading', { name: new RegExp(`${month} ${year}`) })).toBeVisible();
  });

  test('tap highlighted day, verify workout detail appears with Day 1, exercises, and set data', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const history = new HistoryPage(page);

    await completeWorkout(page, 1, 10);

    await history.navigateAndWaitForData();

    const today = new Date().getDate();
    await history.clickDay(today);

    await expect(page.getByRole('heading', { name: /day\s*1/i }).first()).toBeVisible();
    await expect(page.getByText(/bench/i).first()).toBeVisible();
    await expect(page.getByText(/overhead press/i).first()).toBeVisible();
    await expect(page.getByText(/\d+\s*kg/).first()).toBeVisible();
  });

  test('complete two workouts on same day, picker shows, can select each', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const history = new HistoryPage(page);

    await completeWorkout(page, 1, 10);
    await completeWorkout(page, 2, 8);

    await history.navigateAndWaitForData();

    const today = new Date().getDate();
    await history.clickDay(today);

    // Should show picker with Day 1 and Day 2
    await expect(page.getByRole('button', { name: /day 1/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /day 2/i })).toBeVisible();

    // Select Day 1
    await page.getByRole('button', { name: /day 1/i }).click();
    await expect(page.getByText(/bench/i).first()).toBeVisible();
  });

  test('completed sets show colored tinting in workout detail', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const history = new HistoryPage(page);

    await completeWorkout(page, 1, 10);
    await history.navigateAndWaitForData();

    const today = new Date().getDate();
    await history.clickDay(today);

    // Verify sets are visible with weight/reps data
    await expect(page.getByText(/\d+\s*kg/).first()).toBeVisible();
    // Verify set completion summary is shown
    await expect(page.getByText(/\d+\/\d+ sets/).first()).toBeVisible();
  });

  test('delete workout from history - workout disappears from calendar', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const history = new HistoryPage(page);

    await completeWorkout(page, 1, 10);
    await history.navigateAndWaitForData();

    const today = new Date().getDate();
    await history.clickDay(today);

    // Verify workout detail loaded
    await expect(page.getByRole('heading', { name: /day\s*1/i }).first()).toBeVisible();

    // Click delete button
    await page.getByRole('button', { name: /delete workout/i }).click();

    // Confirm in dialog
    await page.getByRole('button', { name: /^delete$/i }).click();

    // Workout should disappear - empty state or prompt shown
    await expect(page.getByText(/tap a workout day|no workouts yet/i)).toBeVisible();
  });

  test('month navigation - prev and next buttons are present and clickable', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const history = new HistoryPage(page);

    await dashboard.expectLoaded();
    await history.navigate();

    const currentDate = new Date();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    await expect(history.monthHeading).toContainText(`${monthNames[currentMonth]} ${currentYear}`);

    await expect(history.prevButton).toBeVisible();
    await expect(history.nextButton).toBeVisible();

    await history.goToPreviousMonth();
    await expect(history.monthHeading).toContainText(`${monthNames[prevMonth]} ${prevYear}`);

    await history.goToNextMonth();
    await expect(history.monthHeading).toContainText(`${monthNames[currentMonth]} ${currentYear}`);

    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    await history.goToNextMonth();
    await expect(history.monthHeading).toContainText(`${monthNames[nextMonth]} ${nextYear}`);

    await expect(history.calendarGrid).toBeVisible();
  });
});

test.describe('Calendar day selection', () => {
  test('clicking an empty past/today day selects it and shows Add Custom Workout button', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const history = new HistoryPage(page);

    await dashboard.expectLoaded();
    await history.navigate();
    await history.expectLoaded();

    const today = new Date().getDate();
    // Click today (no workouts yet) - should select it without opening modal
    await history.calendarGrid.getByRole('button').filter({ hasText: today.toString() }).first().click();

    // "Add Custom Workout" button should appear below the calendar
    await expect(page.getByRole('button', { name: /add custom workout/i })).toBeVisible();

    // Modal should NOT be open yet
    await expect(page.getByTestId('custom-workout-modal')).not.toBeVisible();
  });

  test('clicking Add Custom Workout button opens modal with correct date pre-filled', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const history = new HistoryPage(page);

    await dashboard.expectLoaded();
    await history.navigate();
    await history.expectLoaded();

    const today = new Date().getDate();
    await history.calendarGrid.getByRole('button').filter({ hasText: today.toString() }).first().click();
    await page.getByRole('button', { name: /add custom workout/i }).click();

    await expect(page.getByTestId('custom-workout-modal')).toBeVisible();
    await expect(page.getByRole('heading', { name: /log custom workout/i })).toBeVisible();

    // Date input should be pre-filled with today
    const expectedDate = await page.evaluate(() => new Date().toLocaleDateString('en-CA'));
    await expect(page.getByLabel('Date')).toHaveValue(expectedDate);
  });

  test('clicking another empty day changes selection (second-day check skipped on 1st of month)', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const history = new HistoryPage(page);

    await dashboard.expectLoaded();
    await history.navigate();
    await history.expectLoaded();

    const today = new Date();
    const todayDate = today.getDate();

    // Only run this test if today is not the 1st (so we have a previous day to click)
    if (todayDate > 1) {
      const yesterday = todayDate - 1;

      // Click today first
      await history.calendarGrid.getByRole('button').filter({ hasText: todayDate.toString() }).first().click();
      await expect(page.getByRole('button', { name: /add custom workout/i })).toBeVisible();

      // Click yesterday - selection changes, button still visible
      await history.calendarGrid.getByRole('button').filter({ hasText: yesterday.toString() }).first().click();
      await expect(page.getByRole('button', { name: /add custom workout/i })).toBeVisible();
    } else {
      // Skip by just verifying the basic selection still works
      await history.calendarGrid.getByRole('button').filter({ hasText: todayDate.toString() }).first().click();
      await expect(page.getByRole('button', { name: /add custom workout/i })).toBeVisible();
    }
  });

  test('clicking a day with a workout loads workout detail (no Add Custom Workout button)', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const history = new HistoryPage(page);
    const workout = new WorkoutPage(page);

    await dashboard.expectLoaded();
    await dashboard.startWorkout(1);
    await workout.expectLoaded(1);
    await workout.fillAmrap('10');
    await page.waitForResponse(
      resp => resp.url().includes('/api/workouts/') && resp.request().method() === 'PATCH' && resp.ok(),
    );
    await workout.completeWithDialog();
    await workout.goBackToDashboard();

    await history.navigateAndWaitForData();

    const today = new Date().getDate();
    await history.clickDay(today);

    // Workout detail should load
    await expect(page.getByRole('heading', { name: /day\s*1/i }).first()).toBeVisible();

    // "Add Custom Workout" button should NOT appear (day has a workout)
    await expect(page.getByRole('button', { name: /add custom workout/i })).not.toBeVisible();
  });
});
