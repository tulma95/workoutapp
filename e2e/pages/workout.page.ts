import { expect, type Page } from '@playwright/test';

export class WorkoutPage {
  readonly page: Page;

  readonly checkboxes;
  readonly amrapInputs;
  readonly completeButton;
  readonly cancelButton;
  readonly backToDashboardButton;
  readonly confirmDialog;
  readonly progressionBanner;

  constructor(page: Page) {
    this.page = page;
    this.checkboxes = page.getByRole('checkbox');
    this.amrapInputs = page.getByRole('spinbutton');
    this.completeButton = page.getByRole('button', { name: /complete workout/i });
    this.cancelButton = page.getByRole('button', { name: /cancel workout/i });
    this.backToDashboardButton = page.getByRole('button', { name: /back to dashboard|dashboard/i });
    this.confirmDialog = page.locator('.confirm-dialog__content');
    this.progressionBanner = page.getByText(/progression|increase|bench.*\+/i);
  }

  dayHeading(dayNumber: number) {
    return this.page.getByRole('heading', { name: new RegExp(`day ${dayNumber}`, 'i') });
  }

  async expectLoaded(dayNumber?: number) {
    const heading = dayNumber
      ? this.dayHeading(dayNumber)
      : this.page.getByRole('heading', { name: /day \d/i });
    await expect(heading).toBeVisible({ timeout: 15000 });
  }

  async fillAmrap(value: string, index = 0) {
    await this.amrapInputs.nth(index).fill(value);
  }

  async toggleSet(index: number) {
    await this.checkboxes.nth(index).click();
  }

  async complete() {
    await this.completeButton.click();
  }

  async cancel() {
    await this.cancelButton.click();
  }

  async goBackToDashboard() {
    await expect(this.backToDashboardButton).toBeVisible();
    await this.backToDashboardButton.click();
    await this.page.waitForURL('/');
  }
}
