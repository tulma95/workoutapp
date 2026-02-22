import { expect, type Page } from '@playwright/test';

export class WorkoutPage {
  readonly page: Page;

  readonly repsInputs;
  readonly completeButton;
  readonly cancelButton;
  readonly backToDashboardButton;
  readonly confirmDialog;
  readonly progressionBanner;
  readonly restTimerBanner;
  readonly skipRestButton;
  readonly increaseRestButton;
  readonly decreaseRestButton;

  readonly achievementDialog;

  constructor(page: Page) {
    this.page = page;
    this.repsInputs = page.getByTestId('reps-value');
    this.completeButton = page.getByRole('button', { name: /complete workout/i });
    this.cancelButton = page.getByRole('button', { name: /cancel workout/i });
    this.backToDashboardButton = page.getByRole('link', { name: 'Back to Dashboard' });
    this.confirmDialog = page.locator('[data-testid="confirm-dialog"]');
    this.achievementDialog = page.getByTestId('achievement-dialog');
    this.progressionBanner = page.getByText(/progression|increase|bench.*\+/i);
    this.restTimerBanner = page.getByTestId('rest-timer');
    this.skipRestButton = page.getByRole('button', { name: /skip/i });
    this.increaseRestButton = page.getByRole('button', { name: /increase rest/i });
    this.decreaseRestButton = page.getByRole('button', { name: /decrease rest/i });
  }

  /** Dismiss the achievement dialog if it is currently open. Call after completeWithDialog(). */
  async dismissAchievementDialogIfPresent() {
    if (await this.achievementDialog.isVisible()) {
      await this.achievementDialog.getByRole('button', { name: /awesome/i }).click();
      await expect(this.achievementDialog).not.toBeVisible();
    }
  }

  dayHeading(dayNumber: number) {
    return this.page.getByRole('heading', { name: new RegExp(`day ${dayNumber}`, 'i') });
  }

  async expectLoaded(dayNumber?: number) {
    const heading = dayNumber
      ? this.dayHeading(dayNumber)
      : this.page.getByRole('heading', { name: /day \d/i });
    await expect(heading).toBeVisible();
  }

  /** Confirm a set by tapping the + button on its stepper (auto-confirms pending sets) */
  async confirmSet(index: number) {
    const section = this.page.locator('[data-testid="set-row"]').nth(index);
    await section.getByRole('button', { name: /increase reps/i }).click();
  }

  async fillAmrap(value: string, index = 0) {
    const amrapRow = this.page.locator('[data-testid="set-row"][data-amrap]').nth(index);
    const targetValue = parseInt(value, 10);

    // Tap confirm button to set initial value (targetReps)
    const confirmButton = amrapRow.getByRole('button', { name: /confirm reps/i });
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }

    // Read current value and use +/- to reach target
    const repsDisplay = amrapRow.getByTestId('reps-value');
    let currentValue = parseInt(await repsDisplay.textContent() || '0', 10);

    const plusButton = amrapRow.getByRole('button', { name: /increase reps/i });
    const minusButton = amrapRow.getByRole('button', { name: /decrease reps/i });

    while (currentValue < targetValue) {
      await plusButton.click();
      currentValue++;
    }
    while (currentValue > targetValue) {
      await minusButton.click();
      currentValue--;
    }
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

  /** Complete workout, handling the confirmation dialog if it appears. Waits for the workout-complete state. */
  async completeWithDialog() {
    await this.completeButton.click();
    await expect(this.confirmDialog.or(this.backToDashboardButton).or(this.achievementDialog)).toBeVisible();
    if (await this.confirmDialog.isVisible()) {
      await this.confirmDialog.getByRole('button', { name: /complete anyway/i }).click();
      // Wait for the page to transition to the workout-complete state.
      // Also accept achievementDialog: WebKit's showModal() marks backToDashboardButton inert.
      await expect(this.backToDashboardButton.or(this.achievementDialog)).toBeVisible();
    }
  }

  async cancel() {
    await this.cancelButton.click();
  }

  async goBackToDashboard() {
    await this.dismissAchievementDialogIfPresent();
    await expect(this.backToDashboardButton).toBeVisible();
    await this.backToDashboardButton.click();
  }
}
