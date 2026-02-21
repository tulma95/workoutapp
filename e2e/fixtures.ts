import { test as base, expect, type Page } from '@playwright/test';
import { RegisterPage } from './pages/register.page';
import { PlanSelectionPage } from './pages/plan-selection.page';
import { SetupPage } from './pages/setup.page';

interface User {
  email: string;
  password: string;
  username: string;
}

interface AuthenticatedPageFixture {
  page: Page;
  user: User;
}

interface SetupCompletePageFixture extends AuthenticatedPageFixture {}

export const test = base.extend<{
  authenticatedPage: AuthenticatedPageFixture;
  setupCompletePage: SetupCompletePageFixture;
}>({
  authenticatedPage: async ({ page }, use) => {
    const uniqueId = crypto.randomUUID();
    const user: User = {
      email: `test-${uniqueId}@example.com`,
      password: 'ValidPassword123',
      username: `testuser${uniqueId.replace(/-/g, '').slice(0, 16)}`,
    };

    const registerPage = new RegisterPage(page);
    await registerPage.register(user.email, user.password, user.username);

    const planSelection = new PlanSelectionPage(page);
    await planSelection.selectFirstPlan();

    await use({ page, user });
  },

  setupCompletePage: async ({ authenticatedPage }, use) => {
    const { page, user } = authenticatedPage;

    const setup = new SetupPage(page);
    await setup.expectHeading();
    await setup.fillOneRepMaxes('100', '140', '60', '180');
    await setup.submitAndWaitForDashboard();

    await use({ page, user });
  },
});

export { expect } from '@playwright/test';
