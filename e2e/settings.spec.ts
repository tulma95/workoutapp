import { test, expect } from './fixtures';

test.describe('Settings Page', () => {
  test('navigate to settings -> see current user info (display name, email, unit preference)', async ({ setupCompletePage }) => {
    const { page, user } = setupCompletePage;

    // Navigate to settings page via bottom nav
    await page.click('a[href="/settings"]');
    await page.waitForURL('/settings', { timeout: 10000 });

    // Verify display name is shown
    await expect(page.getByText(user.displayName)).toBeVisible();

    // Verify email is shown (contains '@example.com')
    await expect(page.getByText(new RegExp(user.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeVisible();

    // Verify unit preference buttons (kg and lb) are visible
    await expect(page.getByRole('button', { name: 'kg' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'lb' })).toBeVisible();
  });

  test('change unit preference from kg to lb -> saves successfully', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    // Navigate to settings page via bottom nav
    await page.click('a[href="/settings"]');
    await page.waitForURL('/settings', { timeout: 10000 });

    // Click the lb button to change unit preference
    await page.getByRole('button', { name: 'lb' }).click();

    // Verify 'Saved!' text appears within 3 seconds
    await expect(page.getByText('Saved!')).toBeVisible({ timeout: 3000 });
  });

  test('logout from settings page -> redirected to login page', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;

    // Navigate to settings page via bottom nav
    await page.click('a[href="/settings"]');
    await page.waitForURL('/settings', { timeout: 10000 });

    // Click logout button
    await page.getByRole('button', { name: /log out/i }).click();

    // Verify redirect to login page
    await page.waitForURL('/login', { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });
});
