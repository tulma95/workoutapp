import { expect, type Page } from '@playwright/test';

export class RegisterPage {
  readonly page: Page;

  readonly emailInput;
  readonly passwordInput;
  readonly displayNameInput;
  readonly submitButton;
  readonly errorMessage;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel(/email/i);
    this.passwordInput = page.getByLabel(/password/i);
    this.displayNameInput = page.getByLabel(/display name/i);
    this.submitButton = page.getByRole('button', { name: /create account/i });
    this.errorMessage = page.getByRole('alert');
  }

  async expectHeading() {
    await expect(this.page.getByRole('heading', { name: /create account/i })).toBeVisible();
  }

  async register(email: string, password: string, displayName: string) {
    await this.page.goto('/register');
    await this.expectHeading();
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.displayNameInput.fill(displayName);
    await this.submitButton.click();
  }
}
