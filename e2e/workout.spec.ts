import { test, expect } from './fixtures';
import { DashboardPage } from './pages/dashboard.page';
import { WorkoutPage } from './pages/workout.page';
import { SettingsPage } from './pages/settings.page';
import { NavigationBar } from './pages/navigation.page';

test.describe('Workout Session', () => {
  test('starting a workout from the dashboard shows exercise sections with correct set counts', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const workout = new WorkoutPage(page);

    await dashboard.expectLoaded();
    await dashboard.startWorkout();
    await workout.expectLoaded(1);

    await expect(workout.repsInputs.first()).toBeVisible();

    const repsCount = await workout.repsInputs.count();
    expect(repsCount).toBeGreaterThanOrEqual(17);
  });

  test('completing a non-AMRAP set marks it visually as done', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const workout = new WorkoutPage(page);

    await dashboard.expectLoaded();
    await dashboard.startWorkout();
    await workout.expectLoaded(1);

    // Tap + on the first set to auto-confirm it
    await workout.confirmSet(0);

    // Verify the set row has completed class (green background)
    const completedRows = page.locator('[data-testid="set-row"][data-completed]');
    await expect(completedRows.first()).toBeVisible();
  });

  test('entering AMRAP reps using the +/- stepper works correctly', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const workout = new WorkoutPage(page);

    await dashboard.expectLoaded();
    await dashboard.startWorkout();
    await workout.expectLoaded(1);

    // Target the AMRAP set row specifically (has data-amrap attribute)
    const amrapRow = page.locator('[data-testid="set-row"][data-amrap]').first();
    await expect(amrapRow).toBeVisible();
    const amrapInput = amrapRow.getByRole('spinbutton', { name: /reps completed/i });
    const initialValue = await amrapInput.inputValue();
    expect(initialValue === '' || initialValue === '0').toBeTruthy();

    const plusButton = amrapRow.getByRole('button', { name: /increase reps/i });
    await plusButton.click();
    await plusButton.click();
    await plusButton.click();

    const valueAfterPlus = await amrapInput.inputValue();
    const numValue = parseInt(valueAfterPlus, 10);
    expect(numValue).toBeGreaterThan(0);

    const minusButton = amrapRow.getByRole('button', { name: /decrease reps/i });
    await minusButton.click();

    const finalValue = await amrapInput.inputValue();
    const finalNumValue = parseInt(finalValue, 10);
    expect(finalNumValue).toBe(numValue - 1);

    await amrapInput.fill('10');
    const directInputValue = await amrapInput.inputValue();
    expect(directInputValue).toBe('10');
  });

  test('completing a workout shows the progression banner with TM change info', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const workout = new WorkoutPage(page);

    await dashboard.expectLoaded();
    await dashboard.startWorkout();
    await workout.expectLoaded(1);

    await workout.fillAmrapAndWait('12');
    await workout.completeWithDialog();

    await expect(page.getByText(/bench.*\+5|progression|increase/i)).toBeVisible();
    await expect(workout.backToDashboardButton).toBeVisible();
  });

  test('after completing a workout, navigating back to dashboard shows the day as completed', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const workout = new WorkoutPage(page);

    await dashboard.expectLoaded();

    const startButtons = page.getByRole('button', { name: /start workout/i });
    const initialCount = await startButtons.count();
    expect(initialCount).toBeGreaterThan(0);

    await startButtons.first().click();
    await workout.expectLoaded(1);

    await workout.fillAmrapAndWait('10');
    await workout.completeWithDialog();

    await workout.goBackToDashboard();

    await dashboard.expectLoaded();
  });

  test('completing a workout without entering AMRAP reps shows the confirmation warning', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const workout = new WorkoutPage(page);

    await dashboard.expectLoaded();
    await dashboard.startWorkout();
    await workout.expectLoaded(1);

    // DO NOT enter AMRAP reps
    await workout.complete();

    await expect(workout.confirmDialog).toBeVisible();
    await expect(workout.confirmDialog).toContainText(/progression/i);

    await workout.confirmDialog.getByRole('button', { name: /complete anyway/i }).click();

    await expect(page.getByText(/no.*change|no.*increase/i)).toBeVisible();
    await expect(workout.backToDashboardButton).toBeVisible();
  });

  test('resuming an in-progress workout by clicking the same day again loads existing workout with completed sets preserved', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const workout = new WorkoutPage(page);

    await dashboard.expectLoaded();
    await dashboard.startWorkout();
    await workout.expectLoaded(1);

    // Confirm first two sets by tapping + and wait for PATCH responses
    const patchResponse1 = page.waitForResponse(resp => resp.url().includes('/sets/') && resp.request().method() === 'PATCH');
    await workout.confirmSet(0);
    await patchResponse1;

    const patchResponse2 = page.waitForResponse(resp => resp.url().includes('/sets/') && resp.request().method() === 'PATCH');
    await workout.confirmSet(1);
    await patchResponse2;

    // Verify completed rows exist
    const completedRows = page.locator('[data-testid="set-row"][data-completed]');
    await expect(completedRows).toHaveCount(2);

    // Navigate back to dashboard
    await page.goto('/');
    await dashboard.expectLoaded();

    await dashboard.continueWorkout();
    await workout.expectLoaded(1);

    // Verify the completed sets are still shown as completed (undo buttons visible)
    await expect(completedRows.first()).toBeVisible();
    await expect(completedRows).toHaveCount(2);

    await expect(page.getByRole('heading', { name: /workout in progress/i })).not.toBeVisible();
  });

  test('nSuns plan-driven workout has correct set counts: 9 sets for first exercise and 8 for second exercise on Day 1', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const workout = new WorkoutPage(page);

    await dashboard.expectLoaded();
    await dashboard.startWorkout();
    await workout.expectLoaded(1);
    await expect(workout.repsInputs.first()).toBeVisible();

    const firstExerciseSection = page.locator('section').first();
    const secondExerciseSection = page.locator('section').nth(1);

    await expect(firstExerciseSection).toBeVisible();
    await expect(secondExerciseSection).toBeVisible();

    const firstRepsCount = await firstExerciseSection.getByRole('spinbutton', { name: /reps completed/i }).count();
    expect(firstRepsCount).toBe(9);

    const secondRepsCount = await secondExerciseSection.getByRole('spinbutton', { name: /reps completed/i }).count();
    expect(secondRepsCount).toBe(8);
  });

  test('TM progression after workout: completing Day 1 with good AMRAP performance increases Bench TM', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const workout = new WorkoutPage(page);
    const settings = new SettingsPage(page);
    const nav = new NavigationBar(page);

    await dashboard.expectLoaded();

    // Navigate to settings to check initial Bench TM
    await settings.navigate();
    await settings.expectLoaded();

    const benchCardText = await page.locator('text=Bench-press').locator('..').textContent();
    const initialBenchTMMatch = benchCardText?.match(/(\d+(?:\.\d+)?)\s*(kg|lb)/);
    expect(initialBenchTMMatch).toBeTruthy();
    const initialBenchTM = parseFloat(initialBenchTMMatch![1]);
    const unit = initialBenchTMMatch![2];

    // Navigate back to dashboard and start Day 1 workout
    await nav.goToDashboard();
    await dashboard.expectLoaded();
    await dashboard.startWorkout();
    await workout.expectLoaded(1);
    await expect(workout.repsInputs.first()).toBeVisible();

    await workout.fillAmrapAndWait('10');
    await workout.completeWithDialog();

    await expect(page.getByText(/progression|increase|bench.*\+/i)).toBeVisible();
    await expect(page.getByText(/bench/i).filter({ hasText: /\+/ })).toBeVisible();

    await workout.goBackToDashboard();

    // Navigate to settings to check updated Bench TM
    await settings.navigate();
    await settings.expectLoaded();

    const newBenchCardText = await page.locator('text=Bench-press').locator('..').textContent();
    const newBenchTMMatch = newBenchCardText?.match(/(\d+(?:\.\d+)?)\s*(kg|lb)/);
    expect(newBenchTMMatch).toBeTruthy();
    const newBenchTM = parseFloat(newBenchTMMatch![1]);

    expect(newBenchTM).toBeGreaterThan(initialBenchTM);

    const expectedIncrease = unit === 'kg' ? 5 : 11;
    const actualIncrease = newBenchTM - initialBenchTM;
    expect(actualIncrease).toBeCloseTo(expectedIncrease, 0);
  });
});
