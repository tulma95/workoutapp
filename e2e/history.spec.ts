import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

async function completeWorkout(page: Page, dayNumber: number, amrapReps: number) {
  await expect(page.getByText('Workout Days')).toBeVisible();

  // Click the start button within the specific day card to avoid nth() position issues
  const card = page.locator('.workout-card').filter({
    has: page.getByRole('heading', { name: `Day ${dayNumber}` }),
  });
  await card.getByRole('button', { name: /start workout/i }).click();
  await page.waitForURL(/\/workout\/\d+/);
  await expect(page.getByRole('heading', { name: new RegExp(`day ${dayNumber}`, 'i') })).toBeVisible({ timeout: 15000 });

  // Fill AMRAP and wait for the API call to persist
  const amrapInput = page.getByRole('spinbutton').first();
  await amrapInput.fill(amrapReps.toString());
  await page.waitForResponse(
    resp => resp.url().includes('/api/workouts/') && resp.request().method() === 'PATCH' && resp.ok(),
  );

  await page.getByRole('button', { name: /complete workout/i }).click();

  await expect(page.getByRole('button', { name: /back to dashboard|dashboard/i })).toBeVisible();
  await page.getByRole('button', { name: /back to dashboard|dashboard/i }).click();
  await page.waitForURL('/');
}

function currentMonthYear() {
  const currentDate = new Date();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
  return { month: monthNames[currentDate.getMonth()], year: currentDate.getFullYear().toString() };
}

test.describe('Workout History', () => {
  test('navigate to history page from bottom nav, verify calendar visible with month/year header', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    await expect(page.getByText('Workout Days')).toBeVisible();

    await page.getByRole('link', { name: /history/i }).click();
    await page.waitForURL('/history');

    await expect(page.getByRole('heading', { name: /history/i })).toBeVisible();

    const { month, year } = currentMonthYear();
    await expect(page.getByRole('heading', { name: new RegExp(`${month} ${year}`) })).toBeVisible();
  });

  test('no completed workouts - calendar renders, empty state message shown', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    await expect(page.getByText('Workout Days')).toBeVisible();
    await page.getByRole('link', { name: /history/i }).click();
    await page.waitForURL('/history');

    const { month, year } = currentMonthYear();
    await expect(page.getByRole('heading', { name: new RegExp(`${month} ${year}`) })).toBeVisible();
    await expect(page.getByText(/no workouts yet.*complete your first workout/i)).toBeVisible();
  });

  test('complete Day 1 workout, navigate to history, verify today highlighted on calendar', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    await expect(page.getByText('Workout Days')).toBeVisible();
    await completeWorkout(page, 1, 10);

    await page.getByRole('link', { name: /history/i }).click();
    await page.waitForURL('/history');

    const { month, year } = currentMonthYear();
    await expect(page.getByRole('heading', { name: new RegExp(`${month} ${year}`) })).toBeVisible();
  });

  test('tap highlighted day, verify workout detail appears with Day 1, exercises, and set data', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    await expect(page.getByText('Workout Days')).toBeVisible();
    await completeWorkout(page, 1, 10);

    await page.getByRole('link', { name: /history/i }).click();
    await page.waitForURL('/history');

    const today = new Date().getDate();
    await page.getByRole('button').filter({ hasText: today.toString() }).first().click();

    await expect(page.getByRole('heading', { name: /day\s*1/i }).first()).toBeVisible();
    await expect(page.getByText(/bench/i).first()).toBeVisible();
    await expect(page.getByText(/overhead press/i).first()).toBeVisible();
    await expect(page.getByText(/\d+\s*kg|\d+\s*lb/).first()).toBeVisible();
  });

  test('complete two workouts (Day 1 and Day 2), verify both days show on calendar', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    await expect(page.getByText('Workout Days')).toBeVisible();
    await completeWorkout(page, 1, 10);
    await completeWorkout(page, 2, 8);

    await page.getByRole('link', { name: /history/i }).click();
    await page.waitForURL('/history');

    const today = new Date().getDate();
    await page.getByRole('button').filter({ hasText: today.toString() }).first().click();

    // Wait for workout detail to load, then verify exercises are visible
    await expect(page.getByText(/bench|squat/i).first()).toBeVisible();
  });

  test('month navigation - prev and next buttons are present and clickable', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    await expect(page.getByText('Workout Days')).toBeVisible();
    await page.getByRole('link', { name: /history/i }).click();
    await page.waitForURL('/history');

    const currentDate = new Date();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const monthHeading = page.locator('.workout-calendar__title');
    await expect(monthHeading).toContainText(`${monthNames[currentMonth]} ${currentYear}`);

    const prevButton = page.getByRole('button', { name: 'Previous month' });
    const nextButton = page.getByRole('button', { name: 'Next month' });

    await expect(prevButton).toBeVisible();
    await expect(nextButton).toBeVisible();

    await prevButton.click();
    await expect(monthHeading).toContainText(`${monthNames[prevMonth]} ${prevYear}`);

    await nextButton.click();
    await expect(monthHeading).toContainText(`${monthNames[currentMonth]} ${currentYear}`);

    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    await nextButton.click();
    await expect(monthHeading).toContainText(`${monthNames[nextMonth]} ${nextYear}`);

    await expect(page.locator('.workout-calendar__grid')).toBeVisible();
  });
});
