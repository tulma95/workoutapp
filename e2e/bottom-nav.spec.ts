import { test, expect } from './fixtures';

test.describe('Bottom navbar - mobile viewport', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('bottom nav links are visible and navigable on mobile', async ({ setupCompletePage: { page } }) => {
    // Verify all nav links are visible
    const homeLink = page.getByRole('link', { name: /home/i });
    const historyLink = page.getByRole('link', { name: /history/i });
    const progressLink = page.getByRole('link', { name: /progress/i });
    const socialLink = page.getByRole('link', { name: /social/i });
    const settingsLink = page.getByRole('link', { name: /settings/i });

    await expect(homeLink).toBeVisible();
    await expect(historyLink).toBeVisible();
    await expect(progressLink).toBeVisible();
    await expect(socialLink).toBeVisible();
    await expect(settingsLink).toBeVisible();

    // Navigate to History via bottom nav
    await historyLink.click();
    await expect(page).toHaveURL(/\/history/);

    // Navigate to Progress via bottom nav
    await progressLink.click();
    await expect(page).toHaveURL(/\/progress/);

    // Navigate to Settings via bottom nav
    await settingsLink.click();
    await expect(page).toHaveURL(/\/settings/);

    // Navigate back to Home via bottom nav
    await homeLink.click();
    await expect(page).toHaveURL('/');
  });

  test('viewport-fit=cover is set in the HTML meta viewport tag', async ({ page }) => {
    await page.goto('/');
    const viewportMeta = page.locator('meta[name="viewport"]');
    await expect(viewportMeta).toHaveAttribute('content', /viewport-fit=cover/);
  });
});
