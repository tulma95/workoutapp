import { expect, type Page } from '@playwright/test';

export class SettingsPage {
  readonly page: Page;

  readonly trainingMaxesHeading;
  readonly logoutButton;

  constructor(page: Page) {
    this.page = page;
    this.trainingMaxesHeading = page.getByRole('heading', { name: 'Training Maxes' });
    this.logoutButton = page.getByRole('button', { name: /log out/i });
  }

  async navigate() {
    await this.page.getByRole('link', { name: /settings/i }).click();
  }

  async expectLoaded() {
    await expect(this.trainingMaxesHeading).toBeVisible();
  }

  async logout() {
    await this.logoutButton.click();
    await expect(this.page.getByRole('heading', { name: /log in/i })).toBeVisible();
  }

  getTMText(exerciseName: string) {
    return this.page.locator(`text=${exerciseName}`).locator('..');
  }

  async editTM(index: number, newValue: string) {
    const editButton = this.page.locator('button', { hasText: 'Edit' }).nth(index);
    await editButton.click();

    const modalInput = this.page.getByRole('spinbutton');
    await expect(modalInput).toBeVisible();
    await modalInput.fill(newValue);

    await this.page.getByRole('button', { name: /^save$/i }).click();

    await expect(this.page.getByRole('dialog')).not.toBeVisible();
  }
}
