import { test, expect } from './fixtures';

test.describe('Cancel Workout', () => {
  test('starting a workout, clicking Cancel, accepting dialog redirects to dashboard', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    await expect(page.getByText('Workout Days')).toBeVisible();

    await page.getByRole('button', { name: /start workout/i }).first().click();
    await page.waitForURL(/\/workout\/\d+/);
    await expect(page.getByRole('heading', { name: /day 1/i })).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: /cancel workout/i }).click();

    const dialog = page.locator('.confirm-dialog__content');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.confirm-dialog__message')).toContainText(/cancel/i);
    await expect(dialog.locator('.confirm-dialog__message')).toContainText(/progress/i);

    await dialog.getByRole('button', { name: /cancel workout/i }).click();

    await page.waitForURL('/');
    await expect(page.getByText('Workout Days')).toBeVisible();
  });

  test('cancel workout returns success response', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    await expect(page.getByText('Workout Days')).toBeVisible();

    await page.getByRole('button', { name: /start workout/i }).first().click();
    await page.waitForURL(/\/workout\/\d+/);
    await expect(page.getByRole('heading', { name: /day 1/i })).toBeVisible({ timeout: 15000 });

    const deleteResponsePromise = page.waitForResponse(
      response => response.url().includes('/api/workouts/') && response.request().method() === 'DELETE',
      { timeout: 10000 }
    );

    await page.getByRole('button', { name: /cancel workout/i }).click();
    const dialog = page.locator('.confirm-dialog__content');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /cancel workout/i }).click();

    const deleteResponse = await deleteResponsePromise;
    expect(deleteResponse.status()).toBe(200);
    const deleteBody = await deleteResponse.json();
    expect(deleteBody.success).toBe(true);

    await page.waitForURL('/');
    await expect(page.getByText('Workout Days')).toBeVisible();
  });

  test('clicking Cancel, dismissing dialog keeps user on workout page', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    await expect(page.getByText('Workout Days')).toBeVisible();

    await page.getByRole('button', { name: /start workout/i }).first().click();
    await page.waitForURL(/\/workout\/\d+/);
    await expect(page.getByRole('heading', { name: /day 1/i })).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: /cancel workout/i }).click();

    const dialog = page.locator('.confirm-dialog__content');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /^cancel$/i }).click();

    expect(page.url()).toMatch(/\/workout\/\d+/);
    await expect(page.getByRole('heading', { name: /day 1/i })).toBeVisible();
    expect(await page.getByRole('checkbox').count()).toBeGreaterThan(0);
  });
});
