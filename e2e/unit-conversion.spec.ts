import { test, expect } from '@playwright/test';

test.describe('Unit Conversion', () => {
  test('register a user with unitPreference lb, set up 1RM values in lb, verify setup page accepts lb values', async ({ page }) => {
    const timestamp = Date.now();
    const email = `lb-user-${timestamp}@example.com`;
    const password = 'ValidPassword123';
    const displayName = 'LB User';

    // Register user with lb unit preference
    await page.goto('/register');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.fill('#displayName', displayName);

    // Select lb unit preference
    await page.click('input[type="radio"][value="lb"]');

    await page.click('button[type="submit"]');

    // After successful registration, user should be redirected to setup page
    await page.waitForURL('/setup');

    // Verify unit label shows "lb" on setup page
    const benchLabel = await page.locator('label[for="bench"]').textContent();
    expect(benchLabel).toContain('lb');

    // Fill in 1RM values in lb
    await page.fill('input[name="bench"]', '225'); // ~100kg
    await page.fill('input[name="squat"]', '315'); // ~140kg
    await page.fill('input[name="ohp"]', '135'); // ~60kg
    await page.fill('input[name="deadlift"]', '405'); // ~180kg

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('/', { timeout: 10000 });

    // Verify we're on dashboard
    expect(page.url()).toContain('/');
  });

  test('lb user starting Day 1 workout sees weights in lb rounded to nearest 5', async ({ page }) => {
    const timestamp = Date.now();
    const email = `lb-workout-${timestamp}@example.com`;
    const password = 'ValidPassword123';
    const displayName = 'LB Workout User';

    // Register user with lb unit preference
    await page.goto('/register');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.fill('#displayName', displayName);
    await page.click('input[type="radio"][value="lb"]');
    await page.click('button[type="submit"]');
    await page.waitForURL('/setup');

    // Fill in 1RM values in lb
    await page.fill('input[name="bench"]', '225');
    await page.fill('input[name="squat"]', '315');
    await page.fill('input[name="ohp"]', '135');
    await page.fill('input[name="deadlift"]', '405');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // Start Day 1 workout (Bench Volume)
    const startButton = page.getByRole('button', { name: /start workout/i }).first();
    await expect(startButton).toBeVisible();
    await startButton.click();

    // Wait for workout page
    await page.waitForURL('/workout/1');

    // Day 1 Bench TM calculation: 225 lb * 0.9 = 202.5 lb
    // Set 1: 65% of 202.5 = 131.625 lb, rounded to nearest 5 = 130 lb
    const firstSetWeight = await page.locator('.set-row').first().locator('.set-row__weight').textContent();

    // Verify weight is displayed in lb
    expect(firstSetWeight).toContain('lb');

    // Verify weight is rounded to nearest 5
    const weightValue = parseInt(firstSetWeight?.match(/\d+/)?.[0] || '0');
    expect(weightValue % 5).toBe(0);

    // Verify the first set weight is approximately 130 lb (65% of 202.5 lb TM)
    expect(weightValue).toBeGreaterThanOrEqual(125);
    expect(weightValue).toBeLessThanOrEqual(135);
  });

  test('lb user dashboard shows TMs in lb', async ({ page }) => {
    const timestamp = Date.now();
    const email = `lb-dashboard-${timestamp}@example.com`;
    const password = 'ValidPassword123';
    const displayName = 'LB Dashboard User';

    // Register user with lb unit preference
    await page.goto('/register');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.fill('#displayName', displayName);
    await page.click('input[type="radio"][value="lb"]');
    await page.click('button[type="submit"]');
    await page.waitForURL('/setup');

    // Fill in 1RM values in lb
    await page.fill('input[name="bench"]', '220');
    await page.fill('input[name="squat"]', '310');
    await page.fill('input[name="ohp"]', '130');
    await page.fill('input[name="deadlift"]', '400');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // Verify Training Maxes section shows lb values
    const benchTM = await page.locator('.tm-item:has-text("Bench")').locator('.tm-weight').textContent();
    const squatTM = await page.locator('.tm-item:has-text("Squat")').locator('.tm-weight').textContent();
    const ohpTM = await page.locator('.tm-item:has-text("OHP")').locator('.tm-weight').textContent();
    const deadliftTM = await page.locator('.tm-item:has-text("Deadlift")').locator('.tm-weight').textContent();

    // All TMs should show "lb" unit
    expect(benchTM).toContain('lb');
    expect(squatTM).toContain('lb');
    expect(ohpTM).toContain('lb');
    expect(deadliftTM).toContain('lb');

    // Verify TMs are 90% of 1RMs and rounded to nearest 5
    // Bench: 220 * 0.9 = 198, rounded to 200 lb
    // Squat: 310 * 0.9 = 279, rounded to 280 lb
    // OHP: 130 * 0.9 = 117, rounded to 115 lb
    // Deadlift: 400 * 0.9 = 360 lb
    const benchValue = parseInt(benchTM?.match(/\d+/)?.[0] || '0');
    const squatValue = parseInt(squatTM?.match(/\d+/)?.[0] || '0');
    const ohpValue = parseInt(ohpTM?.match(/\d+/)?.[0] || '0');
    const deadliftValue = parseInt(deadliftTM?.match(/\d+/)?.[0] || '0');

    expect(benchValue % 5).toBe(0);
    expect(squatValue % 5).toBe(0);
    expect(ohpValue % 5).toBe(0);
    expect(deadliftValue % 5).toBe(0);

    // Verify approximate values (within rounding range)
    expect(benchValue).toBeGreaterThanOrEqual(195);
    expect(benchValue).toBeLessThanOrEqual(200);

    expect(squatValue).toBeGreaterThanOrEqual(275);
    expect(squatValue).toBeLessThanOrEqual(280);

    expect(ohpValue).toBeGreaterThanOrEqual(115);
    expect(ohpValue).toBeLessThanOrEqual(120);

    expect(deadliftValue).toBeGreaterThanOrEqual(360);
    expect(deadliftValue).toBeLessThanOrEqual(365);
  });
});
