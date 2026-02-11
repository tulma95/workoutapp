import { test, expect } from '@playwright/test';

// Epic 11 - History page not yet implemented, skipping tests
test.describe.skip('Workout History', () => {
  // Helper function to register a user and set up training maxes
  async function registerAndSetupUser(page: any) {
    const timestamp = Date.now();
    const email = `history-${timestamp}@example.com`;
    const password = 'ValidPassword123';
    const displayName = 'History Test User';

    // Register
    await page.goto('/register');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.fill('#displayName', displayName);
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
    await page.waitForURL('/', { timeout: 10000 });

    return { email, password, displayName };
  }

  // Helper function to complete a Day 1 workout
  async function completeDay1Workout(page: any) {
    // Start Day 1 workout
    const day1Button = page.locator('button:has-text("Day 1"), a:has-text("Day 1"), [data-day="1"]');
    await day1Button.first().click();
    await page.waitForURL(/\/workout/);

    // Enter AMRAP reps (10 reps on Day 1's set 9: 65% x 8+)
    const amrapInput = page.locator(
      'input[type="number"], ' +
      'input[placeholder*="reps" i]'
    ).last();

    await amrapInput.fill('10');

    // Complete the workout
    const completeButton = page.locator(
      'button:has-text("Complete Workout"), ' +
      'button:has-text("Finish Workout"), ' +
      'button:has-text("Complete"), ' +
      'button[type="submit"]'
    ).last();

    await completeButton.click();

    // Wait for completion to process
    await page.waitForTimeout(1500);
  }

  test('after completing a workout, navigate to history page -> see the completed workout', async ({ page }) => {
    // Set up user and complete a workout
    await registerAndSetupUser(page);
    await completeDay1Workout(page);

    // Navigate to history page
    // Try multiple navigation patterns
    const historyLink = page.locator(
      'a[href="/history"], ' +
      'a:has-text("History"), ' +
      'button:has-text("History"), ' +
      '[data-nav="history"]'
    ).first();

    await historyLink.click();
    await page.waitForURL('/history', { timeout: 10000 });

    // Verify we're on the history page
    expect(page.url()).toContain('/history');

    // Verify the completed workout appears
    const pageContent = await page.textContent('body');

    // Should show Day 1 workout
    expect(pageContent).toMatch(/day\s*1|day\s*one/i);

    // Should show completion status
    expect(pageContent).toMatch(/complete|completed|finish|finished/i);
  });

  test('workout entry shows day number, date, and completion status', async ({ page }) => {
    // Set up user and complete a workout
    await registerAndSetupUser(page);
    await completeDay1Workout(page);

    // Navigate to history page
    const historyLink = page.locator(
      'a[href="/history"], ' +
      'a:has-text("History"), ' +
      'button:has-text("History")'
    ).first();

    await historyLink.click();
    await page.waitForURL('/history', { timeout: 10000 });

    const pageContent = await page.textContent('body');

    // Verify day number is displayed
    expect(pageContent).toMatch(/day\s*1/i);

    // Verify date is displayed (should show today's date in some format)
    // Look for common date patterns: "Feb", "2026", month/day numbers
    const today = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = monthNames[today.getMonth()];
    const currentYear = today.getFullYear().toString();

    // Date should contain either the month name, year, or a slash-separated date
    const hasDateInfo =
      pageContent.includes(currentMonth) ||
      pageContent.includes(currentYear) ||
      pageContent.match(/\d{1,2}\/\d{1,2}/); // MM/DD or M/D format

    expect(hasDateInfo).toBeTruthy();

    // Verify completion status is displayed
    expect(pageContent).toMatch(/complete|completed|status/i);
  });

  test('history page is accessible from dashboard', async ({ page }) => {
    // Set up user (no need to complete workout for this test)
    await registerAndSetupUser(page);

    // Should be on dashboard
    expect(page.url()).toContain('/');

    // Find and click history navigation
    const historyLink = page.locator(
      'a[href="/history"], ' +
      'a:has-text("History"), ' +
      'button:has-text("History")'
    ).first();

    await historyLink.click();
    await page.waitForURL('/history', { timeout: 10000 });

    // Verify we're on the history page
    expect(page.url()).toContain('/history');

    // Page should show some content (even if empty)
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
    expect(pageContent.length).toBeGreaterThan(0);
  });

  test('history shows empty state when no workouts completed', async ({ page }) => {
    // Set up user but don't complete any workouts
    await registerAndSetupUser(page);

    // Navigate to history page
    const historyLink = page.locator(
      'a[href="/history"], ' +
      'a:has-text("History"), ' +
      'button:has-text("History")'
    ).first();

    await historyLink.click();
    await page.waitForURL('/history', { timeout: 10000 });

    const pageContent = await page.textContent('body');

    // Should show some indication of no workouts
    // Could be "No workouts", "Empty", "No history", etc.
    expect(pageContent).toMatch(/no.*workout|empty|no.*history|nothing.*here/i);
  });

  test('multiple completed workouts appear in history', async ({ page }) => {
    // Set up user
    await registerAndSetupUser(page);

    // Complete Day 1 workout
    await completeDay1Workout(page);

    // Navigate back to dashboard
    const dashboardLink = page.locator(
      'a[href="/"], ' +
      'a:has-text("Dashboard"), ' +
      'button:has-text("Dashboard")'
    ).first();

    await dashboardLink.click();
    await page.waitForURL('/', { timeout: 10000 });

    // Start and complete Day 2 workout
    const day2Button = page.locator('button:has-text("Day 2"), a:has-text("Day 2"), [data-day="2"]');
    await day2Button.first().click();
    await page.waitForURL(/\/workout/);

    // Enter AMRAP reps (Day 2's progression AMRAP is set 3: 95% x 1+)
    const amrapInput = page.locator(
      'input[type="number"], ' +
      'input[placeholder*="reps" i]'
    ).last();

    await amrapInput.fill('3');

    // Complete the workout
    const completeButton = page.locator(
      'button:has-text("Complete Workout"), ' +
      'button:has-text("Finish Workout"), ' +
      'button:has-text("Complete"), ' +
      'button[type="submit"]'
    ).last();

    await completeButton.click();
    await page.waitForTimeout(1500);

    // Navigate to history
    const historyLink = page.locator(
      'a[href="/history"], ' +
      'a:has-text("History"), ' +
      'button:has-text("History")'
    ).first();

    await historyLink.click();
    await page.waitForURL('/history', { timeout: 10000 });

    const pageContent = await page.textContent('body');

    // Should show both Day 1 and Day 2 workouts
    expect(pageContent).toMatch(/day\s*1/i);
    expect(pageContent).toMatch(/day\s*2/i);
  });
});
