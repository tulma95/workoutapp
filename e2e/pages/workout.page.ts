import { expect, type Page } from '@playwright/test';

export class WorkoutPage {
  readonly page: Page;

  readonly repsInputs;
  readonly completeButton;
  readonly cancelButton;
  readonly backToDashboardButton;
  readonly confirmDialog;
  readonly progressionBanner;

  constructor(page: Page) {
    this.page = page;
    this.repsInputs = page.getByRole('spinbutton', { name: /reps completed/i });
    this.completeButton = page.getByRole('button', { name: /complete workout/i });
    this.cancelButton = page.getByRole('button', { name: /cancel workout/i });
    this.backToDashboardButton = page.getByRole('button', { name: /back to dashboard|dashboard/i });
    this.confirmDialog = page.locator('[data-testid="confirm-dialog"]');
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

  /** Confirm a set by tapping the + button on its stepper (auto-confirms pending sets) */
  async confirmSet(index: number) {
    const section = this.page.locator('[data-testid="set-row"]').nth(index);
    await section.getByRole('button', { name: /increase reps/i }).click();
  }

  async fillAmrap(value: string, index = 0) {
    const amrapRow = this.page.locator('[data-testid="set-row"][data-amrap]').nth(index);
    await amrapRow.getByRole('spinbutton', { name: /reps completed/i }).fill(value);
  }

  /** Fill AMRAP input and wait for the debounced PATCH to persist. */
  async fillAmrapAndWait(value: string, index = 0) {
    const responsePromise = this.page.waitForResponse(
      resp => resp.url().includes('/api/workouts/') && resp.request().method() === 'PATCH' && resp.ok(),
    );
    await this.fillAmrap(value, index);
    await responsePromise;
  }

  async toggleSet(index: number) {
    await this.confirmSet(index);
  }

  async complete() {
    await this.completeButton.click();
  }

  /** Complete workout, handling the confirmation dialog if it appears. */
  async completeWithDialog() {
    await this.completeButton.click();
    const dialog = this.confirmDialog;
    try {
      await expect(dialog).toBeVisible({ timeout: 2000 });
      await dialog.getByRole('button', { name: /complete anyway/i }).click();
    } catch {
      // Dialog didn't appear — workout completed directly
    }
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
