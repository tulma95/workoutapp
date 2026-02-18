import { expect, type Page } from '@playwright/test';

export class ProgressPage {
  readonly page: Page;
  readonly heading;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Progress' });
  }

  async navigate() {
    await this.page.getByRole('link', { name: /progress/i }).click();
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
  }

  async selectTimeRange(label: string) {
    await this.page.getByRole('radio', { name: label }).check({ force: true });
  }
}
