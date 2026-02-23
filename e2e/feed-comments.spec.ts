import { test, expect, type Page } from '@playwright/test';
import { RegisterPage } from './pages/register.page';
import { PlanSelectionPage } from './pages/plan-selection.page';
import { SetupPage } from './pages/setup.page';
import { WorkoutPage } from './pages/workout.page';

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

async function setupFriendship(
  pageA: Page,
  pageB: Page,
  emailB: string,
  usernameA: string,
) {
  // userA sends friend request to userB
  await pageA.getByRole('link', { name: /social/i }).click();
  await expect(pageA.getByRole('heading', { name: /social/i })).toBeVisible();
  await pageA.getByRole('link', { name: /friends/i }).click();
  await pageA.getByRole('button', { name: /send by email/i }).click();

  await expect(pageA.getByLabel(/friend's email address/i)).toBeVisible();
  await pageA.getByLabel(/friend's email address/i).fill(emailB);
  await pageA.getByRole('button', { name: /^send$/i }).click();

  await expect(pageA.getByRole('status')).toContainText(/friend request sent/i);

  // userB accepts
  await pageB.getByRole('link', { name: /social/i }).click();
  await expect(pageB.getByRole('heading', { name: /social/i })).toBeVisible();
  await pageB.getByRole('link', { name: /friends/i }).click();

  const acceptButton = pageB.getByRole('button', {
    name: `Accept friend request from ${usernameA}`,
  });
  await expect(acceptButton).toBeVisible();
  await acceptButton.click();
  await expect(pageB.getByRole('list', { name: /friends list/i }).getByText(new RegExp(usernameA))).toBeVisible();
}

async function completeWorkoutAsA(pageA: Page) {
  await pageA.getByRole('link', { name: /home/i }).click();
  await expect(pageA.getByText('Workout Days')).toBeVisible();
  await pageA.getByRole('link', { name: /start workout/i }).first().click();
  const workout = new WorkoutPage(pageA);
  await expect(workout.completeButton).toBeVisible({ timeout: 15000 });
  await workout.completeWithDialog();
  await workout.dismissAchievementDialogIfPresent();
  await expect(workout.backToDashboardButton).toBeVisible({ timeout: 10000 });
}

test.describe('Feed comments (inline UI)', () => {
  test.setTimeout(90000);

  test("B can comment on A's event inline and delete it", async ({ browser, baseURL }) => {
    const uniqueA = crypto.randomUUID().slice(0, 8);
    const uniqueB = crypto.randomUUID().slice(0, 8);
    const emailA = `comment-a-${uniqueA}@example.com`;
    const emailB = `comment-b-${uniqueB}@example.com`;
    const usernameA = `alpha${uniqueA}`;
    const usernameB = `beta${uniqueB}`;

    const contextA = await browser.newContext({ baseURL });
    const contextB = await browser.newContext({ baseURL });
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await registerAndSetup(pageA, emailA, usernameA);
      await registerAndSetup(pageB, emailB, usernameB);

      await setupFriendship(pageA, pageB, emailB, usernameA);
      await completeWorkoutAsA(pageA);

      // B navigates to Social page and then the Feed tab
      await pageB.getByRole('link', { name: /social/i }).click();
      await expect(pageB.getByRole('heading', { name: /social/i })).toBeVisible();
      await pageB.getByRole('link', { name: /feed/i }).click();
      await expect(
        pageB.getByText(new RegExp(`${usernameA}.*completed Day`, 'i')),
      ).toBeVisible({ timeout: 10000 });

      // (b) Comment input is already visible without any clicking
      const commentInput = pageB.getByLabel('Add a comment').first();
      await expect(commentInput).toBeVisible();

      // (c) Post "First comment"
      await commentInput.fill('First comment');
      await pageB.getByRole('button', { name: 'Post' }).first().click();
      await expect(pageB.getByText('First comment')).toBeVisible({ timeout: 5000 });

      // Post "Second comment"
      await commentInput.fill('Second comment');
      await pageB.getByRole('button', { name: 'Post' }).first().click();
      await expect(pageB.getByText('Second comment')).toBeVisible({ timeout: 5000 });

      // Post "Third comment"
      await commentInput.fill('Third comment');
      await pageB.getByRole('button', { name: 'Post' }).first().click();
      await expect(pageB.getByText('Third comment')).toBeVisible({ timeout: 5000 });

      // (d) After 3 comments, "View all 3 comments" button should appear
      await expect(pageB.getByRole('button', { name: 'View all 3 comments' }).first()).toBeVisible({
        timeout: 5000,
      });

      // Switch to Friends tab then back to Feed to force refetch (refetchOnMount: 'always')
      await pageB.getByRole('link', { name: /friends/i }).click();
      await pageB.getByRole('link', { name: /feed/i }).click();
      await expect(
        pageB.getByText(new RegExp(`${usernameA}.*completed Day`, 'i')),
      ).toBeVisible({ timeout: 10000 });

      // (a) After reload: only last 2 comments visible inline (Second, Third), First is not
      await expect(pageB.getByText('Second comment')).toBeVisible({ timeout: 5000 });
      await expect(pageB.getByText('Third comment')).toBeVisible({ timeout: 5000 });
      await expect(pageB.getByText('First comment')).toHaveCount(0);

      // (d) "View all 3 comments" button is visible; clicking it expands the full list inline
      const viewAllBtn = pageB.getByRole('button', { name: 'View all 3 comments' }).first();
      await expect(viewAllBtn).toBeVisible();
      await viewAllBtn.click();
      await expect(pageB.getByText('First comment')).toBeVisible({ timeout: 5000 });
      // After expand, view-all button should be gone
      await expect(pageB.getByRole('button', { name: 'View all 3 comments' })).toHaveCount(0);

      // (e own comment) B sees delete button on "Third comment" and deletes it
      const deleteThirdBtn = pageB.getByRole('button', {
        name: `Delete comment by ${usernameB}`,
      }).last();
      await expect(deleteThirdBtn).toBeVisible();
      await deleteThirdBtn.click();
      await expect(pageB.getByText('Third comment')).toHaveCount(0, { timeout: 5000 });

      // (f) B clicks the "💬 Comment" action button and the comment input gets focused
      const commentActionBtn = pageB.getByRole('button', { name: /^comment$/i }).first();
      await expect(commentActionBtn).toBeVisible();
      await commentActionBtn.click();
      await expect(pageB.getByLabel('Add a comment').first()).toBeFocused({ timeout: 3000 });
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("A (event owner) sees delete button on B's comment", async ({ browser, baseURL }) => {
    const uniqueA = crypto.randomUUID().slice(0, 8);
    const uniqueB = crypto.randomUUID().slice(0, 8);
    const emailA = `comment-oa-${uniqueA}@example.com`;
    const emailB = `comment-ob-${uniqueB}@example.com`;
    const usernameA = `alpha${uniqueA}`;
    const usernameB = `beta${uniqueB}`;

    const contextA = await browser.newContext({ baseURL });
    const contextB = await browser.newContext({ baseURL });
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await registerAndSetup(pageA, emailA, usernameA);
      await registerAndSetup(pageB, emailB, usernameB);

      await setupFriendship(pageA, pageB, emailB, usernameA);
      await completeWorkoutAsA(pageA);

      // B navigates to Feed and posts a comment on A's event
      await pageB.getByRole('link', { name: /social/i }).click();
      await expect(pageB.getByRole('heading', { name: /social/i })).toBeVisible();
      await pageB.getByRole('link', { name: /feed/i }).click();
      await expect(
        pageB.getByText(new RegExp(`${usernameA}.*completed Day`, 'i')),
      ).toBeVisible({ timeout: 10000 });

      const commentInput = pageB.getByLabel('Add a comment').first();
      await expect(commentInput).toBeVisible();
      await commentInput.fill('Hello from B');
      await pageB.getByRole('button', { name: 'Post' }).first().click();
      await expect(pageB.getByText('Hello from B')).toBeVisible({ timeout: 5000 });

      // A navigates to their own Social page Feed tab
      await pageA.getByRole('link', { name: /social/i }).click();
      await expect(pageA.getByRole('heading', { name: /social/i })).toBeVisible();
      await pageA.getByRole('link', { name: /feed/i }).click();
      await expect(
        pageA.getByText(new RegExp(`${usernameA}.*completed Day`, 'i')),
      ).toBeVisible({ timeout: 10000 });
      await expect(pageA.getByText('Hello from B')).toBeVisible({ timeout: 5000 });

      // (e owner) A sees delete button on B's comment even though B posted it
      const deleteBtnForA = pageA.getByRole('button', {
        name: `Delete comment by ${usernameB}`,
      }).first();
      await expect(deleteBtnForA).toBeVisible();
      await deleteBtnForA.click();

      // Comment disappears
      await expect(pageA.getByText('Hello from B')).toHaveCount(0, { timeout: 5000 });
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
