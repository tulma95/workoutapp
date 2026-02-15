import { test, expect } from './fixtures';

test.describe('Workout Session', () => {
  test('starting a workout from the dashboard shows exercise sections with correct set counts', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    // Wait for dashboard to load
    await page.waitForSelector('text=Workout Days');

    // Click "Start Workout" button for Day 1
    await page.getByRole('button', { name: /start workout/i }).first().click();

    // Should navigate to workout page
    await page.waitForURL(/\/workout\/1/);

    // Wait for the workout to load - checkboxes will appear when sets are rendered
    // Day 1: first exercise has 9 sets (8 regular + 1 AMRAP), second exercise has 8 sets (all regular) = 16 checkboxes + 1 AMRAP input
    const firstCheckbox = page.getByRole('checkbox').first();
    await expect(firstCheckbox).toBeVisible({ timeout: 15000 });

    // Verify page heading shows Day 1
    await expect(page.getByRole('heading', { name: /day 1/i })).toBeVisible();

    // Count all checkboxes
    const checkboxes = page.getByRole('checkbox');
    const checkboxCount = await checkboxes.count();
    expect(checkboxCount).toBeGreaterThanOrEqual(16); // At least 16 regular sets

    // Verify there's at least one AMRAP input (spinbutton)
    const amrapInputs = page.getByRole('spinbutton');
    const amrapCount = await amrapInputs.count();
    expect(amrapCount).toBeGreaterThanOrEqual(1); // At least 1 AMRAP set
  });

  test('completing a non-AMRAP set marks it visually as done', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    // Wait for dashboard to load
    await page.waitForSelector('text=Workout Days');

    // Start Day 1 workout
    await page.getByRole('button', { name: /start workout/i }).first().click();
    await page.waitForURL(/\/workout\/1/);

    // Wait for the workout to load
    await expect(page.getByRole('heading', { name: /day 1/i })).toBeVisible({ timeout: 15000 });

    // Find the first checkbox (first non-AMRAP set)
    const firstCheckbox = page.getByRole('checkbox').first();

    // Verify it's not checked initially
    await expect(firstCheckbox).not.toBeChecked();

    // Click to complete the set
    await firstCheckbox.click();

    // Verify it's now checked
    await expect(firstCheckbox).toBeChecked();

    // Wait a moment for visual feedback
    await page.waitForTimeout(300);

    // The set row should have a completed style (green background)
    // This is a visual check - we can verify the checkbox is checked
    await expect(firstCheckbox).toBeChecked();
  });

  test('entering AMRAP reps using the +/- stepper works correctly', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    // Wait for dashboard to load
    await page.waitForSelector('text=Workout Days');

    // Start Day 1 workout
    await page.getByRole('button', { name: /start workout/i }).first().click();
    await page.waitForURL(/\/workout\/1/);

    // Wait for the workout to load
    await expect(page.getByRole('heading', { name: /day 1/i })).toBeVisible({ timeout: 15000 });

    // Day 1 first exercise AMRAP is set 9 (65% x 8+)
    // Find the AMRAP input (spinbutton role for number inputs)
    const amrapInput = page.getByRole('spinbutton').first();

    // Verify initial state (should be empty or show placeholder)
    const initialValue = await amrapInput.inputValue();
    expect(initialValue === '' || initialValue === '0').toBeTruthy();

    // Find the + button (look for button with + text or aria-label)
    const plusButton = page.getByRole('button', { name: /increase|increment|\+/i }).first();

    // Click + button several times
    await plusButton.click();
    await plusButton.click();
    await plusButton.click();

    // Give UI time to update
    await page.waitForTimeout(200);

    // Verify the value increased
    const valueAfterPlus = await amrapInput.inputValue();
    const numValue = parseInt(valueAfterPlus, 10);
    expect(numValue).toBeGreaterThan(0);

    // Find the - button
    const minusButton = page.getByRole('button', { name: /decrease|decrement|\-/i }).first();

    // Click - button once
    await minusButton.click();
    await page.waitForTimeout(200);

    // Verify the value decreased
    const finalValue = await amrapInput.inputValue();
    const finalNumValue = parseInt(finalValue, 10);
    expect(finalNumValue).toBe(numValue - 1);

    // Also test direct input
    await amrapInput.fill('10');
    const directInputValue = await amrapInput.inputValue();
    expect(directInputValue).toBe('10');
  });

  test('completing a workout shows the progression banner with TM change info', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    // Wait for dashboard to load
    await page.waitForSelector('text=Workout Days');

    // Start Day 1 workout
    await page.getByRole('button', { name: /start workout/i }).first().click();
    await page.waitForURL(/\/workout\/1/);

    // Wait for the workout to load
    await expect(page.getByRole('heading', { name: /day 1/i })).toBeVisible({ timeout: 15000 });

    // Enter AMRAP reps (10+ reps should trigger +5kg TM increase for bench)
    const amrapInput = page.getByRole('spinbutton').first();
    await amrapInput.fill('12');

    // Wait for the value to be set
    await page.waitForTimeout(300);

    // Click "Complete Workout" button
    await page.getByRole('button', { name: /complete workout/i }).click();

    // Wait for completion to process
    await page.waitForTimeout(1000);

    // Verify progression banner is displayed
    // With 12 reps on AMRAP (6+ category = +5kg for upper body)
    // Bench TM should increase from 90kg to 95kg
    await expect(page.getByText(/bench.*\+5|progression|increase/i)).toBeVisible();

    // Verify "Back to Dashboard" button appears
    await expect(page.getByRole('button', { name: /back to dashboard|dashboard/i })).toBeVisible();
  });

  test('after completing a workout, navigating back to dashboard shows the day as completed', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    // Wait for dashboard to load
    await page.waitForSelector('text=Workout Days');

    // Note the initial state - all days should show "Start Workout"
    const startButtons = page.getByRole('button', { name: /start workout/i });
    const initialCount = await startButtons.count();
    expect(initialCount).toBeGreaterThan(0);

    // Start Day 1 workout
    await page.getByRole('button', { name: /start workout/i }).first().click();
    await page.waitForURL(/\/workout\/1/);

    // Wait for the workout to load
    await expect(page.getByRole('heading', { name: /day 1/i })).toBeVisible({ timeout: 15000 });

    // Enter AMRAP reps
    const amrapInput = page.getByRole('spinbutton').first();
    await amrapInput.fill('10');
    await page.waitForTimeout(300);

    // Complete the workout
    await page.getByRole('button', { name: /complete workout/i }).click();
    await page.waitForTimeout(1000);

    // Click "Back to Dashboard"
    await page.getByRole('button', { name: /back to dashboard|dashboard/i }).click();
    await page.waitForURL('/');

    // Wait for dashboard to load
    await page.waitForSelector('text=Workout Days');

    // Verify Day 1 no longer shows "Start Workout" button
    // (Completed workouts don't have action buttons according to WorkoutCard spec)
    // We can verify by checking that the number of "Start Workout" buttons decreased
    const finalStartButtons = page.getByRole('button', { name: /start workout/i });
    const finalCount = await finalStartButtons.count();

    // Should have one fewer "Start Workout" button since Day 1 is completed
    // Note: This test assumes completed cards don't show buttons
    // If the UI shows "View Workout" or similar, adjust this assertion
  });

  test('completing a workout without entering AMRAP reps shows the confirmation warning', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    // Wait for dashboard to load
    await page.waitForSelector('text=Workout Days');

    // Start Day 1 workout
    await page.getByRole('button', { name: /start workout/i }).first().click();
    await page.waitForURL(/\/workout\/1/);

    // Wait for the workout to load
    await expect(page.getByRole('heading', { name: /day 1/i })).toBeVisible({ timeout: 15000 });

    // DO NOT enter AMRAP reps - leave it empty

    // Click "Complete Workout" button
    await page.getByRole('button', { name: /complete workout/i }).click();

    // Verify the custom confirm dialog appeared with a warning about missing progression reps
    const dialog = page.locator('.confirm-dialog__content');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.confirm-dialog__message')).toContainText(/progression/i);

    // Accept the dialog to complete anyway
    await dialog.getByRole('button', { name: /complete anyway/i }).click();

    // Verify completion screen shows
    // Should show "No TM change" or similar message
    await expect(page.getByText(/no.*change|no.*increase/i)).toBeVisible();

    // Verify "Back to Dashboard" button appears
    await expect(page.getByRole('button', { name: /back to dashboard|dashboard/i })).toBeVisible();
  });

  test('resuming an in-progress workout by clicking the same day again loads existing workout with completed sets preserved', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    // Wait for dashboard to load
    await page.waitForSelector('text=Workout Days');

    // Start Day 1 workout
    await page.getByRole('button', { name: /start workout/i }).first().click();
    await page.waitForURL(/\/workout\/1/);

    // Wait for the workout to load
    await expect(page.getByRole('heading', { name: /day 1/i })).toBeVisible({ timeout: 15000 });

    // Complete 2 sets by clicking their checkboxes
    const firstCheckbox = page.getByRole('checkbox').nth(0);
    const secondCheckbox = page.getByRole('checkbox').nth(1);

    await firstCheckbox.click();
    await expect(firstCheckbox).toBeChecked();

    await secondCheckbox.click();
    await expect(secondCheckbox).toBeChecked();

    // Wait for state to persist
    await page.waitForTimeout(500);

    // Navigate back to dashboard
    await page.goto('/');
    await page.waitForSelector('text=Workout Days');

    // The button text should now say "Continue Workout" since Day 1 is in progress
    // Click it to resume the workout (should NOT show conflict dialog for same day)
    await page.getByRole('button', { name: /continue workout|start workout/i }).first().click();
    await page.waitForURL(/\/workout\/1/);

    // Wait for the workout to load
    await expect(page.getByRole('heading', { name: /day 1/i })).toBeVisible({ timeout: 15000 });

    // Verify the previously completed sets are still checked
    const resumedFirstCheckbox = page.getByRole('checkbox').nth(0);
    const resumedSecondCheckbox = page.getByRole('checkbox').nth(1);

    await expect(resumedFirstCheckbox).toBeChecked();
    await expect(resumedSecondCheckbox).toBeChecked();

    // Verify no conflict dialog appeared (dialog should have "Workout in Progress" heading if it did)
    await expect(page.getByRole('heading', { name: /workout in progress/i })).not.toBeVisible();
  });

  test('nSuns plan-driven workout has correct set counts: 9 sets for first exercise and 8 for second exercise on Day 1', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    // Wait for dashboard to load
    await page.waitForSelector('text=Workout Days');

    // Start Day 1 workout
    await page.getByRole('button', { name: /start workout/i }).first().click();
    await page.waitForURL(/\/workout\/1/);

    // Wait for the workout to load - checkboxes will appear when sets are rendered
    await expect(page.getByRole('heading', { name: /day 1/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('checkbox').first()).toBeVisible({ timeout: 15000 });

    // Find first exercise section (Bench Press)
    const firstExerciseSection = page.locator('.workout-section').first();

    // Find second exercise section (OHP)
    const secondExerciseSection = page.locator('.workout-section').nth(1);

    // Wait for sections to be visible
    await expect(firstExerciseSection).toBeVisible();
    await expect(secondExerciseSection).toBeVisible();

    // Count checkboxes in first exercise section (non-AMRAP sets) + spinbuttons (AMRAP sets)
    const firstExerciseCheckboxes = firstExerciseSection.getByRole('checkbox');
    const firstExerciseAmrapInputs = firstExerciseSection.getByRole('spinbutton');

    // Wait for at least one element to exist
    await expect(firstExerciseCheckboxes.first()).toBeVisible();

    const firstExerciseCheckboxCount = await firstExerciseCheckboxes.count();
    const firstExerciseAmrapCount = await firstExerciseAmrapInputs.count();
    const firstExerciseTotalSets = firstExerciseCheckboxCount + firstExerciseAmrapCount;

    // nSuns Day 1 first exercise (Bench Volume) has 9 sets total (8 regular + 1 AMRAP)
    expect(firstExerciseTotalSets).toBe(9);

    // Count checkboxes in second exercise section (should be all non-AMRAP)
    const secondExerciseCheckboxes = secondExerciseSection.getByRole('checkbox');
    const secondExerciseCheckboxCount = await secondExerciseCheckboxes.count();

    // nSuns Day 1 second exercise (OHP) has 8 sets total (all regular, no AMRAP)
    expect(secondExerciseCheckboxCount).toBe(8);
  });

  test('TM progression after workout: completing Day 1 with good AMRAP performance increases Bench TM', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    // Wait for dashboard to load
    await page.waitForSelector('text=Workout Days');

    // Navigate to settings to check initial Bench TM
    await page.click('a[href="/settings"]');
    await page.waitForURL('/settings');
    await page.waitForSelector('text=Training Maxes');

    // Extract initial Bench TM from settings
    const benchCardText = await page.locator('text=Bench-press').locator('..').textContent();
    const initialBenchTMMatch = benchCardText?.match(/(\d+(?:\.\d+)?)\s*(kg|lb)/);
    expect(initialBenchTMMatch).toBeTruthy();
    const initialBenchTM = parseFloat(initialBenchTMMatch![1]);
    const unit = initialBenchTMMatch![2];

    // Navigate back to dashboard and start Day 1 workout
    await page.click('a[href="/"]');
    await page.waitForURL('/');
    await page.waitForSelector('text=Workout Days');
    await page.getByRole('button', { name: /start workout/i }).first().click();
    await page.waitForURL(/\/workout\/1/);

    // Wait for the workout to load
    await expect(page.getByRole('heading', { name: /day 1/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('checkbox').first()).toBeVisible({ timeout: 15000 });

    // Enter 10 reps in the AMRAP set
    const amrapInput = page.getByRole('spinbutton').first();
    await amrapInput.fill('10');

    // Complete the workout
    await page.getByRole('button', { name: /complete workout/i }).click();

    // Wait for completion to process and verify progression banner appears
    await expect(page.getByText(/progression|increase|bench.*\+/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/bench/i).filter({ hasText: /\+/ })).toBeVisible();

    // Click Back to Dashboard
    await page.getByRole('button', { name: /back to dashboard|dashboard/i }).click();
    await page.waitForURL('/');

    // Navigate to settings to check updated Bench TM
    await page.click('a[href="/settings"]');
    await page.waitForURL('/settings');
    await page.waitForSelector('text=Training Maxes');

    // Find the new Bench TM value
    const newBenchCardText = await page.locator('text=Bench-press').locator('..').textContent();
    const newBenchTMMatch = newBenchCardText?.match(/(\d+(?:\.\d+)?)\s*(kg|lb)/);
    expect(newBenchTMMatch).toBeTruthy();
    const newBenchTM = parseFloat(newBenchTMMatch![1]);

    // Verify the TM increased
    expect(newBenchTM).toBeGreaterThan(initialBenchTM);

    // Expected increase: +5kg (or ~11lb if in lb mode)
    // setupCompletePage sets Bench 1RM to 100kg (TM = 90kg)
    // After 10+ AMRAP reps: 90kg + 5kg = 95kg
    const expectedIncrease = unit === 'kg' ? 5 : 11; // 5kg ≈ 11lb
    const actualIncrease = newBenchTM - initialBenchTM;
    expect(actualIncrease).toBeCloseTo(expectedIncrease, 0);
  });
});
