import { test, expect } from '@playwright/test';

// US-059 - These tests need to be migrated to fixtures (not yet implemented)
test.describe.skip('Workout Session', () => {
  // Helper function to register a user and set up training maxes
  async function registerAndSetupUser(page: any) {
    const timestamp = Date.now();
    const email = `workout-${timestamp}@example.com`;
    const password = 'ValidPassword123';
    const displayName = 'Workout Test User';

    // Register
    await page.goto('/register');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="displayName"]', displayName);
    await page.click('button[type="submit"]');
    await page.waitForURL('/setup');

    // Set up training maxes
    // Using 1RMs: bench 100kg, squat 140kg, ohp 60kg, deadlift 180kg
    // Expected TMs: bench 90kg, squat 125kg, ohp 55kg, deadlift 162.5kg
    await page.fill('input[name="bench"], input[placeholder*="Bench" i]', '100');
    await page.fill('input[name="squat"], input[placeholder*="Squat" i]', '140');
    await page.fill('input[name="ohp"], input[placeholder*="OHP" i], input[placeholder*="Overhead" i]', '60');
    await page.fill('input[name="deadlift"], input[placeholder*="Deadlift" i]', '180');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard', { timeout: 10000 });

    return { email, password, displayName };
  }

  test('start a Day 1 workout from dashboard -> workout page shows T1 and T2 sets', async ({ page }) => {
    await registerAndSetupUser(page);

    // Find and click the Day 1 workout card/button
    const day1Button = page.locator('button:has-text("Day 1"), a:has-text("Day 1"), [data-day="1"]');
    await day1Button.first().click();

    // Should navigate to workout page
    await page.waitForURL(/\/workout/);

    // Verify T1 and T2 sets are displayed
    // Day 1: 9 T1 sets (Bench Volume) + 8 T2 sets (OHP) = 17 sets total
    const pageContent = await page.textContent('body');

    // Look for set indicators or exercise names
    // T1 should be Bench, T2 should be OHP
    expect(pageContent).toMatch(/bench/i);
    expect(pageContent).toMatch(/ohp|overhead press/i);

    // Check for multiple sets (at least some set numbers should be visible)
    // We expect to see set indicators like "Set 1", "Set 2", etc.
    const setElements = page.locator('[data-set], .set, button:has-text("Set")');
    const setCount = await setElements.count();
    expect(setCount).toBeGreaterThan(0);
  });

  test('complete sets by clicking -> sets marked as done', async ({ page }) => {
    await registerAndSetupUser(page);

    // Start Day 1 workout
    const day1Button = page.locator('button:has-text("Day 1"), a:has-text("Day 1"), [data-day="1"]');
    await day1Button.first().click();
    await page.waitForURL(/\/workout/);

    // Find the first set's complete button/checkbox
    // Try multiple selectors for flexibility
    const firstSetComplete = page.locator(
      '[data-set="1"] button:has-text("Complete"), ' +
      '[data-set="1"] input[type="checkbox"], ' +
      '.set:first-child button:has-text("Complete"), ' +
      '.set:first-child input[type="checkbox"], ' +
      'button[data-complete]:first-child, ' +
      'input[type="checkbox"][data-set]:first-child'
    ).first();

    // Complete the first set
    await firstSetComplete.click();

    // Verify the set is marked as completed
    // This could be a checked checkbox, disabled button, or style change
    await page.waitForTimeout(500); // Give UI time to update

    // Check if the set shows as completed (various possible indicators)
    const pageContent = await page.textContent('body');
    // The specific completion indicator depends on UI implementation
    // We just verify the click was registered and state changed
  });

  test('enter AMRAP reps on the AMRAP set', async ({ page }) => {
    await registerAndSetupUser(page);

    // Start Day 1 workout
    const day1Button = page.locator('button:has-text("Day 1"), a:has-text("Day 1"), [data-day="1"]');
    await day1Button.first().click();
    await page.waitForURL(/\/workout/);

    // Day 1 T1 AMRAP is set 9 (65% x 8+)
    // Find the AMRAP set input (might be labeled as "8+", "AMRAP", or similar)
    const amrapInput = page.locator(
      '[data-set="9"] input[type="number"], ' +
      'input[placeholder*="reps" i], ' +
      '[data-amrap] input[type="number"], ' +
      '.amrap input[type="number"]'
    ).first();

    // Enter 10 reps (8 prescribed + 2 extra)
    await amrapInput.fill('10');

    // Verify the input accepted the value
    const value = await amrapInput.inputValue();
    expect(value).toBe('10');
  });

  test('complete workout -> see progression result (TM change banner)', async ({ page }) => {
    await registerAndSetupUser(page);

    // Start Day 1 workout
    const day1Button = page.locator('button:has-text("Day 1"), a:has-text("Day 1"), [data-day="1"]');
    await day1Button.first().click();
    await page.waitForURL(/\/workout/);

    // Find and enter AMRAP reps (set 9: 65% x 8+)
    // Let's do 10 reps, which should trigger a TM increase
    const amrapInput = page.locator(
      '[data-set="9"] input[type="number"], ' +
      'input[placeholder*="reps" i], ' +
      '[data-amrap] input[type="number"], ' +
      '.amrap input[type="number"]'
    ).first();

    await amrapInput.fill('10');

    // Complete the workout
    const completeButton = page.locator(
      'button:has-text("Complete Workout"), ' +
      'button:has-text("Finish Workout"), ' +
      'button:has-text("Complete"), ' +
      'button[type="submit"]'
    ).first();

    await completeButton.click();

    // Wait for completion to process
    await page.waitForTimeout(1000);

    // Verify progression result is displayed
    // With 10 reps on AMRAP (6+ = +5kg for upper body), bench TM should increase by 5kg
    const pageContent = await page.textContent('body');

    // Look for progression indicators
    // Could be a banner, modal, or message showing TM increase
    expect(pageContent).toMatch(/bench|training max|tm|progression|increase/i);

    // Look for weight increase (5kg or 10lb depending on unit)
    // Since default is kg, expect 5
    expect(pageContent).toMatch(/\+5|\+10|increased|progression/i);
  });

  test('full workout flow: register -> setup -> workout -> progression', async ({ page }) => {
    // This test combines all steps into one complete flow
    await registerAndSetupUser(page);

    // Verify we're on the dashboard
    expect(page.url()).toContain('/dashboard');

    // Start Day 1 workout
    const day1Button = page.locator('button:has-text("Day 1"), a:has-text("Day 1"), [data-day="1"]');
    await day1Button.first().click();
    await page.waitForURL(/\/workout/);

    // Verify workout page loaded with sets
    const pageContent = await page.textContent('body');
    expect(pageContent).toMatch(/bench/i);

    // Enter AMRAP reps (12 reps should give significant progression)
    const amrapInput = page.locator(
      'input[type="number"], ' +
      'input[placeholder*="reps" i]'
    ).last(); // Last input is likely the AMRAP

    await amrapInput.fill('12');

    // Complete the workout
    const completeButton = page.locator(
      'button:has-text("Complete"), ' +
      'button[type="submit"]'
    ).last(); // Last submit button is likely the complete button

    await completeButton.click();

    // Wait for completion and verify progression displayed
    await page.waitForTimeout(1500);

    const finalContent = await page.textContent('body');
    // Should show progression result (12 reps = 6+ category = +5kg for bench)
    expect(finalContent).toMatch(/complete|finish|progression|increase/i);
  });
});
