import { expect, type Page } from '@playwright/test';

export class SettingsPage {
  readonly page: Page;

  readonly trainingMaxesHeading;
  readonly logoutButton;
  readonly scheduleHeading;

  constructor(page: Page) {
    this.page = page;
    this.trainingMaxesHeading = page.getByRole('heading', { name: 'Training Maxes' });
    this.logoutButton = page.getByRole('button', { name: /log out/i });
    this.scheduleHeading = page.getByRole('heading', { name: /training schedule/i });
  }

  get scheduleSection() {
    return this.page.locator('section', {
      has: this.page.getByRole('heading', { name: /training schedule/i }),
    });
  }

  async navigate() {
    await this.page.getByRole('link', { name: /settings/i }).click();
  }

  async expectLoaded() {
    await expect(this.trainingMaxesHeading).toBeVisible();
  }

  async logout() {
    await this.logoutButton.click();
    await expect(this.page.getByRole('heading', { name: /log in/i })).toBeVisible();
  }

  getTMText(exerciseName: string) {
    return this.page.locator(`text=${exerciseName}`).locator('..');
  }

  async expectScheduleSectionVisible() {
    await expect(this.scheduleHeading).toBeVisible();
  }

  /**
   * Select a weekday for the nth plan day (0-indexed) in the schedule editor.
   * @param dayIndex - 0-based index of the plan day row
   * @param weekdayValue - weekday value as string ('1'=Monday … '0'=Sunday, ''=Not scheduled)
   */
  async selectWeekdayForPlanDay(dayIndex: number, weekdayValue: string) {
    await this.scheduleSection.getByRole('combobox').nth(dayIndex).selectOption(weekdayValue);
  }

  /**
   * Click "Save Schedule", wait for the PUT /api/schedule response, and wait for the button
   * to return to enabled state. Returns the Playwright Response object.
   */
  async saveSchedule() {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (r) => r.url().includes('/api/schedule') && r.request().method() === 'PUT',
      ),
      this.page.getByRole('button', { name: /save schedule/i }).click(),
    ]);
    await expect(this.page.getByRole('button', { name: /save schedule/i })).toBeEnabled();
    return response;
  }

  async editTM(index: number, newValue: string, reason?: string) {
    const editButton = this.page.locator('button', { hasText: 'Edit' }).nth(index);
    await editButton.click();

    const modalInput = this.page.getByRole('spinbutton');
    await expect(modalInput).toBeVisible();
    await modalInput.fill(newValue);

    if (reason !== undefined) {
      const reasonTextarea = this.page.getByLabel(/reason/i);
      await reasonTextarea.fill(reason);
    }

    await this.page.getByRole('dialog').getByRole('button', { name: /^save$/i }).click();

    await expect(this.page.getByRole('dialog')).not.toBeVisible();
  }
}
