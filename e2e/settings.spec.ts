import { test, expect } from './fixtures';
import { SettingsPage } from './pages/settings.page';

test.describe('Settings Page', () => {
  test('navigate to settings -> see current user info (display name, email)', async ({ setupCompletePage }) => {
    const { page, user } = setupCompletePage;
    const settings = new SettingsPage(page);

    await settings.navigate();

    await expect(page.getByText(user.displayName)).toBeVisible();
    await expect(page.getByText(new RegExp(user.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeVisible();
  });

  test('logout from settings page -> redirected to login page', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const settings = new SettingsPage(page);

    await settings.navigate();
    await settings.logout();
    expect(page.url()).toContain('/login');
  });
});
