import { test, expect } from '@playwright/test';

test.describe('Training Max Setup', () => {
  test('new user sees setup page after first login (no TMs exist)', async ({ page }) => {
    const timestamp = Date.now();
    const email = `setup-check-${timestamp}@example.com`;
    const password = 'ValidPassword123';
    const displayName = 'Setup Check User';

    // Register new user
    await page.goto('/register');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="displayName"]', displayName);
    await page.click('button[type="submit"]');

    // Should be redirected to setup page (no TMs exist yet)
    await page.waitForURL('/setup');
    expect(page.url()).toContain('/setup');

    // Verify setup page has 1RM input fields
    const benchInput = page.locator('input[name="bench"], input[placeholder*="Bench" i]');
    const squatInput = page.locator('input[name="squat"], input[placeholder*="Squat" i]');
    const ohpInput = page.locator('input[name="ohp"], input[placeholder*="OHP" i], input[placeholder*="Overhead" i]');
    const deadliftInput = page.locator('input[name="deadlift"], input[placeholder*="Deadlift" i]');

    await expect(benchInput).toBeVisible();
    await expect(squatInput).toBeVisible();
    await expect(ohpInput).toBeVisible();
    await expect(deadliftInput).toBeVisible();
  });

  test('enter 4 x 1RM values, submit -> redirected to dashboard', async ({ page }) => {
    const timestamp = Date.now();
    const email = `setup-submit-${timestamp}@example.com`;
    const password = 'ValidPassword123';
    const displayName = 'Setup Submit User';

    // Register new user
    await page.goto('/register');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="displayName"]', displayName);
    await page.click('button[type="submit"]');
    await page.waitForURL('/setup');

    // Fill in 1RM values
    await page.fill('input[name="bench"], input[placeholder*="Bench" i]', '100');
    await page.fill('input[name="squat"], input[placeholder*="Squat" i]', '140');
    await page.fill('input[name="ohp"], input[placeholder*="OHP" i], input[placeholder*="Overhead" i]', '60');
    await page.fill('input[name="deadlift"], input[placeholder*="Deadlift" i]', '180');

    // Submit form
    await page.click('button[type="submit"]');

    // Should be redirected to dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 });
    expect(page.url()).toContain('/dashboard');
  });

  test('dashboard shows computed TMs (90% of entered 1RMs)', async ({ page }) => {
    const timestamp = Date.now();
    const email = `setup-verify-${timestamp}@example.com`;
    const password = 'ValidPassword123';
    const displayName = 'Setup Verify User';

    // Register new user
    await page.goto('/register');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="displayName"]', displayName);
    await page.click('button[type="submit"]');
    await page.waitForURL('/setup');

    // Define 1RM values
    const oneRepMaxes = {
      bench: 100,
      squat: 140,
      ohp: 60,
      deadlift: 180
    };

    // Fill in 1RM values
    await page.fill('input[name="bench"], input[placeholder*="Bench" i]', oneRepMaxes.bench.toString());
    await page.fill('input[name="squat"], input[placeholder*="Squat" i]', oneRepMaxes.squat.toString());
    await page.fill('input[name="ohp"], input[placeholder*="OHP" i], input[placeholder*="Overhead" i]', oneRepMaxes.ohp.toString());
    await page.fill('input[name="deadlift"], input[placeholder*="Deadlift" i]', oneRepMaxes.deadlift.toString());

    // Submit form
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard', { timeout: 10000 });

    // Calculate expected TMs (90% of 1RMs, rounded to 2.5kg)
    // TM = 90% * 1RM, then round to nearest 2.5kg
    const expectedTMs = {
      bench: Math.round((oneRepMaxes.bench * 0.9) / 2.5) * 2.5,      // 90
      squat: Math.round((oneRepMaxes.squat * 0.9) / 2.5) * 2.5,      // 125
      ohp: Math.round((oneRepMaxes.ohp * 0.9) / 2.5) * 2.5,          // 55
      deadlift: Math.round((oneRepMaxes.deadlift * 0.9) / 2.5) * 2.5 // 162.5
    };

    // Wait for dashboard to load and verify TMs are displayed
    // TMs might be displayed in various ways, so we'll check for the values as text
    await page.waitForTimeout(1000); // Give dashboard time to load

    // Look for TM values in the page content
    const pageContent = await page.textContent('body');

    // Check that all expected TM values appear in the page
    // Since we're checking kg values, we look for the exact numbers
    expect(pageContent).toContain(expectedTMs.bench.toString());
    expect(pageContent).toContain(expectedTMs.squat.toString());
    expect(pageContent).toContain(expectedTMs.ohp.toString());
    expect(pageContent).toContain(expectedTMs.deadlift.toString());
  });
});
