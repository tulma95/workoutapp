import { test, expect } from './fixtures';

test.describe('Training Max Setup', () => {
  test('new user is redirected to /setup when no TMs exist', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;

    // User should already be on setup page (fixture handles registration and redirect)
    expect(page.url()).toContain('/setup');

    // Verify setup page has 1RM input fields
    const benchInput = page.getByRole('spinbutton', { name: /bench/i });
    const squatInput = page.getByRole('spinbutton', { name: /squat/i });
    const ohpInput = page.getByRole('spinbutton', { name: /overhead|ohp/i });
    const deadliftInput = page.getByRole('spinbutton', { name: /deadlift/i });

    await expect(benchInput).toBeVisible();
    await expect(squatInput).toBeVisible();
    await expect(ohpInput).toBeVisible();
    await expect(deadliftInput).toBeVisible();
  });

  test('entering 1RMs and submitting redirects to dashboard with correct TMs', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;

    // Fill in 1RM values
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

    // Submit form
    await page.getByRole('button', { name: /calculate/i }).click();

    // Should be redirected to dashboard
    await page.waitForURL('/', { timeout: 10000 });
    expect(page.url()).toContain('/');

    // Wait for dashboard to load
    await page.waitForSelector('text=Workout Days', { timeout: 5000 });

    // Navigate to settings to verify TMs
    await page.click('a[href="/settings"]');
    await page.waitForURL('/settings');
    await page.waitForSelector('text=Training Maxes');

    // Calculate expected TMs (90% of 1RMs, rounded to 2.5kg)
    const expectedTMs = {
      bench: Math.round((oneRepMaxes.bench * 0.9) / 2.5) * 2.5, // 90
      squat: Math.round((oneRepMaxes.squat * 0.9) / 2.5) * 2.5, // 125
      ohp: Math.round((oneRepMaxes.ohp * 0.9) / 2.5) * 2.5, // 55
      deadlift: Math.round((oneRepMaxes.deadlift * 0.9) / 2.5) * 2.5, // 162.5
    };

    // Verify TMs are displayed on settings page
    const pageContent = await page.textContent('body');
    expect(pageContent).toContain(expectedTMs.bench.toString());
    expect(pageContent).toContain(expectedTMs.squat.toString());
    expect(pageContent).toContain(expectedTMs.ohp.toString());
    expect(pageContent).toContain(expectedTMs.deadlift.toString());
  });

  test('editing a TM from settings updates the displayed value', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    // User should be on dashboard with TMs already set up
    expect(page.url()).toContain('/');

    // Navigate to settings to edit TMs
    await page.click('a[href="/settings"]');
    await page.waitForURL('/settings');
    await page.waitForSelector('text=Training Maxes', { timeout: 5000 });

    // Initial TM for bench should be 90kg (90% of 100kg)
    let pageContent = await page.textContent('body');
    expect(pageContent).toContain('90');

    // Find and click the Edit button for Bench
    const benchEditButton = page.locator('button', { hasText: 'Edit' }).first();
    await benchEditButton.click();

    // Modal should open with input
    const modalInput = page.getByRole('spinbutton');
    await expect(modalInput).toBeVisible();

    // Current value should be 90
    await expect(modalInput).toHaveValue('90');

    // Change to 95
    await modalInput.fill('95');

    // Click Save button
    await page.getByRole('button', { name: /save/i }).click();

    // Wait for modal to close and page to update
    await page.waitForTimeout(500);

    // Verify updated value is displayed
    pageContent = await page.textContent('body');
    expect(pageContent).toContain('95');
  });
});
