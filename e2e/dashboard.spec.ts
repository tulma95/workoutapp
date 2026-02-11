import { test, expect } from './fixtures';

test.describe('Dashboard', () => {
  test('shows 4 workout day cards with correct exercise names', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    // Should be on dashboard
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();

    // Check all 4 day cards exist with correct exercises
    await expect(page.getByRole('heading', { name: /^day 1$/i })).toBeVisible();
    await expect(page.getByText(/bench volume/i)).toBeVisible();
    await expect(page.getByText(/^ohp$/i)).toBeVisible();

    await expect(page.getByRole('heading', { name: /^day 2$/i })).toBeVisible();
    await expect(page.getByText(/^squat$/i)).toBeVisible();
    await expect(page.getByText(/sumo deadlift/i)).toBeVisible();

    await expect(page.getByRole('heading', { name: /^day 3$/i })).toBeVisible();
    await expect(page.getByText(/bench heavy/i)).toBeVisible();
    await expect(page.getByText(/close grip bench/i)).toBeVisible();

    await expect(page.getByRole('heading', { name: /^day 4$/i })).toBeVisible();
    await expect(page.getByText(/^deadlift$/i)).toBeVisible();
    await expect(page.getByText(/front squat/i)).toBeVisible();
  });

  test('shows current TM values for all 4 exercises', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    // Expected TMs from 1RMs: bench 100, squat 140, ohp 60, deadlift 180
    // TM = 90% of 1RM, rounded to 2.5kg
    await expect(page.getByText(/90.*kg/i).first()).toBeVisible(); // Bench 90kg
    await expect(page.getByText(/125.*kg/i).first()).toBeVisible(); // Squat 125kg (140*0.9=126 -> 125)
    await expect(page.getByText(/55.*kg/i).first()).toBeVisible(); // OHP 55kg (60*0.9=54 -> 55)
    await expect(page.getByText(/162\.5.*kg/i).first()).toBeVisible(); // Deadlift 162.5kg
  });

  test('clicking Start Workout navigates to workout page', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    // Click "Start Workout" button on Day 1
    const startButton = page.getByRole('button', { name: /start workout/i }).first();
    await expect(startButton).toBeVisible();
    await startButton.click();

    // Should navigate to /workout/1
    await expect(page).toHaveURL('/workout/1');
  });
});
