import { test, expect } from './fixtures';

test.describe('Training Max Setup', () => {
  test('new user is redirected to /setup when no TMs exist', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;

    expect(page.url()).toContain('/setup');

    await expect(page.getByRole('spinbutton', { name: /bench/i })).toBeVisible();
    await expect(page.getByRole('spinbutton', { name: /squat/i })).toBeVisible();
    await expect(page.getByRole('spinbutton', { name: /overhead|ohp/i })).toBeVisible();
    await expect(page.getByRole('spinbutton', { name: /deadlift/i })).toBeVisible();
  });

  test('entering 1RMs and submitting redirects to dashboard with correct TMs', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;

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

    await page.getByRole('button', { name: /calculate/i }).click();
    await page.waitForURL('/');

    await expect(page.getByText('Workout Days')).toBeVisible();

    // Navigate to settings to verify TMs
    await page.getByRole('link', { name: /settings/i }).click();
    await page.waitForURL('/settings');
    await expect(page.getByText('Training Maxes')).toBeVisible();

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

    expect(page.url()).toContain('/');

    await page.getByRole('link', { name: /settings/i }).click();
    await page.waitForURL('/settings');
    await expect(page.getByText('Training Maxes')).toBeVisible();

    // Initial TM for bench should be 90kg (90% of 100kg)
    let pageContent = await page.textContent('body');
    expect(pageContent).toContain('90');

    // Find and click the Edit button for Bench
    const benchEditButton = page.locator('button', { hasText: 'Edit' }).first();
    await benchEditButton.click();

    const modalInput = page.getByRole('spinbutton');
    await expect(modalInput).toBeVisible();
    await expect(modalInput).toHaveValue('90');

    await modalInput.fill('95');
    await page.getByRole('button', { name: /save/i }).click();

    // Wait for modal to close and value to update
    await expect(page.getByRole('dialog')).not.toBeVisible();

    pageContent = await page.textContent('body');
    expect(pageContent).toContain('95');
  });
});
