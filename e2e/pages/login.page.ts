import { expect, type Page } from '@playwright/test';

export class LoginPage {
  readonly page: Page;

  readonly emailInput;
  readonly passwordInput;
  readonly submitButton;
  readonly errorMessage;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel(/email/i);
    this.passwordInput = page.getByLabel(/password/i);
    this.submitButton = page.getByRole('button', { name: /log in/i });
    this.errorMessage = page.locator('.error, [role="alert"], .alert-error');
  }

  async expectHeading() {
    await expect(this.page.getByRole('heading', { name: /log in/i })).toBeVisible();
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
