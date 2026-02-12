import { test, expect } from './fixtures';

test.describe('Cancel Workout', () => {
  test('starting a workout, clicking Cancel, accepting dialog redirects to dashboard', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    // Wait for dashboard to load
    await page.waitForSelector('text=Training Maxes');

    // Start Day 1 workout
    await page.getByRole('button', { name: /start workout/i }).first().click();
    await page.waitForURL(/\/workout\/\d+/);

    // Wait for the workout to load
    await expect(page.getByRole('heading', { name: /day 1/i })).toBeVisible({ timeout: 15000 });

    // Set up dialog handler to accept the confirmation
    let dialogMessage = '';
    page.on('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Click "Cancel Workout" button
    await page.getByRole('button', { name: /cancel workout/i }).click();

    // Give time for dialog to appear
    await page.waitForTimeout(500);

    // Verify the confirmation dialog appeared with warning text
    expect(dialogMessage.toLowerCase()).toContain('cancel');
    expect(dialogMessage.toLowerCase()).toContain('progress');

    // Wait for redirect to dashboard
    await page.waitForURL('/', { timeout: 5000 });

    // Verify we're on the dashboard
    await expect(page.getByText('Training Maxes')).toBeVisible();
  });

  test('cancel workout returns success response', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    // Wait for dashboard to load
    await page.waitForSelector('text=Training Maxes');

    // Start Day 1 workout
    await page.getByRole('button', { name: /start workout/i }).first().click();
    await page.waitForURL(/\/workout\/\d+/);

    // Wait for the workout to load
    await expect(page.getByRole('heading', { name: /day 1/i })).toBeVisible({ timeout: 15000 });

    // Set up dialog handler to accept the cancel confirmation
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Set up a promise to wait for the DELETE request to complete
    const deleteResponsePromise = page.waitForResponse(
      response => response.url().includes('/api/workouts/') && response.request().method() === 'DELETE',
      { timeout: 10000 }
    );

    // Cancel the workout
    await page.getByRole('button', { name: /cancel workout/i }).click();

    // Wait for the DELETE request to complete
    const deleteResponse = await deleteResponsePromise;

    // Verify the DELETE was successful with correct response
    expect(deleteResponse.status()).toBe(200);
    const deleteBody = await deleteResponse.json();
    expect(deleteBody.success).toBe(true);

    // Wait for redirect to dashboard after cancel
    await page.waitForURL('/', { timeout: 10000 });

    // Verify we're back on the dashboard
    await page.waitForSelector('text=Training Maxes');
    expect(page.url()).toMatch(/\/$/);
  });

  test('clicking Cancel, dismissing dialog keeps user on workout page', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    // Wait for dashboard to load
    await page.waitForSelector('text=Training Maxes');

    // Start Day 1 workout
    await page.getByRole('button', { name: /start workout/i }).first().click();
    await page.waitForURL(/\/workout\/\d+/);

    // Wait for the workout to load
    await expect(page.getByRole('heading', { name: /day 1/i })).toBeVisible({ timeout: 15000 });

    // Set up dialog handler to DISMISS the confirmation
    page.on('dialog', async (dialog) => {
      await dialog.dismiss();
    });

    // Click "Cancel Workout" button
    await page.getByRole('button', { name: /cancel workout/i }).click();

    // Give time for dialog to appear and be dismissed
    await page.waitForTimeout(500);

    // Verify we're still on the workout page (URL should not change)
    expect(page.url()).toMatch(/\/workout\/\d+/);

    // Verify workout page is still visible
    await expect(page.getByRole('heading', { name: /day 1/i })).toBeVisible();

    // Verify sets are still visible
    const checkboxes = page.getByRole('checkbox');
    const checkboxCount = await checkboxes.count();
    expect(checkboxCount).toBeGreaterThan(0);
  });
});
