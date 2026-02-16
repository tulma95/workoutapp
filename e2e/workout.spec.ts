import { test, expect } from './fixtures';

test.describe('Workout Session', () => {
  test('starting a workout from the dashboard shows exercise sections with correct set counts', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    await expect(page.getByText('Workout Days')).toBeVisible();

    await page.getByRole('button', { name: /start workout/i }).first().click();
    await page.waitForURL(/\/workout\/1/);

    const firstCheckbox = page.getByRole('checkbox').first();
    await expect(firstCheckbox).toBeVisible({ timeout: 15000 });

    await expect(page.getByRole('heading', { name: /day 1/i })).toBeVisible();

    const checkboxCount = await page.getByRole('checkbox').count();
    expect(checkboxCount).toBeGreaterThanOrEqual(16);

    const amrapCount = await page.getByRole('spinbutton').count();
    expect(amrapCount).toBeGreaterThanOrEqual(1);
  });

  test('completing a non-AMRAP set marks it visually as done', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    await expect(page.getByText('Workout Days')).toBeVisible();

    await page.getByRole('button', { name: /start workout/i }).first().click();
    await page.waitForURL(/\/workout\/1/);
    await expect(page.getByRole('heading', { name: /day 1/i })).toBeVisible({ timeout: 15000 });

    const firstCheckbox = page.getByRole('checkbox').first();
    await expect(firstCheckbox).not.toBeChecked();

    await firstCheckbox.click();
    await expect(firstCheckbox).toBeChecked();
  });

  test('entering AMRAP reps using the +/- stepper works correctly', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    await expect(page.getByText('Workout Days')).toBeVisible();

    await page.getByRole('button', { name: /start workout/i }).first().click();
    await page.waitForURL(/\/workout\/1/);
    await expect(page.getByRole('heading', { name: /day 1/i })).toBeVisible({ timeout: 15000 });

    const amrapInput = page.getByRole('spinbutton').first();
    const initialValue = await amrapInput.inputValue();
    expect(initialValue === '' || initialValue === '0').toBeTruthy();

    const plusButton = page.getByRole('button', { name: /increase|increment|\+/i }).first();
    await plusButton.click();
    await plusButton.click();
    await plusButton.click();

    const valueAfterPlus = await amrapInput.inputValue();
    const numValue = parseInt(valueAfterPlus, 10);
    expect(numValue).toBeGreaterThan(0);

    const minusButton = page.getByRole('button', { name: /decrease|decrement|\-/i }).first();
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

    await expect(page.getByText('Workout Days')).toBeVisible();

    await page.getByRole('button', { name: /start workout/i }).first().click();
    await page.waitForURL(/\/workout\/1/);
    await expect(page.getByRole('heading', { name: /day 1/i })).toBeVisible({ timeout: 15000 });

    const amrapInput = page.getByRole('spinbutton').first();
    await amrapInput.fill('12');

    await page.getByRole('button', { name: /complete workout/i }).click();

    await expect(page.getByText(/bench.*\+5|progression|increase/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /back to dashboard|dashboard/i })).toBeVisible();
  });

  test('after completing a workout, navigating back to dashboard shows the day as completed', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    await expect(page.getByText('Workout Days')).toBeVisible();

    const startButtons = page.getByRole('button', { name: /start workout/i });
    const initialCount = await startButtons.count();
    expect(initialCount).toBeGreaterThan(0);

    await startButtons.first().click();
    await page.waitForURL(/\/workout\/1/);
    await expect(page.getByRole('heading', { name: /day 1/i })).toBeVisible({ timeout: 15000 });

    const amrapInput = page.getByRole('spinbutton').first();
    await amrapInput.fill('10');

    await page.getByRole('button', { name: /complete workout/i }).click();

    await expect(page.getByRole('button', { name: /back to dashboard|dashboard/i })).toBeVisible();
    await page.getByRole('button', { name: /back to dashboard|dashboard/i }).click();
    await page.waitForURL('/');

    await expect(page.getByText('Workout Days')).toBeVisible();
  });

  test('completing a workout without entering AMRAP reps shows the confirmation warning', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    await expect(page.getByText('Workout Days')).toBeVisible();

    await page.getByRole('button', { name: /start workout/i }).first().click();
    await page.waitForURL(/\/workout\/1/);
    await expect(page.getByRole('heading', { name: /day 1/i })).toBeVisible({ timeout: 15000 });

    // DO NOT enter AMRAP reps
    await page.getByRole('button', { name: /complete workout/i }).click();

    const dialog = page.locator('.confirm-dialog__content');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.confirm-dialog__message')).toContainText(/progression/i);

    await dialog.getByRole('button', { name: /complete anyway/i }).click();

    await expect(page.getByText(/no.*change|no.*increase/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /back to dashboard|dashboard/i })).toBeVisible();
  });

  test('resuming an in-progress workout by clicking the same day again loads existing workout with completed sets preserved', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    await expect(page.getByText('Workout Days')).toBeVisible();

    await page.getByRole('button', { name: /start workout/i }).first().click();
    await page.waitForURL(/\/workout\/1/);
    await expect(page.getByRole('heading', { name: /day 1/i })).toBeVisible({ timeout: 15000 });

    const firstCheckbox = page.getByRole('checkbox').nth(0);
    const secondCheckbox = page.getByRole('checkbox').nth(1);

    await firstCheckbox.click();
    await expect(firstCheckbox).toBeChecked();

    await secondCheckbox.click();
    await expect(secondCheckbox).toBeChecked();

    // Navigate back to dashboard
    await page.goto('/');
    await expect(page.getByText('Workout Days')).toBeVisible();

    await page.getByRole('button', { name: /continue workout|start workout/i }).first().click();
    await page.waitForURL(/\/workout\/1/);
    await expect(page.getByRole('heading', { name: /day 1/i })).toBeVisible({ timeout: 15000 });

    await expect(page.getByRole('checkbox').nth(0)).toBeChecked();
    await expect(page.getByRole('checkbox').nth(1)).toBeChecked();

    await expect(page.getByRole('heading', { name: /workout in progress/i })).not.toBeVisible();
  });

  test('nSuns plan-driven workout has correct set counts: 9 sets for first exercise and 8 for second exercise on Day 1', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    await expect(page.getByText('Workout Days')).toBeVisible();

    await page.getByRole('button', { name: /start workout/i }).first().click();
    await page.waitForURL(/\/workout\/1/);
    await expect(page.getByRole('heading', { name: /day 1/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('checkbox').first()).toBeVisible();

    const firstExerciseSection = page.locator('.workout-section').first();
    const secondExerciseSection = page.locator('.workout-section').nth(1);

    await expect(firstExerciseSection).toBeVisible();
    await expect(secondExerciseSection).toBeVisible();

    const firstExerciseCheckboxCount = await firstExerciseSection.getByRole('checkbox').count();
    const firstExerciseAmrapCount = await firstExerciseSection.getByRole('spinbutton').count();
    expect(firstExerciseCheckboxCount + firstExerciseAmrapCount).toBe(9);

    const secondExerciseCheckboxCount = await secondExerciseSection.getByRole('checkbox').count();
    expect(secondExerciseCheckboxCount).toBe(8);
  });

  test('TM progression after workout: completing Day 1 with good AMRAP performance increases Bench TM', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    await expect(page.getByText('Workout Days')).toBeVisible();

    // Navigate to settings to check initial Bench TM
    await page.getByRole('link', { name: /settings/i }).click();
    await page.waitForURL('/settings');
    await expect(page.getByText('Training Maxes')).toBeVisible();

    const benchCardText = await page.locator('text=Bench-press').locator('..').textContent();
    const initialBenchTMMatch = benchCardText?.match(/(\d+(?:\.\d+)?)\s*(kg|lb)/);
    expect(initialBenchTMMatch).toBeTruthy();
    const initialBenchTM = parseFloat(initialBenchTMMatch![1]);
    const unit = initialBenchTMMatch![2];

    // Navigate back to dashboard and start Day 1 workout
    await page.getByRole('link', { name: /dashboard/i }).click();
    await page.waitForURL('/');
    await expect(page.getByText('Workout Days')).toBeVisible();
    await page.getByRole('button', { name: /start workout/i }).first().click();
    await page.waitForURL(/\/workout\/1/);

    await expect(page.getByRole('heading', { name: /day 1/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('checkbox').first()).toBeVisible();

    const amrapInput = page.getByRole('spinbutton').first();
    await amrapInput.fill('10');

    await page.getByRole('button', { name: /complete workout/i }).click();

    await expect(page.getByText(/progression|increase|bench.*\+/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/bench/i).filter({ hasText: /\+/ })).toBeVisible();

    await page.getByRole('button', { name: /back to dashboard|dashboard/i }).click();
    await page.waitForURL('/');

    // Navigate to settings to check updated Bench TM
    await page.getByRole('link', { name: /settings/i }).click();
    await page.waitForURL('/settings');
    await expect(page.getByText('Training Maxes')).toBeVisible();

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
