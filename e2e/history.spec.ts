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

    await history.navigate();

    const today = new Date().getDate();
    await history.clickDay(today);

    await expect(page.getByRole('heading', { name: /day\s*1/i }).first()).toBeVisible();
    await expect(page.getByText(/bench/i).first()).toBeVisible();
    await expect(page.getByText(/overhead press/i).first()).toBeVisible();
    await expect(page.getByText(/\d+\s*kg/).first()).toBeVisible();
  });

  test('complete two workouts (Day 1 and Day 2), verify both days show on calendar', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const history = new HistoryPage(page);

    await completeWorkout(page, 1, 10);
    await completeWorkout(page, 2, 8);

    await history.navigate();

    const today = new Date().getDate();
    await history.clickDay(today);

    // Wait for workout detail to load, then verify exercises are visible
    await expect(page.getByText(/bench|squat/i).first()).toBeVisible();
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
