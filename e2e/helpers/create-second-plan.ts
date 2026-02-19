import { expect } from '@playwright/test';
import { SettingsPage } from '../pages/settings.page';

/**
 * Helper: promote current user to admin, re-login, and create a simple plan
 * that uses the same exercises as nSuns (bench-press, squat) so TMs carry over.
 */
export async function createSecondPlan(page: import('@playwright/test').Page) {
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
  await expect(emailEl).toBeVisible();
  const email = await emailEl.textContent();
  expect(email).toBeTruthy();

  await settings.logout();

  // Fill login form — verify email stuck before submitting (guards against re-render race)
  const emailInput = page.getByLabel(/email/i);
  await emailInput.fill(email!);
  await expect(emailInput).toHaveValue(email!);
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
