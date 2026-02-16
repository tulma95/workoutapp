import { test, expect } from './fixtures';

test.describe('Settings Page', () => {
  test('navigate to settings -> see current user info (display name, email, unit preference)', async ({ setupCompletePage }) => {
    const { page, user } = setupCompletePage;

    await page.getByRole('link', { name: /settings/i }).click();
    await page.waitForURL('/settings');

    await expect(page.getByText(user.displayName)).toBeVisible();
    await expect(page.getByText(new RegExp(user.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeVisible();
    await expect(page.getByRole('button', { name: 'kg' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'lb' })).toBeVisible();
  });

  test('change unit preference from kg to lb -> saves successfully', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    await page.getByRole('link', { name: /settings/i }).click();
    await page.waitForURL('/settings');

    await page.getByRole('button', { name: 'lb' }).click();
    await expect(page.getByText('Saved!')).toBeVisible({ timeout: 3000 });
  });

  test('logout from settings page -> redirected to login page', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    await page.getByRole('link', { name: /settings/i }).click();
    await page.waitForURL('/settings');

    await page.getByRole('button', { name: /log out/i }).click();
    await page.waitForURL('/login');
    expect(page.url()).toContain('/login');
  });
});
