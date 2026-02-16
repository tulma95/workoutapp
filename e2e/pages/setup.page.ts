import { expect, type Page } from '@playwright/test';

export class SetupPage {
  readonly page: Page;

  readonly heading;
  readonly formGroups;
  readonly calculateButton;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /enter your 1 rep maxes/i });
    this.formGroups = page.locator('.form-group');
    this.calculateButton = page.getByRole('button', { name: /calculate/i });
  }

  async expectHeading() {
    await expect(this.heading).toBeVisible();
    await expect(this.formGroups).toHaveCount(4);
  }

  getExerciseInput(name: string) {
    return this.page.getByLabel(new RegExp(name, 'i'));
  }

  async fillOneRepMaxes(bench: string, squat: string, ohp: string, deadlift: string) {
    await this.page.getByLabel(/Bench Press/i).fill(bench);
    await this.page.getByLabel(/^Squat/i).fill(squat);
    await this.page.getByLabel(/Overhead Press/i).fill(ohp);
    await this.page.getByLabel(/^Deadlift/i).fill(deadlift);
  }

  async submitAndWaitForDashboard() {
    await this.calculateButton.click();
    await this.page.waitForURL('/');
  }
}
