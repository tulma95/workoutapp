import { test, expect } from './fixtures';
import { DashboardPage } from './pages/dashboard.page';
import { WorkoutPage } from './pages/workout.page';
import { SettingsPage } from './pages/settings.page';
import { NavigationBar } from './pages/navigation.page';

test.describe('Workout Session', () => {
  test('shows a collapsible warm-up ramp for heavy lifts (guidance only)', async ({
    setupCompletePage,
  }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const workout = new WorkoutPage(page);

    await dashboard.expectLoaded();
    await dashboard.startWorkout();
    await workout.expectLoaded(1);

    // Bench Press working weight is heavy enough to warrant a warm-up ramp.
    const summary = page.getByText(/warm-up/i).first();
    await expect(summary).toBeVisible();

    const list = page.getByTestId('warmup-list').first();
    await expect(list).toBeHidden(); // collapsed by default
    await summary.click();
    await expect(list).toBeVisible();
    await expect(list).toContainText('kg');
    await expect(page.getByText(/not tracked/i).first()).toBeVisible();
  });


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

  test('entering AMRAP reps using tap-to-confirm and +/- stepper works correctly', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const workout = new WorkoutPage(page);

    await dashboard.expectLoaded();
    await dashboard.startWorkout();
    await workout.expectLoaded(1);

    // Target the AMRAP set row specifically (has data-amrap attribute)
    const amrapRow = page.locator('[data-testid="set-row"][data-amrap]').first();
    await expect(amrapRow).toBeVisible();

    // Initially shows a confirm button (not yet filled)
    const confirmButton = amrapRow.getByRole('button', { name: /confirm reps/i });
    await expect(confirmButton).toBeVisible();

    // Tap to confirm prescribed reps
    await confirmButton.click();
    const repsDisplay = amrapRow.getByTestId('reps-value');
    const confirmedValue = parseInt(await repsDisplay.textContent() || '0', 10);
    expect(confirmedValue).toBeGreaterThan(0);

    // Use + to increment
    const plusButton = amrapRow.getByRole('button', { name: /increase reps/i });
    await plusButton.click();
    await plusButton.click();
    await plusButton.click();

    const valueAfterPlus = parseInt(await repsDisplay.textContent() || '0', 10);
    expect(valueAfterPlus).toBe(confirmedValue + 3);

    // Use - to decrement
    const minusButton = amrapRow.getByRole('button', { name: /decrease reps/i });
    await minusButton.click();

    const finalValue = parseInt(await repsDisplay.textContent() || '0', 10);
    expect(finalValue).toBe(valueAfterPlus - 1);
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

    const startLinks = page.getByRole('link', { name: /start workout/i });
    const initialCount = await startLinks.count();
    expect(initialCount).toBeGreaterThan(0);

    await startLinks.first().click();
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

    const firstRepsCount = await firstExerciseSection.getByTestId('reps-value').count();
    expect(firstRepsCount).toBe(9);

    const secondRepsCount = await secondExerciseSection.getByTestId('reps-value').count();
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

    const benchCardText = await page.locator('text=Bench Press').locator('..').textContent();
    const initialBenchTMMatch = benchCardText?.match(/(\d+(?:\.\d+)?)\s*kg/);
    expect(initialBenchTMMatch).toBeTruthy();
    const initialBenchTM = parseFloat(initialBenchTMMatch![1]);

    // Navigate back to dashboard and start Day 1 workout
    await nav.goToHome();
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

    const newBenchCardText = await page.locator('text=Bench Press').locator('..').textContent();
    const newBenchTMMatch = newBenchCardText?.match(/(\d+(?:\.\d+)?)\s*kg/);
    expect(newBenchTMMatch).toBeTruthy();
    const newBenchTM = parseFloat(newBenchTMMatch![1]);

    expect(newBenchTM).toBeGreaterThan(initialBenchTM);

    const expectedIncrease = 5;
    const actualIncrease = newBenchTM - initialBenchTM;
    expect(actualIncrease).toBeCloseTo(expectedIncrease, 0);
  });

  test('dashboard shows a weekly workout count after completing a workout', async ({
    setupCompletePage,
  }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const workout = new WorkoutPage(page);

    await dashboard.expectLoaded();
    // A fresh user has no completed workouts, so the stats + last-workout peek are hidden.
    await expect(page.getByTestId('dashboard-stats')).toBeHidden();
    await expect(page.getByTestId('recent-workout-peek')).toBeHidden();

    await dashboard.startWorkout();
    await workout.expectLoaded(1);
    await workout.fillAmrap('5');
    await page.waitForResponse(
      (r) => r.url().includes('/api/workouts/') && r.request().method() === 'PATCH' && r.ok(),
    );
    await workout.completeWithDialog();
    await workout.goBackToDashboard();

    await dashboard.expectLoaded();
    const stats = page.getByTestId('dashboard-stats');
    await expect(stats).toBeVisible();
    await expect(stats.getByText('this week')).toBeVisible();
    await expect(stats.getByText('1', { exact: true })).toBeVisible();

    // The last-workout peek now shows the just-completed session.
    const peek = page.getByTestId('recent-workout-peek');
    await expect(peek).toBeVisible();
    await expect(peek.getByText('Last workout')).toBeVisible();
    await expect(peek.getByText(/day\s*1/i)).toBeVisible();
  });

  test('shows a workout progress bar that advances as sets are logged', async ({
    setupCompletePage,
  }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const workout = new WorkoutPage(page);

    await dashboard.expectLoaded();
    await dashboard.startWorkout();
    await workout.expectLoaded(1);

    const progress = page.getByTestId('workout-progress');
    await expect(progress).toBeVisible();
    await expect(progress).toHaveAttribute('aria-valuenow', '0');
    const total = await progress.getAttribute('aria-valuemax');
    expect(Number(total)).toBeGreaterThan(0);

    await workout.fillAmrap('5');
    await page.waitForResponse(
      (r) => r.url().includes('/api/workouts/') && r.request().method() === 'PATCH' && r.ok(),
    );

    await expect(progress).toHaveAttribute('aria-valuenow', '1');
  });

  test('completion screen shows a workout summary (sets and volume)', async ({
    setupCompletePage,
  }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const workout = new WorkoutPage(page);

    await dashboard.expectLoaded();
    await dashboard.startWorkout();
    await workout.expectLoaded(1);

    await workout.fillAmrap('5');
    await page.waitForResponse(
      (r) => r.url().includes('/api/workouts/') && r.request().method() === 'PATCH' && r.ok(),
    );
    await workout.completeWithDialog();
    await workout.dismissAchievementDialogIfPresent();

    await expect(page.getByText('Workout Complete!')).toBeVisible();
    const summary = page.getByTestId('workout-summary');
    await expect(summary).toBeVisible();
    await expect(summary.getByText('Sets')).toBeVisible();
    await expect(summary.getByText('Volume')).toBeVisible();
    await expect(summary.getByText(/kg/)).toBeVisible();
  });

  test('tapping a set weight opens the plate calculator with the load per side', async ({
    setupCompletePage,
  }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const workout = new WorkoutPage(page);

    await dashboard.expectLoaded();
    await dashboard.startWorkout();
    await workout.expectLoaded(1);

    await page.getByTestId('set-weight').first().click();

    const dialog = page.getByRole('dialog', { name: /plate calculator/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/plates per side/i)).toBeVisible();
    await expect(dialog.getByTestId('plate-list')).toBeVisible();

    // Switching the bar weight recomputes the breakdown.
    await dialog.getByRole('button', { name: '15 kg' }).click();
    await expect(dialog.getByTestId('plate-list')).toBeVisible();

    await dialog.getByRole('button', { name: /^close$/i }).click();
    await expect(dialog).toBeHidden();
  });
});
