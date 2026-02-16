import { test as base, expect, type Page } from '@playwright/test';

/**
 * Helper: register a user via the UI, subscribe to the default plan,
 * then use the API to set up TMs for only SOME exercises (skipping one).
 * Simulates the scenario where an admin edits a plan to add new exercises
 * after a user has already set up their TMs.
 */
async function registerAndPartialSetup(page: Page) {
  const uniqueId = crypto.randomUUID();
  const email = `test-${uniqueId}@example.com`;
  const password = 'ValidPassword123';

  // Register via UI
  await page.goto('/register');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.fill('#displayName', 'Test User');
  await page.click('button[type="submit"]');

  // After registration, select the default plan via UI
  await page.waitForURL('/select-plan');
  await page.click('button:has-text("Select Plan")');
  await page.waitForURL(/\/setup/);

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

    // Navigate to dashboard
    await page.goto('/');

    // Should be redirected to /setup because one TM is missing
    await page.waitForURL(/\/setup/, { timeout: 10000 });
    expect(page.url()).toContain('/setup');

    // The setup page should show only the missing exercise
    await page.waitForSelector(`text=${skippedName}`, { timeout: 5000 });
  });

  test('after filling missing TM on setup page, user reaches dashboard', async ({ page }) => {
    await registerAndPartialSetup(page);

    // Navigate to dashboard — should redirect to /setup
    await page.goto('/');
    await page.waitForURL(/\/setup/, { timeout: 10000 });

    // Fill in the missing exercise's 1RM (there should be exactly 1 input)
    // Wait for the setup form to load (exercises are fetched asynchronously)
    await page.getByRole('spinbutton').first().waitFor({ timeout: 10000 });
    const inputs = page.getByRole('spinbutton');
    const count = await inputs.count();
    expect(count).toBe(1);

    await inputs.first().fill('100');

    // Submit
    await page.getByRole('button', { name: /calculate/i }).click();

    // Should redirect to dashboard
    await page.waitForURL('/', { timeout: 10000 });
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });
});
