import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import { DashboardPage } from './pages/dashboard.page';
import { HistoryPage } from './pages/history.page';

async function openCustomWorkoutModal(page: Page, history: HistoryPage, dashboard: DashboardPage) {
  await dashboard.expectLoaded();
  await history.navigate();
  await history.expectLoaded();

  const today = new Date().getDate();
  await history.clickEmptyDay(today);
  await expect(page.getByTestId('custom-workout-modal')).toBeVisible();
  return today;
}

async function fillExercise(
  page: Page,
  exIdx: number,
  setIdx: number,
  exerciseLabel: string,
  weight: string,
  reps: string,
) {
  await page.locator(`#exercise-select-${exIdx}`).selectOption({ label: exerciseLabel });
  await page.locator(`#weight-${exIdx}-${setIdx}`).fill(weight);
  await page.locator(`#reps-${exIdx}-${setIdx}`).fill(reps);
}

async function saveCustomWorkout(page: Page) {
  const saveResponsePromise = page.waitForResponse(
    (resp) => resp.url().includes('/api/workouts/custom') && resp.ok(),
  );
  const calendarRefetchPromise = page.waitForResponse(
    (resp) => resp.url().includes('/api/workouts/calendar') && resp.ok(),
  );
  await page.getByRole('button', { name: /^save$/i }).click();
  await saveResponsePromise;
  await calendarRefetchPromise;
  await expect(page.getByTestId('custom-workout-modal')).not.toBeVisible();
}

test.describe('Custom Workout', () => {
  test('clicking an empty past calendar day opens the custom workout modal', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const history = new HistoryPage(page);
    const dashboard = new DashboardPage(page);

    await openCustomWorkoutModal(page, history, dashboard);

    await expect(page.getByRole('heading', { name: /log custom workout/i })).toBeVisible();
  });

  test('saving a custom workout makes it appear on the calendar', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const history = new HistoryPage(page);
    const dashboard = new DashboardPage(page);

    const today = await openCustomWorkoutModal(page, history, dashboard);

    await fillExercise(page, 0, 0, 'Bench Press', '100', '5');
    await saveCustomWorkout(page);

    // Clicking the same day now opens workout detail (not the modal)
    await history.clickDay(today);
    await expect(page.getByRole('heading', { name: /custom workout/i })).toBeVisible();
    await expect(page.getByTestId('custom-workout-modal')).not.toBeVisible();
  });

  test('workout detail shows "Custom Workout" heading not "Day 0"', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const history = new HistoryPage(page);
    const dashboard = new DashboardPage(page);

    const today = await openCustomWorkoutModal(page, history, dashboard);

    await fillExercise(page, 0, 0, 'Bench Press', '100', '5');
    await saveCustomWorkout(page);

    await history.clickDay(today);

    await expect(page.getByRole('heading', { name: /custom workout/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /day 0/i })).not.toBeVisible();
  });

  test('multiple sets per exercise saved correctly', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const history = new HistoryPage(page);
    const dashboard = new DashboardPage(page);

    const today = await openCustomWorkoutModal(page, history, dashboard);

    await page.locator('#exercise-select-0').selectOption({ label: 'Bench Press' });
    await page.locator('#weight-0-0').fill('100');
    await page.locator('#reps-0-0').fill('5');

    // Add second set
    await page.getByRole('button', { name: /\+ add set/i }).click();
    await page.locator('#weight-0-1').fill('80');
    await page.locator('#reps-0-1').fill('8');

    // Add third set
    await page.getByRole('button', { name: /\+ add set/i }).click();
    await page.locator('#weight-0-2').fill('60');
    await page.locator('#reps-0-2').fill('10');

    await saveCustomWorkout(page);

    await history.clickDay(today);

    await expect(page.getByRole('heading', { name: /custom workout/i })).toBeVisible();
    await expect(page.getByText('100 kg')).toBeVisible();
    await expect(page.getByText('80 kg')).toBeVisible();
    await expect(page.getByText('60 kg')).toBeVisible();
    await expect(page.getByText('3/3 sets')).toBeVisible();
  });

  test('multiple exercises saved correctly', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const history = new HistoryPage(page);
    const dashboard = new DashboardPage(page);

    const today = await openCustomWorkoutModal(page, history, dashboard);

    // First exercise
    await fillExercise(page, 0, 0, 'Bench Press', '100', '5');

    // Add second exercise
    await page.getByRole('button', { name: /\+ add exercise/i }).click();
    await fillExercise(page, 1, 0, 'Squat', '120', '5');

    await saveCustomWorkout(page);

    await history.clickDay(today);

    await expect(page.getByRole('heading', { name: /custom workout/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Bench Press', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Squat', exact: true })).toBeVisible();
    await expect(page.getByText('2/2 sets')).toBeVisible();
  });

  test('date input is pre-filled with the clicked calendar day date', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const history = new HistoryPage(page);
    const dashboard = new DashboardPage(page);

    await openCustomWorkoutModal(page, history, dashboard);

    const expectedDate = await page.evaluate(() => new Date().toLocaleDateString('en-CA'));
    const dateInput = page.getByLabel('Date');
    await expect(dateInput).toHaveValue(expectedDate);
  });

  test('calendar badge shows 1 (not 0) after saving a custom workout', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const history = new HistoryPage(page);
    const dashboard = new DashboardPage(page);

    const today = await openCustomWorkoutModal(page, history, dashboard);

    await fillExercise(page, 0, 0, 'Bench Press', '100', '5');
    await saveCustomWorkout(page);

    // Find the calendar day button for today and check its badge
    const todayButton = history.calendarGrid.getByRole('button').filter({ hasText: today.toString() }).first();
    const badge = todayButton.locator('span').filter({ hasText: /^1$/ });
    await expect(badge).toBeVisible();
  });

  test('entering a future date shows inline error message', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const history = new HistoryPage(page);
    const dashboard = new DashboardPage(page);

    await openCustomWorkoutModal(page, history, dashboard);

    // Type a future date by evaluating a date string one year from now
    const futureDate = await page.evaluate(() => {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 1);
      return d.toLocaleDateString('en-CA');
    });

    const dateInput = page.getByLabel('Date');
    await dateInput.fill(futureDate);

    await expect(page.getByText('Date cannot be in the future')).toBeVisible();
    // Save button should remain disabled
    await page.locator('#exercise-select-0').selectOption({ label: 'Bench Press' });
    await page.locator('#weight-0-0').fill('100');
    await page.locator('#reps-0-0').fill('5');
    await expect(page.getByRole('button', { name: /^save$/i })).toBeDisabled();
  });

  test('Save button is disabled without exercise selected or with empty sets', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const history = new HistoryPage(page);
    const dashboard = new DashboardPage(page);

    await openCustomWorkoutModal(page, history, dashboard);

    const saveButton = page.getByRole('button', { name: /^save$/i });

    // Initially: no exercise selected, empty sets -> Save is disabled
    await expect(saveButton).toBeDisabled();

    // Select exercise but leave weight/reps empty -> still disabled
    await page.locator('#exercise-select-0').selectOption({ label: 'Bench Press' });
    await expect(saveButton).toBeDisabled();

    // Fill weight only -> still disabled
    await page.locator('#weight-0-0').fill('100');
    await expect(saveButton).toBeDisabled();

    // Fill reps -> now enabled
    await page.locator('#reps-0-0').fill('5');
    await expect(saveButton).toBeEnabled();
  });
});
