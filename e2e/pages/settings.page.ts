import { expect, type Page } from '@playwright/test';

export class SettingsPage {
  readonly page: Page;

  readonly trainingMaxesHeading;
  readonly kgButton;
  readonly lbButton;
  readonly logoutButton;
  readonly savedText;

  constructor(page: Page) {
    this.page = page;
    this.trainingMaxesHeading = page.getByText('Training Maxes');
    this.kgButton = page.getByRole('button', { name: 'kg' });
    this.lbButton = page.getByRole('button', { name: 'lb' });
    this.logoutButton = page.getByRole('button', { name: /log out/i });
    this.savedText = page.getByText('Saved!');
  }

  async navigate() {
    await this.page.getByRole('link', { name: /settings/i }).click();
    await this.page.waitForURL('/settings');
  }

  async expectLoaded() {
    await expect(this.trainingMaxesHeading).toBeVisible();
  }

  async setUnit(unit: 'kg' | 'lb') {
    const button = unit === 'kg' ? this.kgButton : this.lbButton;
    await button.click();
    await expect(this.savedText).toBeVisible({ timeout: 3000 });
  }

  async logout() {
    await this.logoutButton.click();
    await this.page.waitForURL('/login');
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

    // Wait for modal to close (uses div.modal-overlay, not native dialog)
    await expect(this.page.locator('.modal-overlay')).not.toBeVisible();
  }
}
