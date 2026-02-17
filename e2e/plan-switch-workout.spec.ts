import { test, expect } from './fixtures';
import { DashboardPage } from './pages/dashboard.page';
import { WorkoutPage } from './pages/workout.page';
import { SettingsPage } from './pages/settings.page';

/**
 * Helper: promote current user to admin, re-login, and create a simple plan
 * that uses the same exercises as nSuns (bench-press, squat) so TMs carry over.
 * Returns the plan ID.
 */
async function createSecondPlan(page: import('@playwright/test').Page) {
  const token = await page.evaluate(() => localStorage.getItem('accessToken'));

  // Promote to admin
  const promoteRes = await page.request.post('/api/dev/promote-admin', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(promoteRes.ok()).toBeTruthy();

  // Re-login to get admin JWT
  const settings = new SettingsPage(page);
  await settings.navigate();
  await settings.expectLoaded();

  // Get user email from the page
  const emailEl = page.locator('p').filter({ hasText: /@example\.com/ });
  const email = await emailEl.textContent();

  await settings.logout();

  await page.getByLabel(/email/i).fill(email!);
  await page.getByLabel(/password/i).fill('ValidPassword123');
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page.getByText('Workout Days')).toBeVisible();

  // Get admin token
  const adminToken = await page.evaluate(() => localStorage.getItem('accessToken'));

  // Get exercise IDs for bench-press and squat
  const exercisesRes = await page.request.get('/api/admin/exercises', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const exercises = await exercisesRes.json();
  const bench = exercises.find((e: { slug: string }) => e.slug === 'bench-press');
  const squat = exercises.find((e: { slug: string }) => e.slug === 'squat');

  // Create a simple 2-day plan with same exercises
  const slug = `test-plan-${crypto.randomUUID().slice(0, 8)}`;
  const createRes = await page.request.post('/api/admin/plans', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      slug,
      name: 'Simple Test Plan',
      description: 'A simple plan for testing plan switching',
      daysPerWeek: 2,
      isPublic: true,
      days: [
        {
          dayNumber: 1,
          name: 'Day A',
          exercises: [
            {
              exerciseId: squat.id,
              tmExerciseId: squat.id,
              sortOrder: 1,
              displayName: 'Squat',
              sets: [
                { setOrder: 1, percentage: 0.7, reps: 5 },
                { setOrder: 2, percentage: 0.8, reps: 5 },
                { setOrder: 3, percentage: 0.85, reps: 5, isAmrap: true, isProgression: true },
              ],
            },
          ],
        },
        {
          dayNumber: 2,
          name: 'Day B',
          exercises: [
            {
              exerciseId: bench.id,
              tmExerciseId: bench.id,
              sortOrder: 1,
              displayName: 'Bench Press',
              sets: [
                { setOrder: 1, percentage: 0.7, reps: 5 },
                { setOrder: 2, percentage: 0.8, reps: 5 },
                { setOrder: 3, percentage: 0.85, reps: 5, isAmrap: true, isProgression: true },
              ],
            },
          ],
        },
      ],
    },
  });
  expect(createRes.ok()).toBeTruthy();
}

test.describe('Plan switch discards in-progress workout', () => {
  test('switching plans while having an in-progress workout discards it', async ({
    setupCompletePage,
  }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const workout = new WorkoutPage(page);

    // 1. Start a Day 1 workout on nSuns
    await dashboard.expectLoaded();
    await dashboard.startWorkout(1);
    await workout.expectLoaded(1);

    // 2. Complete some reps so the workout is actually in progress with data
    await workout.confirmSet(0);
    await workout.confirmSet(1);
    await workout.confirmSet(2);

    // 3. Go back to dashboard
    await page.goto('/');
    await dashboard.expectLoaded();

    // Verify "Continue Workout" is shown (workout is in progress)
    await expect(
      dashboard.getDayCard(1).getByRole('link', { name: /continue workout/i }),
    ).toBeVisible();

    // 4. Create a second plan (promotes user to admin, re-logs in, creates plan via API)
    await createSecondPlan(page);

    // 5. Navigate to settings and switch plans
    const settings = new SettingsPage(page);
    await settings.navigate();
    await settings.expectLoaded();
    await page.getByRole('link', { name: /change plan/i }).click();
    await expect(page.getByRole('heading', { name: /choose a workout plan/i })).toBeVisible();

    // Select the "Simple Test Plan" — find the button following the plan heading
    await page
      .getByRole('heading', { name: 'Simple Test Plan', exact: true })
      .locator('..')
      .locator('..')
      .getByRole('button', { name: /select plan/i })
      .click();

    // Confirm the plan switch (modal warns about in-progress workout)
    await expect(page.getByText(/in-progress workout/i)).toBeVisible();
    await page.getByRole('button', { name: /confirm switch/i }).click();

    // 6. Should be on dashboard (TMs carry over since we use same exercises)
    await dashboard.expectLoaded();

    // 7. Verify the old workout is discarded - Day 1 should show "Start Workout", not "Continue"
    await expect(
      dashboard.getDayCard(1).getByRole('link', { name: /start workout/i }),
    ).toBeVisible();
  });
});
