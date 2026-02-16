import { test, expect } from './fixtures';
import { SetupPage } from './pages/setup.page';
import { SettingsPage } from './pages/settings.page';

test.describe('Training Max Setup', () => {
  test('new user is redirected to /setup when no TMs exist', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;

    await expect(page).toHaveURL(/\/setup/);

    await expect(page.getByRole('spinbutton', { name: /bench/i })).toBeVisible();
    await expect(page.getByRole('spinbutton', { name: /squat/i })).toBeVisible();
    await expect(page.getByRole('spinbutton', { name: /overhead|ohp/i })).toBeVisible();
    await expect(page.getByRole('spinbutton', { name: /deadlift/i })).toBeVisible();
  });

  test('entering 1RMs and submitting redirects to dashboard with correct TMs', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;
    const setup = new SetupPage(page);
    const settings = new SettingsPage(page);

    const oneRepMaxes = {
      bench: 100,
      squat: 140,
      ohp: 60,
      deadlift: 180,
    };

    await page.getByRole('spinbutton', { name: /bench/i }).fill(oneRepMaxes.bench.toString());
    await page.getByRole('spinbutton', { name: /squat/i }).fill(oneRepMaxes.squat.toString());
    await page.getByRole('spinbutton', { name: /overhead|ohp/i }).fill(oneRepMaxes.ohp.toString());
    await page.getByRole('spinbutton', { name: /deadlift/i }).fill(oneRepMaxes.deadlift.toString());

    await setup.submitAndWaitForDashboard();

    await expect(page.getByText('Workout Days')).toBeVisible();

    // Navigate to settings to verify TMs
    await settings.navigate();
    await settings.expectLoaded();

    // Calculate expected TMs (90% of 1RMs, rounded to 2.5kg)
    const expectedTMs = {
      bench: Math.round((oneRepMaxes.bench * 0.9) / 2.5) * 2.5, // 90
      squat: Math.round((oneRepMaxes.squat * 0.9) / 2.5) * 2.5, // 125
      ohp: Math.round((oneRepMaxes.ohp * 0.9) / 2.5) * 2.5, // 55
      deadlift: Math.round((oneRepMaxes.deadlift * 0.9) / 2.5) * 2.5, // 162.5
    };

    const pageContent = await page.textContent('body');
    expect(pageContent).toContain(expectedTMs.bench.toString());
    expect(pageContent).toContain(expectedTMs.squat.toString());
    expect(pageContent).toContain(expectedTMs.ohp.toString());
    expect(pageContent).toContain(expectedTMs.deadlift.toString());
  });

  test('editing a TM from settings updates the displayed value', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const settings = new SettingsPage(page);

    expect(page.url()).toContain('/');

    await settings.navigate();
    await settings.expectLoaded();

    // Initial TM for bench should be 90kg (90% of 100kg)
    let pageContent = await page.textContent('body');
    expect(pageContent).toContain('90');

    // Edit Bench TM
    await settings.editTM(0, '95');

    pageContent = await page.textContent('body');
    expect(pageContent).toContain('95');
  });
});
