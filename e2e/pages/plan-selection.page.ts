import { type Page } from '@playwright/test';

export class PlanSelectionPage {
  readonly page: Page;

  readonly selectPlanButtons;

  constructor(page: Page) {
    this.page = page;
    this.selectPlanButtons = page.getByRole('button', { name: /select plan/i });
  }

  /**
   * Subscribe to the seeded nSuns plan. Selects it by name rather than position:
   * admin E2E tests create public plans (isPublic defaults true), so "the first
   * plan card" is non-deterministic and could be a half-created/edited admin
   * plan — which previously caused intermittent FK violations during TM setup.
   */
  async selectFirstPlan() {
    const nsunsCard = this.page.getByRole('article').filter({
      has: this.page.getByRole('heading', { name: /nsuns/i }),
    });
    await nsunsCard.getByRole('button', { name: /select plan/i }).click();
    await this.page.waitForURL(/\/setup/);
  }
}
