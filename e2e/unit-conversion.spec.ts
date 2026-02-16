import { test, expect, type Page } from '@playwright/test';
import { test as testWithFixture } from './fixtures';
import { RegisterPage } from './pages/register.page';
import { PlanSelectionPage } from './pages/plan-selection.page';
import { SetupPage } from './pages/setup.page';
import { SettingsPage } from './pages/settings.page';
import { DashboardPage } from './pages/dashboard.page';
import { WorkoutPage } from './pages/workout.page';
import { NavigationBar } from './pages/navigation.page';

async function registerLbUser(page: Page, email: string, displayName: string) {
  const register = new RegisterPage(page);
  const planSelection = new PlanSelectionPage(page);
  const setup = new SetupPage(page);

  await register.register(email, 'ValidPassword123', displayName, 'lb');
  await planSelection.selectFirstPlan();
  await setup.expectHeading();
}

async function fillLbOneRepMaxes(page: Page, bench: string, squat: string, ohp: string, deadlift: string) {
  const setup = new SetupPage(page);
  await setup.fillOneRepMaxes(bench, squat, ohp, deadlift);
  await setup.submitAndWaitForDashboard();
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

    const dashboard = new DashboardPage(page);
    await dashboard.startWorkout();

    const firstSetWeight = await page.locator('[data-testid="set-weight"]').first().textContent();
    expect(firstSetWeight).toContain('lb');

    const weightMatch = firstSetWeight?.match(/(\d+(?:\.\d+)?)\s*lb/);
    expect(weightMatch).toBeTruthy();
    const weightValue = parseInt(weightMatch![1]);
    expect(weightValue % 5).toBe(0);
    expect(weightValue).toBeGreaterThanOrEqual(125);
    expect(weightValue).toBeLessThanOrEqual(135);
  });

  test('lb user settings shows TMs in lb', async ({ page }) => {
    const email = `lb-dashboard-${Date.now()}@example.com`;

    await registerLbUser(page, email, 'LB Dashboard User');
    await fillLbOneRepMaxes(page, '220', '310', '130', '400');

    const settings = new SettingsPage(page);
    await settings.navigate();
    await settings.expectLoaded();

    const benchTM = await page.locator('[data-testid="tm-item"]').filter({ hasText: 'Bench' }).textContent();
    const squatTM = await page.locator('[data-testid="tm-item"]').filter({ hasText: 'Squat' }).textContent();
    const ohpTM = await page.locator('[data-testid="tm-item"]').filter({ hasText: /OHP|Overhead/i }).textContent();
    const deadliftTM = await page.locator('[data-testid="tm-item"]').filter({ hasText: 'Deadlift' }).textContent();

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
    const dashboard = new DashboardPage(page);
    const settings = new SettingsPage(page);
    const workout = new WorkoutPage(page);
    const nav = new NavigationBar(page);

    await dashboard.expectLoaded();

    await settings.navigate();
    await settings.expectLoaded();

    await expect(page.locator('text=Bench-press').locator('..')).toContainText('kg');

    await settings.setUnit('lb');

    await nav.goToDashboard();

    await dashboard.startWorkout();
    await workout.expectLoaded(1);
    await expect(page.locator('[data-testid="set-row"]').first()).toBeVisible();

    const firstSetText = await page.locator('[data-testid="set-row"]').first().textContent();
    expect(firstSetText).toContain('lb');

    const firstSetWeightMatch = firstSetText?.match(/(\d+(?:\.\d+)?)\s*lb/);
    expect(firstSetWeightMatch).toBeTruthy();
    const firstSetWeight = parseFloat(firstSetWeightMatch![1]);
    expect(firstSetWeight % 5).toBe(0);

    await page.goto('/settings');
    await settings.expectLoaded();

    await expect(page.locator('text=Bench-press').locator('..')).toContainText('lb');
    const benchTMText = await page.locator('text=Bench-press').locator('..').textContent();
    const benchMatch = benchTMText?.match(/(\d+(?:\.\d+)?)\s*lb/);
    expect(benchMatch).toBeTruthy();
    const benchLb = parseFloat(benchMatch![1]);
    expect(benchLb).toBeGreaterThan(0);
    expect(benchLb % 5).toBe(0);
  });
});
