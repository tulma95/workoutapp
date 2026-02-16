import { test, expect, type Page } from '@playwright/test';
import { test as testWithFixture } from './fixtures';

async function registerLbUser(page: Page, email: string, displayName: string) {
  await page.goto('/register');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill('ValidPassword123');
  await page.getByLabel(/display name/i).fill(displayName);
  await page.getByRole('radio', { name: 'lb' }).click();
  await page.getByRole('button', { name: /create account/i }).click();

  await page.waitForURL('/select-plan');
  await page.getByRole('button', { name: /select plan/i }).first().click();
  await page.waitForURL(/\/setup/);
  await expect(page.getByRole('heading', { name: /enter your 1 rep maxes/i })).toBeVisible();
  await expect(page.locator('.form-group')).toHaveCount(4);
}

async function fillLbOneRepMaxes(page: Page, bench: string, squat: string, ohp: string, deadlift: string) {
  await page.getByLabel(/Bench Press/i).fill(bench);
  await page.getByLabel(/^Squat/i).fill(squat);
  await page.getByLabel(/Overhead Press/i).fill(ohp);
  await page.getByLabel(/^Deadlift/i).fill(deadlift);
  await page.getByRole('button', { name: /calculate/i }).click();
  await page.waitForURL('/');
}

test.describe('Unit Conversion', () => {
  test('register a user with unitPreference lb, set up 1RM values in lb, verify setup page accepts lb values', async ({ page }) => {
    const email = `lb-user-${Date.now()}@example.com`;

    await registerLbUser(page, email, 'LB User');

    // Verify unit label shows "lb" on setup page
    const benchLabel = await page.getByLabel(/Bench Press/i).locator('..').locator('label').textContent();
    expect(benchLabel).toContain('lb');

    await fillLbOneRepMaxes(page, '225', '315', '135', '405');
    expect(page.url()).toContain('/');
  });

  test('lb user starting Day 1 workout sees weights in lb rounded to nearest 5', async ({ page }) => {
    const email = `lb-workout-${Date.now()}@example.com`;

    await registerLbUser(page, email, 'LB Workout User');
    await fillLbOneRepMaxes(page, '225', '315', '135', '405');

    const startButton = page.getByRole('button', { name: /start workout/i }).first();
    await expect(startButton).toBeVisible();
    await startButton.click();
    await page.waitForURL(/\/workout\/\d+/);

    const firstSetWeight = await page.locator('.set-row').first().locator('.set-row__weight').textContent();
    expect(firstSetWeight).toContain('lb');

    const weightValue = parseInt(firstSetWeight?.match(/\d+/)?.[0] || '0');
    expect(weightValue % 5).toBe(0);
    expect(weightValue).toBeGreaterThanOrEqual(125);
    expect(weightValue).toBeLessThanOrEqual(135);
  });

  test('lb user settings shows TMs in lb', async ({ page }) => {
    const email = `lb-dashboard-${Date.now()}@example.com`;

    await registerLbUser(page, email, 'LB Dashboard User');
    await fillLbOneRepMaxes(page, '220', '310', '130', '400');

    await page.getByRole('link', { name: /settings/i }).click();
    await page.waitForURL('/settings');
    await expect(page.getByText('Training Maxes')).toBeVisible();

    const benchTM = await page.locator('.tm-item:has-text("Bench")').locator('.tm-weight').textContent();
    const squatTM = await page.locator('.tm-item:has-text("Squat")').locator('.tm-weight').textContent();
    const ohpTM = await page.locator('.tm-item:has-text("OHP"), .tm-item:has-text("Overhead")').locator('.tm-weight').textContent();
    const deadliftTM = await page.locator('.tm-item:has-text("Deadlift")').locator('.tm-weight').textContent();

    expect(benchTM).toContain('lb');
    expect(squatTM).toContain('lb');
    expect(ohpTM).toContain('lb');
    expect(deadliftTM).toContain('lb');

    const benchValue = parseInt(benchTM?.match(/\d+/)?.[0] || '0');
    const squatValue = parseInt(squatTM?.match(/\d+/)?.[0] || '0');
    const ohpValue = parseInt(ohpTM?.match(/\d+/)?.[0] || '0');
    const deadliftValue = parseInt(deadliftTM?.match(/\d+/)?.[0] || '0');

    expect(benchValue % 5).toBe(0);
    expect(squatValue % 5).toBe(0);
    expect(ohpValue % 5).toBe(0);
    expect(deadliftValue % 5).toBe(0);

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

    await expect(page.getByText('Workout Days')).toBeVisible();

    await page.getByRole('link', { name: /settings/i }).click();
    await page.waitForURL('/settings');
    await expect(page.getByText('Training Maxes')).toBeVisible();

    await expect(page.locator('text=Bench-press').locator('..')).toContainText('kg');

    await page.getByRole('button', { name: 'lb' }).click();
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 3000 });

    await page.getByRole('link', { name: /dashboard/i }).click();
    await page.waitForURL('/');

    await page.getByRole('button', { name: /start workout/i }).first().click();
    await page.waitForURL(/\/workout\/1/);
    await expect(page.getByRole('heading', { name: /day 1/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('checkbox').first()).toBeVisible();

    const firstSetText = await page.locator('.set-row').first().textContent();
    expect(firstSetText).toContain('lb');

    const firstSetWeightMatch = firstSetText?.match(/(\d+(?:\.\d+)?)\s*lb/);
    expect(firstSetWeightMatch).toBeTruthy();
    const firstSetWeight = parseFloat(firstSetWeightMatch![1]);
    expect(firstSetWeight % 5).toBe(0);

    await page.goto('/settings');
    await expect(page.getByText('Training Maxes')).toBeVisible();

    await expect(page.locator('text=Bench-press').locator('..')).toContainText('lb');
    const benchTMText = await page.locator('text=Bench-press').locator('..').textContent();
    const benchMatch = benchTMText?.match(/(\d+(?:\.\d+)?)\s*lb/);
    expect(benchMatch).toBeTruthy();
    const benchLb = parseFloat(benchMatch![1]);
    expect(benchLb).toBeGreaterThan(0);
    expect(benchLb % 5).toBe(0);
  });
});
