import { expect, type Page } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;

  readonly workoutDaysHeading;

  constructor(page: Page) {
    this.page = page;
    this.workoutDaysHeading = page.getByText('Workout Days');
  }

  async expectLoaded() {
    await expect(this.workoutDaysHeading).toBeVisible();
  }

  getDayCard(dayNumber: number) {
    return this.page.locator('[data-testid="workout-card"]').filter({
      has: this.page.getByRole('heading', { name: `Day ${dayNumber}` }),
    });
  }

  async startWorkout(dayNumber?: number) {
    if (dayNumber) {
      await this.getDayCard(dayNumber).getByRole('button', { name: /start workout/i }).click();
    } else {
      await this.page.getByRole('button', { name: /start workout/i }).first().click();
    }
  }

  async continueWorkout(dayNumber?: number) {
    if (dayNumber) {
      await this.getDayCard(dayNumber).getByRole('button').click();
    } else {
      await this.page.getByRole('button', { name: /continue workout|start workout/i }).first().click();
    }
  }
}
