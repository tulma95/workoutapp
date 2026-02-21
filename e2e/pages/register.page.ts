import { expect, type Page } from '@playwright/test';

export class RegisterPage {
  readonly page: Page;

  readonly emailInput;
  readonly passwordInput;
  readonly usernameInput;
  readonly submitButton;
  readonly errorMessage;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel(/email/i);
    this.passwordInput = page.getByLabel(/password/i);
    this.usernameInput = page.getByLabel('Username');
    this.submitButton = page.getByRole('button', { name: /create account/i });
    this.errorMessage = page.getByRole('alert');
  }

  async expectHeading() {
    await expect(this.page.getByRole('heading', { name: /create account/i })).toBeVisible();
  }

  async register(email: string, password: string, username: string) {
    await this.page.goto('/register');
    await this.expectHeading();
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.usernameInput.fill(username);
    await this.submitButton.click();
  }
}
