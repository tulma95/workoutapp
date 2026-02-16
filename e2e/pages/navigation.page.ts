import { type Page } from '@playwright/test';

export class NavigationBar {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goToDashboard() {
    await this.page.getByRole('link', { name: /dashboard/i }).click();
    await this.page.waitForURL('/');
  }

  async goToHistory() {
    await this.page.getByRole('link', { name: /history/i }).click();
    await this.page.waitForURL('/history');
  }

  async goToSettings() {
    await this.page.getByRole('link', { name: /settings/i }).click();
    await this.page.waitForURL('/settings');
  }
}
