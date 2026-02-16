import { type Page } from '@playwright/test';

export class PlanSelectionPage {
  readonly page: Page;

  readonly selectPlanButtons;

  constructor(page: Page) {
    this.page = page;
    this.selectPlanButtons = page.getByRole('button', { name: /select plan/i });
  }

  async selectFirstPlan() {
    await this.page.waitForURL('/select-plan');
    await this.selectPlanButtons.first().click();
    await this.page.waitForURL(/\/setup/);
  }
}
