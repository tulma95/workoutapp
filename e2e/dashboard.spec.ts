import { test, expect } from './fixtures';
import { DashboardPage } from './pages/dashboard.page';
import { SettingsPage } from './pages/settings.page';

test.describe('Dashboard', () => {
  test('shows 4 workout day cards with correct exercise names', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();

    await expect(page.getByRole('heading', { name: /^day 1$/i })).toBeVisible();
    await expect(page.getByText(/bench volume/i)).toBeVisible();
    await expect(page.getByText(/overhead press/i)).toBeVisible();

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

  test('shows current TM values for all 4 exercises on settings page', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const settings = new SettingsPage(page);

    await settings.navigate();
    await settings.expectLoaded();

    // Expected TMs from 1RMs: bench 100, squat 140, ohp 60, deadlift 180
    await expect(page.getByText(/90.*kg/i).first()).toBeVisible();
    await expect(page.getByText(/125.*kg/i).first()).toBeVisible();
    await expect(page.getByText(/55.*kg/i).first()).toBeVisible();
    await expect(page.getByText(/162\.5.*kg/i).first()).toBeVisible();
  });

  test('clicking Start Workout navigates to workout page', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);

    await dashboard.startWorkout();

    await expect(page).toHaveURL('/workout/1');
  });
});
