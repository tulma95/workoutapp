import { test, expect } from '@playwright/test';
import { test as testWithFixture } from './fixtures';

/** After registration, user lands on /select-plan. Select the first plan to proceed to /setup. */
async function selectPlanAfterRegistration(page: import('@playwright/test').Page) {
  await page.waitForURL('/select-plan');
  await page.click('button:has-text("Select Plan")');
  await page.waitForURL('/setup');
}

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

    // After registration, select a plan first
    await selectPlanAfterRegistration(page);

    // Verify unit label shows "lb" on setup page
    const benchLabel = await page.getByLabel(/Bench Press/i).locator('..').locator('label').textContent();
    expect(benchLabel).toContain('lb');

    // Fill in 1RM values in lb using label selectors (input names are numeric IDs)
    await page.getByLabel(/Bench Press/i).fill('225');
    await page.getByLabel(/^Squat/i).fill('315');
    await page.getByLabel(/Overhead Press/i).fill('135');
    await page.getByLabel(/^Deadlift/i).fill('405');

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
    await selectPlanAfterRegistration(page);

    // Fill in 1RM values in lb
    await page.getByLabel(/Bench Press/i).fill('225');
    await page.getByLabel(/^Squat/i).fill('315');
    await page.getByLabel(/Overhead Press/i).fill('135');
    await page.getByLabel(/^Deadlift/i).fill('405');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // Start Day 1 workout (Bench Volume)
    const startButton = page.getByRole('button', { name: /start workout/i }).first();
    await expect(startButton).toBeVisible();
    await startButton.click();

    // Wait for workout page
    await page.waitForURL(/\/workout\/\d+/);

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
    await selectPlanAfterRegistration(page);

    // Fill in 1RM values in lb
    await page.getByLabel(/Bench Press/i).fill('220');
    await page.getByLabel(/^Squat/i).fill('310');
    await page.getByLabel(/Overhead Press/i).fill('130');
    await page.getByLabel(/^Deadlift/i).fill('400');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // Verify Training Maxes section shows lb values
    const benchTM = await page.locator('.tm-item:has-text("Bench")').locator('.tm-weight').textContent();
    const squatTM = await page.locator('.tm-item:has-text("Squat")').locator('.tm-weight').textContent();
    const ohpTM = await page.locator('.tm-item:has-text("OHP"), .tm-item:has-text("Overhead")').locator('.tm-weight').textContent();
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

  testWithFixture('switching unit preference from kg to lb updates weight displays across the app', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    // setupCompletePage registers user with kg (default), subscribes to plan, and sets up TMs
    // Initial state: user is on dashboard with kg units
    await page.waitForSelector('text=Training Maxes');

    // Verify initial state shows kg
    await expect(page.locator('text=Bench-press').locator('..')).toContainText('kg');

    // Navigate to settings
    await page.click('a[href="/settings"]');
    await page.waitForURL('/settings');

    // Verify we're on kg initially
    const kgButton = page.getByRole('button', { name: 'kg' });
    await expect(kgButton).toBeVisible();

    // Switch to lb
    await page.getByRole('button', { name: 'lb' }).click();

    // Wait for save confirmation
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 3000 });

    // Navigate to dashboard
    await page.click('a[href="/"]');
    await page.waitForURL('/');

    //Start a workout to verify workout weights are displayed in lb
    // Workout page will fetch fresh user data and display weights accordingly
    await page.getByRole('button', { name: /start workout/i }).first().click();
    await page.waitForURL(/\/workout\/1/);
    await expect(page.getByRole('heading', { name: /day 1/i })).toBeVisible({ timeout: 15000 });

    // Wait for sets to load
    await expect(page.getByRole('checkbox').first()).toBeVisible({ timeout: 15000 });

    // Verify workout set weights are displayed in lb
    const firstSetText = await page.locator('.set-row').first().textContent();
    expect(firstSetText).toContain('lb');

    // Extract weight value and verify it's in lb and properly rounded to nearest 5
    const firstSetWeightMatch = firstSetText?.match(/(\d+(?:\.\d+)?)\s*lb/);
    expect(firstSetWeightMatch).toBeTruthy();
    const firstSetWeight = parseFloat(firstSetWeightMatch![1]);

    // Verify weight is rounded to nearest 5 lb
    expect(firstSetWeight % 5).toBe(0);

    // Navigate back to dashboard and verify TMs are displayed in lb
    await page.goto('/');
    await page.waitForSelector('text=Training Maxes', { timeout: 10000 });

    // The dashboard should now show lb (may need reload for AuthContext to update)
    // Check if lb appears - if not, reload and check again
    const haslb = await page.locator('text=Bench-press').locator('..').textContent().then(t => t?.includes('lb'));
    if (!haslb) {
      await page.reload();
      await page.waitForSelector('text=Training Maxes');
    }

    // Verify TMs are displayed in lb
    await expect(page.locator('text=Bench-press').locator('..')).toContainText('lb', { timeout: 5000 });
    const benchTMText = await page.locator('text=Bench-press').locator('..').textContent();
    const benchMatch = benchTMText?.match(/(\d+(?:\.\d+)?)\s*lb/);
    expect(benchMatch).toBeTruthy();
    const benchLb = parseFloat(benchMatch![1]);
    expect(benchLb).toBeGreaterThan(0);
    expect(benchLb % 5).toBe(0); // Should be rounded to nearest 5 lb
  });
});
