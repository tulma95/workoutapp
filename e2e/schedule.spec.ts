import { test, expect } from './fixtures';
import { SettingsPage } from './pages/settings.page';
import { HistoryPage } from './pages/history.page';
import { createSecondPlan } from './helpers/create-second-plan';
import type { Page } from '@playwright/test';

/**
 * Returns the dates (1–31) in the current month that fall on `weekday`
 * (0 = Sunday, 1 = Monday, …, 6 = Saturday).
 */
function getDatesForWeekday(weekday: number): number[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dates: number[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(year, month, d).getDay() === weekday) {
      dates.push(d);
    }
  }
  return dates;
}

/**
 * Polls until the `[data-testid="calendar-scheduled-day"]` day-numbers exactly match
 * `expectedDates` (order-independent). The first `<span>` inside each button holds the
 * calendar date number.
 */
async function expectScheduledDates(page: Page, expectedDates: number[]) {
  const sorted = [...expectedDates].sort((a, b) => a - b);
  await expect
    .poll(
      async () =>
        await page.locator('[data-testid="calendar-scheduled-day"]').evaluateAll((btns) =>
          btns
            .map((btn) => parseInt(btn.querySelector('span')?.textContent?.trim() ?? '0', 10))
            .sort((a: number, b: number) => a - b),
        ),
      { timeout: 8000 },
    )
    .toEqual(sorted);
}

test.describe('Workout Schedule', () => {
  test('schedule section visible in Settings with active plan', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const settings = new SettingsPage(page);

    await settings.navigate();
    await settings.expectLoaded();

    await settings.expectScheduleSectionVisible();
    await expect(settings.scheduleSection.getByRole('combobox').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /save schedule/i })).toBeVisible();
  });

  test('set Day 1 to Monday, save, verify success feedback', async ({ setupCompletePage }) => {
    const { page } = setupCompletePage;
    const settings = new SettingsPage(page);

    await settings.navigate();
    await settings.expectLoaded();

    // Set first plan day to Monday (weekday value = 1)
    await settings.selectWeekdayForPlanDay(0, '1');

    const response = await settings.saveSchedule();
    expect(response.ok()).toBeTruthy();

    // Button is back to enabled state (save completed successfully)
    await expect(page.getByRole('button', { name: /save schedule/i })).toBeEnabled();
    // No duplicate-weekday alert is visible
    await expect(page.getByRole('alert')).not.toBeVisible();
  });

  test('saved Monday schedule shows scheduled indicators on History calendar', async ({
    setupCompletePage,
  }) => {
    const { page } = setupCompletePage;
    const settings = new SettingsPage(page);
    const history = new HistoryPage(page);

    // Save Day 1 = Monday
    await settings.navigate();
    await settings.expectLoaded();
    await settings.selectWeekdayForPlanDay(0, '1');
    await settings.saveSchedule();

    // Navigate to History and wait for the calendar to fetch fresh data
    const calendarFetch = page.waitForResponse(
      (r) => r.url().includes('/api/workouts/calendar') && r.ok(),
    );
    await history.navigate();
    await calendarFetch;

    // Scheduled days should exactly match all Mondays in the current month
    await expectScheduledDates(page, getDatesForWeekday(1));
  });

  test('saving new schedule replaces previous weekday assignment on calendar', async ({
    setupCompletePage,
  }) => {
    const { page } = setupCompletePage;
    const settings = new SettingsPage(page);
    const history = new HistoryPage(page);

    // Step 1: Save Day 1 = Monday
    await settings.navigate();
    await settings.expectLoaded();
    await settings.selectWeekdayForPlanDay(0, '1');
    await settings.saveSchedule();

    // Step 2: Navigate to History and verify Monday indicators
    let calendarFetch = page.waitForResponse(
      (r) => r.url().includes('/api/workouts/calendar') && r.ok(),
    );
    await history.navigate();
    await calendarFetch;
    await expectScheduledDates(page, getDatesForWeekday(1));

    // Step 3: Navigate back to Settings and change Day 1 to Wednesday
    await settings.navigate();
    await settings.expectLoaded();
    await settings.selectWeekdayForPlanDay(0, '3'); // Wednesday = 3
    await settings.saveSchedule();

    // Step 4: Navigate to History and verify Wednesday indicators appear, Monday gone
    calendarFetch = page.waitForResponse(
      (r) => r.url().includes('/api/workouts/calendar') && r.ok(),
    );
    await history.navigate();
    await calendarFetch;

    // Scheduled days should now be Wednesdays, not Mondays
    await expectScheduledDates(page, getDatesForWeekday(3));

    // Confirm Monday dates are no longer showing as scheduled
    const scheduledDates = await page
      .locator('[data-testid="calendar-scheduled-day"]')
      .evaluateAll((btns) =>
        btns.map((btn) => parseInt(btn.querySelector('span')?.textContent?.trim() ?? '0', 10)),
      );
    for (const monday of getDatesForWeekday(1)) {
      expect(scheduledDates).not.toContain(monday);
    }
  });

  test('after switching plans, schedule editor shows empty state for new plan', async ({
    setupCompletePage,
  }) => {
    test.setTimeout(60000);
    const { page } = setupCompletePage;
    const settings = new SettingsPage(page);

    // Step 1: Save a schedule for the current plan (nSuns) — Day 1 = Monday
    await settings.navigate();
    await settings.expectLoaded();
    await settings.selectWeekdayForPlanDay(0, '1');
    await settings.saveSchedule();

    // Step 2: Create a second plan (promotes user to admin, re-logs in, creates plan via API)
    await createSecondPlan(page);

    // Step 3: Navigate to Settings → Change Plan → select Simple Test Plan → confirm switch
    await settings.navigate();
    await settings.expectLoaded();
    await page.getByRole('link', { name: /change plan/i }).click();
    await expect(page.getByRole('heading', { name: /choose a workout plan/i })).toBeVisible();

    await page
      .getByRole('heading', { name: 'Simple Test Plan', exact: true })
      .locator('..')
      .locator('..')
      .getByRole('button', { name: /select plan/i })
      .click();

    await expect(page.getByRole('button', { name: /confirm switch/i })).toBeVisible();
    await page.getByRole('button', { name: /confirm switch/i }).click();

    // Should land on Dashboard (bench/squat TMs carry over, no setup needed)
    await expect(page.getByText('Workout Days')).toBeVisible();

    // Step 4: Navigate to Settings and verify schedule section is empty for the new plan
    await settings.navigate();
    await settings.expectLoaded();
    await settings.expectScheduleSectionVisible();

    // All schedule selects should show "Not scheduled" (empty value) — new plan has no schedule
    const selects = settings.scheduleSection.getByRole('combobox');
    const count = await selects.count();
    expect(count).toBeGreaterThan(0); // New plan still has training days

    for (let i = 0; i < count; i++) {
      await expect(selects.nth(i)).toHaveValue('');
    }

    // No error message about the schedule being deleted
    await expect(page.getByText(/schedule.*deleted|deleted.*schedule/i)).not.toBeVisible();
  });
});
