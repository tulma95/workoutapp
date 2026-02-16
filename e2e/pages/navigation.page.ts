import { type Page } from '@playwright/test';

export class NavigationBar {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goToDashboard() {
    await this.page.getByRole('link', { name: /dashboard/i }).click();
  }

  async goToHistory() {
    await this.page.getByRole('link', { name: /history/i }).click();
  }

  async goToSettings() {
    await this.page.getByRole('link', { name: /settings/i }).click();
  }
}
