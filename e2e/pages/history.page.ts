import { expect, type Page } from '@playwright/test';

export class HistoryPage {
  readonly page: Page;

  readonly heading;
  readonly monthHeading;
  readonly prevButton;
  readonly nextButton;
  readonly calendarGrid;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /history/i });
    this.monthHeading = page.locator('[data-testid="calendar-title"]');
    this.prevButton = page.getByRole('button', { name: 'Previous month' });
    this.nextButton = page.getByRole('button', { name: 'Next month' });
    this.calendarGrid = page.locator('[data-testid="calendar-grid"]');
  }

  async navigate() {
    await this.page.getByRole('link', { name: /history/i }).click();
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
  }

  async clickDay(dayOfMonth: number) {
    await this.page.getByRole('button').filter({ hasText: dayOfMonth.toString() }).first().click();
  }

  async goToPreviousMonth() {
    await this.prevButton.click();
  }

  async goToNextMonth() {
    await this.nextButton.click();
  }

  static currentMonthYear() {
    const currentDate = new Date();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    return { month: monthNames[currentDate.getMonth()], year: currentDate.getFullYear().toString() };
  }
}
