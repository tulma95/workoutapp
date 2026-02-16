import { test as base, expect, type Page } from '@playwright/test';
import { RegisterPage } from './pages/register.page';
import { PlanSelectionPage } from './pages/plan-selection.page';

async function registerAndPartialSetup(page: Page) {
  const register = new RegisterPage(page);
  const planSelection = new PlanSelectionPage(page);

  const uniqueId = crypto.randomUUID();
  const email = `test-${uniqueId}@example.com`;

  await register.register(email, 'ValidPassword123', 'Test User');
  await planSelection.selectFirstPlan();

  // Get auth token
  const token = await page.evaluate(() => localStorage.getItem('accessToken'));

  // Get current plan to find exercise IDs
  const planRes = await page.request.get('/api/plans/current', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(planRes.ok()).toBeTruthy();
  const plan = await planRes.json();

  // Extract unique TM exercise IDs from the plan
  const tmExerciseMap = new Map<number, string>();
  for (const day of plan.days) {
    for (const ex of day.exercises) {
      if (!tmExerciseMap.has(ex.tmExerciseId)) {
        tmExerciseMap.set(ex.tmExerciseId, ex.tmExercise.name);
      }
    }
  }

  // Set up TMs for all exercises EXCEPT the last one
  const allExercises = Array.from(tmExerciseMap.entries());
  expect(allExercises.length).toBeGreaterThanOrEqual(2);

  const exercisesToSetup = allExercises.slice(0, -1);
  const skippedExercise = allExercises[allExercises.length - 1];

  const exerciseTMs = exercisesToSetup.map(([exerciseId]) => ({
    exerciseId,
    oneRepMax: 100,
  }));

  const setupRes = await page.request.post('/api/training-maxes/setup', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: { exerciseTMs },
  });
  expect(setupRes.ok()).toBeTruthy();

  return { token, skippedExercise, plan };
}

const test = base;

test.describe('Missing TM redirect', () => {
  test('dashboard redirects to /setup when plan has exercises without TMs', async ({ page }) => {
    const { skippedExercise } = await registerAndPartialSetup(page);
    const [, skippedName] = skippedExercise;

    await page.goto('/');
    await expect(page).toHaveURL(/\/setup/);

    await expect(page.getByText(skippedName)).toBeVisible();
  });

  test('after filling missing TM on setup page, user reaches dashboard', async ({ page }) => {
    await registerAndPartialSetup(page);

    await page.goto('/');
    await expect(page.getByRole('spinbutton').first()).toBeVisible();
    const inputs = page.getByRole('spinbutton');
    expect(await inputs.count()).toBe(1);

    await inputs.first().fill('100');
    await page.getByRole('button', { name: /calculate/i }).click();

    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });
});
