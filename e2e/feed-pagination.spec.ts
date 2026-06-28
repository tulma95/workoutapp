import { test, expect, type Page } from '@playwright/test';
import { RegisterPage } from './pages/register.page';
import { PlanSelectionPage } from './pages/plan-selection.page';
import { SetupPage } from './pages/setup.page';

async function registerAndSetup(page: Page, email: string, username: string) {
  const register = new RegisterPage(page);
  await register.register(email, 'ValidPassword123', username);

  const planSelection = new PlanSelectionPage(page);
  await planSelection.selectFirstPlan();

  const setup = new SetupPage(page);
  await setup.expectHeading();
  await setup.fillOneRepMaxes('100', '140', '60', '180');
  await setup.submitAndWaitForDashboard();
}

/**
 * Creates `count` additional plan_switched feed events for user A by repeatedly
 * re-subscribing to their current plan. This is intentionally lightweight (one
 * API call per event) so the test doesn't cause resource contention when running
 * in parallel with other E2E tests inside the Docker container.
 *
 * registerAndSetup already emitted 1 plan_switched event; after this function
 * total plan_switched events for user A = 1 + count.
 */
async function seedPlanSwitchedEvents(
  page: Page,
  token: string,
  count: number,
): Promise<void> {
  // Fetch the current plan id so we can re-subscribe to it
  const planResp = await page.request.get('/api/plans/current', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!planResp.ok()) throw new Error(`GET /api/plans/current failed: ${planResp.status()}`);
  const planData = await planResp.json() as { id: number } | null;
  const planId = planData?.id;
  if (!planId) throw new Error('No active plan found for user A');

  for (let i = 0; i < count; i++) {
    const resp = await page.request.post(`/api/plans/${planId}/subscribe`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok()) {
      throw new Error(`Plan re-subscription ${i + 1} failed: ${resp.status()}`);
    }
  }
}

test.describe('Feed cursor pagination', () => {
  test.setTimeout(180000);

  test('Load more shows older events and button disappears when all pages are loaded', async ({
    browser,
    baseURL,
  }) => {
    const uniqueA = crypto.randomUUID().slice(0, 8);
    const uniqueB = crypto.randomUUID().slice(0, 8);
    const emailA = `pagfeed-a-${uniqueA}@example.com`;
    const emailB = `pagfeed-b-${uniqueB}@example.com`;
    const usernameA = `pagfa${uniqueA}`;
    const usernameB = `pagfb${uniqueB}`;

    const contextA = await browser.newContext({ baseURL });
    const contextB = await browser.newContext({ baseURL });
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // Register both users with plans and TMs
      await registerAndSetup(pageA, emailA, usernameA);
      await registerAndSetup(pageB, emailB, usernameB);

      // User A sends friend request to user B
      await pageA.getByRole('link', { name: /social/i }).click();
      await pageA.getByRole('link', { name: /friends/i }).click();
      await pageA.getByRole('button', { name: /send by email/i }).click();
      await pageA.getByLabel(/friend's email address/i).fill(emailB);
      await pageA.getByRole('button', { name: /^send$/i }).click();
      await expect(pageA.getByRole('status')).toContainText(/friend request sent/i);

      // User B accepts the friend request
      await pageB.getByRole('link', { name: /social/i }).click();
      await pageB.getByRole('link', { name: /friends/i }).click();
      const acceptButton = pageB.getByRole('button', {
        name: `Accept friend request from ${usernameA}`,
      });
      await expect(acceptButton).toBeVisible();
      await acceptButton.click();
      await expect(
        pageB.getByRole('list', { name: /friends list/i }).getByText(new RegExp(usernameA)),
      ).toBeVisible();

      // Get user A's token and seed plan_switched feed events via API.
      //
      // Event budget visible to user B:
      //   - A: 1 plan_switched (from registerAndSetup) + 21 extra = 22 events
      //   - B: 1 plan_switched (from registerAndSetup)
      //   Total: 23 events → page 1 = 20, page 2 = 3
      const tokenA = await pageA.evaluate(() => localStorage.getItem('accessToken'));
      if (!tokenA) throw new Error('No access token for user A');
      await seedPlanSwitchedEvents(pageA, tokenA, 21);

      // User B navigates to the Feed tab. refetchOnMount:'always' ensures
      // fresh data instead of any stale cache.
      await pageB.getByRole('link', { name: /feed/i }).click();

      // Wait for the feed list to appear and show at least one event
      await expect(pageB.getByRole('list', { name: /activity feed/i })).toBeVisible({
        timeout: 15000,
      });
      await expect(pageB.locator('[data-event-id]').first()).toBeVisible({ timeout: 15000 });

      // Initial page shows exactly 20 feed events (23 total → page size 20)
      await expect(pageB.locator('[data-event-id]')).toHaveCount(20, { timeout: 10000 });

      // The "Load more" button must be visible because there are more events
      const loadMoreButton = pageB.getByRole('button', { name: /load more/i });
      await expect(loadMoreButton).toBeVisible();

      // Record the count before clicking so we can verify it grows
      const countBefore = await pageB.locator('[data-event-id]').count();

      // Click Load more — fetches the second (final) page
      await loadMoreButton.click();

      // The event count must exceed the previous count once the page loads
      await expect(async () => {
        const count = await pageB.locator('[data-event-id]').count();
        expect(count).toBeGreaterThan(countBefore);
      }).toPass({ timeout: 10000 });

      // The "Load more" button must now be gone — only 2 pages exist
      await expect(pageB.getByRole('button', { name: /load more/i })).not.toBeVisible({
        timeout: 5000,
      });
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
