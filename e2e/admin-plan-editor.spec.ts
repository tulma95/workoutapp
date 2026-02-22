import { test as base, expect, type Page, type Locator } from '@playwright/test';

// -- Admin page object with reusable locators --

class AdminPlanEditor {
  readonly page: Page;

  // Metadata inputs
  readonly nameInput: Locator;
  readonly slugInput: Locator;
  readonly descriptionInput: Locator;
  readonly daysPerWeekInput: Locator;

  // Day tabs & editor
  readonly dayTabs: Locator;
  readonly dayNameInput: Locator;

  // Exercise section
  readonly addExerciseButton: Locator;
  readonly exerciseRows: Locator;
  readonly exerciseSearch: Locator;
  readonly exercisePickerItems: Locator;

  // Save / validation
  readonly saveButton: Locator;
  readonly validationErrors: Locator;

  // Toasts
  readonly successToast: Locator;

  // Unsaved changes modal
  readonly unsavedModal: Locator;
  readonly stayButton: Locator;
  readonly leaveButton: Locator;

  // Set scheme modal
  readonly setSchemeModal: Locator;

  // Progression rules
  readonly progressionRulesSection: Locator;
  readonly addRuleButton: Locator;

  // Metadata toggle
  readonly metadataToggle: Locator;

  constructor(page: Page) {
    this.page = page;

    this.nameInput = page.getByLabel(/plan name/i);
    this.slugInput = page.getByLabel(/^slug/i);
    this.descriptionInput = page.getByLabel(/description/i);
    this.daysPerWeekInput = page.getByLabel(/days per week/i);

    this.dayTabs = page.locator('[data-testid="day-tab"]');
    this.dayNameInput = page.getByLabel(/day name/i);

    this.addExerciseButton = page.getByRole('button', { name: /add exercise/i });
    this.exerciseRows = page.locator('[data-testid="exercise-row"]');
    this.exerciseSearch = page.getByPlaceholder(/search exercises/i);
    this.exercisePickerItems = page.locator('[data-testid="exercise-picker-item"]');

    this.saveButton = page.getByRole('button', { name: /save plan/i });
    this.validationErrors = page.locator('[data-testid="validation-errors"]');

    this.successToast = page.locator('[data-testid="toast"][data-type="success"]');

    this.unsavedModal = page.locator('[data-testid="unsaved-modal"]');
    this.stayButton = page.getByRole('button', { name: /^stay$/i });
    this.leaveButton = page.getByRole('button', { name: /^leave$/i });

    this.setSchemeModal = page.locator('[data-testid="set-scheme-modal"]');

    this.progressionRulesSection = page.locator('[data-testid="progression-rules"]');
    this.addRuleButton = page.getByRole('button', { name: /add rule/i });

    this.metadataToggle = page.locator('[data-testid="metadata-toggle"]');
  }

  dayTab(n: number) {
    return this.dayTabs.nth(n - 1);
  }

  completeDayTabs() {
    return this.page.locator('[data-testid="day-tab"][data-complete]');
  }

  incompleteDayTabs() {
    return this.page.locator('[data-testid="day-tab"][data-incomplete]');
  }

  editSetsButton(n: number) {
    return this.page.getByRole('button', { name: /edit sets/i }).nth(n - 1);
  }

  removeExerciseButton(n: number) {
    return this.exerciseRows.nth(n - 1).getByTitle('Remove');
  }

  moveUpButton(n: number) {
    return this.exerciseRows.nth(n - 1).getByRole('button', { name: /↑/ });
  }

  moveDownButton(n: number) {
    return this.exerciseRows.nth(n - 1).getByRole('button', { name: /↓/ });
  }

  copySelect(n: number) {
    return this.exerciseRows.nth(n - 1).locator('select').last();
  }

  // Set scheme modal locators
  get addSetButton() {
    return this.setSchemeModal.getByRole('button', { name: /add set/i });
  }
  get saveSetsButton() {
    return this.setSchemeModal.getByRole('button', { name: /^save$/i });
  }
  get setRows() {
    return this.setSchemeModal.locator('tbody tr');
  }

  // Progression rule row locators
  ruleMinReps(n: number) {
    return this.page.locator('[data-testid="rule-row"]').nth(n - 1).locator('input[type="number"]').first();
  }
  ruleMaxReps(n: number) {
    return this.page.locator('[data-testid="rule-row"]').nth(n - 1).locator('input[type="number"]').nth(1);
  }
  ruleIncrease(n: number) {
    return this.page.locator('[data-testid="rule-row"]').nth(n - 1).locator('input[type="number"]').nth(2);
  }

  // -- Actions --

  async expandMetadata() {
    await expect(this.metadataToggle).toBeVisible();
    const isCollapsed = await this.page.locator('[data-testid="metadata-section"][data-collapsed]').isVisible();
    if (isCollapsed) {
      await this.metadataToggle.click();
      await expect(this.nameInput).toBeVisible();
    }
  }

  async addExercise(searchTerm: string) {
    await this.addExerciseButton.click();
    await expect(this.exerciseSearch).toBeVisible();
    await this.exerciseSearch.fill(searchTerm);
    await this.exercisePickerItems.first().click();
  }

  async addSets(exerciseIndex: number, count: number, percentage: number, reps: number) {
    await this.editSetsButton(exerciseIndex).click();
    await expect(this.setSchemeModal).toBeVisible();

    for (let i = 0; i < count; i++) {
      await this.addSetButton.click();
    }

    const percentageInputs = this.setSchemeModal.locator('td:nth-child(2) input[type="number"]');
    const repsInputs = this.setSchemeModal.locator('td:nth-child(3) input[type="number"]');
    for (let i = 0; i < count; i++) {
      await percentageInputs.nth(i).fill(String(percentage));
      await repsInputs.nth(i).fill(String(reps));
    }

    await this.saveSetsButton.click();
    await expect(this.setSchemeModal).not.toBeVisible();
  }
}

// -- Fixture --

interface AdminFixture {
  admin: AdminPlanEditor;
}

const test = base.extend<AdminFixture>({
  admin: async ({ page }, use) => {
    const uid = crypto.randomUUID().slice(0, 8);
    const email = `admin-${uid}@example.com`;

    await page.goto('/register');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill('ValidPassword123');
    await page.getByLabel('Username').fill(`adminuser${uid}`);
    await page.getByRole('button', { name: /create account/i }).click();

    await page.getByRole('button', { name: /select plan/i }).first().click();
    await page.waitForURL(/\/setup/);

    // Promote to admin via dev endpoint
    const token = await page.evaluate(() => localStorage.getItem('accessToken'));
    const res = await page.request.post('/api/dev/promote-admin', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();

    // Log out via Settings and re-login to get a new JWT with isAdmin=true
    await page.getByRole('link', { name: /settings/i }).click();
    await page.getByRole('button', { name: /log out/i }).click();
    await expect(page.getByRole('heading', { name: /log in/i })).toBeVisible();
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill('ValidPassword123');
    await page.getByRole('button', { name: /log in/i }).click();
    await page.waitForURL(/\/(setup|$)/);
    await page.waitForLoadState('networkidle');

    // Navigate to admin
    await page.goto('/admin/plans');
    await expect(page.getByRole('heading', { name: /workout plans/i })).toBeVisible();

    await use(new AdminPlanEditor(page));
  },
});

// -- Helpers --

function uniquePlanName() {
  return `Test Plan ${crypto.randomUUID().slice(0, 8)}`;
}

async function goToCreatePlan(admin: AdminPlanEditor) {
  await admin.page.goto('/admin/plans');
  await admin.page.getByRole('link', { name: /create plan/i }).click();
  await expect(admin.page.getByLabel(/plan name/i)).toBeVisible();
}

// -- Tests --

test.describe('Admin Plan Editor', () => {
  test('create a new plan with days, exercises, and sets', async ({ admin }) => {
    await goToCreatePlan(admin);
    const planName = uniquePlanName();

    await admin.nameInput.fill(planName);

    const expectedSlug = planName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    await expect(admin.slugInput).toHaveValue(expectedSlug);

    await admin.daysPerWeekInput.fill('3');
    await admin.dayNameInput.fill('Push Day');
    await expect(admin.dayTab(1)).toContainText('Push Day');

    await admin.addExercise('Bench');
    await admin.addSets(1, 3, 65, 5);
    await expect(admin.exerciseRows.first()).toContainText('3 sets');

    await admin.saveButton.click();
    await expect(admin.successToast).toBeVisible();
    await admin.page.waitForURL(/\/admin\/plans\/\d+/);

    await admin.page.goto('/admin/plans');
    await expect(admin.page.getByText(planName)).toBeVisible();
  });

  test('percentage input displays correctly without double-conversion', async ({ admin }) => {
    await goToCreatePlan(admin);
    await admin.nameInput.fill(uniquePlanName());
    await admin.daysPerWeekInput.fill('1');

    await admin.addExercise('Bench');
    await admin.editSetsButton(1).click();
    await expect(admin.setSchemeModal).toBeVisible();
    await admin.addSetButton.click();

    const percentageInput = admin.setSchemeModal.locator('td:nth-child(2) input[type="number"]').first();
    await percentageInput.fill('70');
    await expect(percentageInput).toHaveValue('70');

    await admin.saveSetsButton.click();
    await expect(admin.setSchemeModal).not.toBeVisible();

    await admin.editSetsButton(1).click();
    await expect(admin.setSchemeModal).toBeVisible();
    await expect(admin.setSchemeModal.locator('td:nth-child(2) input[type="number"]').first()).toHaveValue('70');
  });

  test('description persists across tab switches and after save', async ({ admin }) => {
    await goToCreatePlan(admin);
    const planName = uniquePlanName();
    const desc = 'A detailed plan description for testing persistence.';

    await admin.nameInput.fill(planName);
    await admin.descriptionInput.fill(desc);
    await admin.daysPerWeekInput.fill('2');

    await admin.addExercise('Bench');
    await admin.addSets(1, 3, 65, 5);

    await admin.dayTab(2).click();
    await admin.dayTab(1).click();
    await expect(admin.descriptionInput).toHaveValue(desc);

    await admin.dayTab(2).click();
    await admin.addExercise('Squat');
    await admin.addSets(1, 3, 70, 5);

    await admin.saveButton.click();
    await expect(admin.successToast).toBeVisible();

    await admin.page.reload();
    await admin.expandMetadata();
    await expect(admin.descriptionInput).toHaveValue(desc);
  });

  test('shows unsaved changes warning on navigation', async ({ admin }) => {
    await goToCreatePlan(admin);
    await admin.nameInput.fill(uniquePlanName());

    await admin.page.getByRole('link', { name: /^plans$/i }).click();
    await expect(admin.unsavedModal).toBeVisible();

    await admin.stayButton.click();
    await expect(admin.unsavedModal).not.toBeVisible();
    await expect(admin.page).toHaveURL('/admin/plans/new');

    await admin.page.getByRole('link', { name: /^plans$/i }).click();
    await expect(admin.unsavedModal).toBeVisible();
    await admin.leaveButton.click();
    await expect(admin.page).toHaveURL('/admin/plans');
  });

  test('no unsaved changes warning after saving', async ({ admin }) => {
    await goToCreatePlan(admin);
    await admin.nameInput.fill(uniquePlanName());
    await admin.daysPerWeekInput.fill('1');

    await admin.addExercise('Bench');
    await admin.addSets(1, 3, 65, 5);

    await admin.saveButton.click();
    await expect(admin.successToast).toBeVisible();

    await admin.page.getByRole('link', { name: /^plans$/i }).click();
    await expect(admin.page.getByRole('heading', { name: /workout plans/i })).toBeVisible();
    await expect(admin.unsavedModal).not.toBeVisible();
  });

  test('shows all validation errors at once, no alert dialog', async ({ admin }) => {
    let dialogFired = false;
    admin.page.on('dialog', () => { dialogFired = true; });

    await goToCreatePlan(admin);
    await admin.nameInput.fill(uniquePlanName());
    await admin.daysPerWeekInput.fill('3');

    await admin.addExercise('Bench');

    await admin.saveButton.click();

    await expect(admin.validationErrors).toBeVisible();
    const errorItems = admin.validationErrors.locator('li');
    expect(await errorItems.count()).toBeGreaterThan(0);
    expect(dialogFired).toBe(false);
  });

  test('day tabs show completion indicators', async ({ admin }) => {
    await goToCreatePlan(admin);
    await admin.nameInput.fill(uniquePlanName());
    await admin.daysPerWeekInput.fill('3');

    await expect(admin.completeDayTabs()).toHaveCount(0);
    await expect(admin.incompleteDayTabs()).toHaveCount(0);

    await admin.addExercise('Bench');
    await expect(admin.incompleteDayTabs()).toHaveCount(1);

    await admin.addSets(1, 3, 65, 5);
    await expect(admin.completeDayTabs()).toHaveCount(1);
    await expect(admin.incompleteDayTabs()).toHaveCount(0);
  });

  test('progression rules start empty with sensible defaults on add', async ({ admin }) => {
    await goToCreatePlan(admin);
    await admin.nameInput.fill(uniquePlanName());

    await admin.progressionRulesSection.scrollIntoViewIfNeeded();

    const emptyMsg = admin.page.locator('[data-testid="progression-rules-empty"]');
    await expect(emptyMsg).toBeVisible();

    await admin.addRuleButton.click();
    await expect(emptyMsg).not.toBeVisible();

    await expect(admin.ruleMinReps(1)).toHaveValue('1');
    await expect(admin.ruleMaxReps(1)).toHaveValue('5');
    await expect(admin.ruleIncrease(1)).toHaveValue('2.5');
  });

  test('add set copies values from previous set', async ({ admin }) => {
    await goToCreatePlan(admin);
    await admin.nameInput.fill(uniquePlanName());
    await admin.daysPerWeekInput.fill('1');

    await admin.addExercise('Bench');
    await admin.editSetsButton(1).click();
    await expect(admin.setSchemeModal).toBeVisible();

    await admin.addSetButton.click();
    const percentageInputs = admin.setSchemeModal.locator('td:nth-child(2) input[type="number"]');
    const repsInputs = admin.setSchemeModal.locator('td:nth-child(3) input[type="number"]');
    await percentageInputs.first().fill('65');
    await repsInputs.first().fill('5');

    await admin.addSetButton.click();
    await expect(admin.setRows).toHaveCount(2);
    await expect(percentageInputs.nth(1)).toHaveValue('65');
    await expect(repsInputs.nth(1)).toHaveValue('5');
  });

  test('copy sets from one exercise to another', async ({ admin }) => {
    await goToCreatePlan(admin);
    await admin.nameInput.fill(uniquePlanName());
    await admin.daysPerWeekInput.fill('1');

    await admin.addExercise('Bench');
    await admin.addExercise('Squat');

    await admin.addSets(1, 3, 70, 5);

    const copySelect = admin.copySelect(2);
    await copySelect.selectOption({ index: 1 });

    await admin.editSetsButton(2).click();
    await expect(admin.setSchemeModal).toBeVisible();

    await expect(admin.setRows).toHaveCount(3);
    await expect(admin.setSchemeModal.locator('td:nth-child(2) input[type="number"]').first()).toHaveValue('70');
    await expect(admin.setSchemeModal.locator('td:nth-child(3) input[type="number"]').first()).toHaveValue('5');
  });

  test('confirms before deleting exercise with configured sets', async ({ admin }) => {
    await goToCreatePlan(admin);
    await admin.nameInput.fill(uniquePlanName());
    await admin.daysPerWeekInput.fill('1');

    await admin.addExercise('Bench');
    await admin.addSets(1, 3, 65, 5);

    await admin.removeExerciseButton(1).click();
    const dialog = admin.page.locator('[data-testid="confirm-dialog"]');
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible();
    await expect(admin.exerciseRows).toHaveCount(1);

    await admin.removeExerciseButton(1).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /delete/i }).click();
    await expect(admin.exerciseRows).toHaveCount(0);
  });

  test('deletes exercise without confirmation when no sets', async ({ admin }) => {
    await goToCreatePlan(admin);
    await admin.nameInput.fill(uniquePlanName());
    await admin.daysPerWeekInput.fill('1');

    await admin.addExercise('Bench');
    await admin.removeExerciseButton(1).click();
    await expect(admin.exerciseRows).toHaveCount(0);
    await expect(admin.page.locator('[data-testid="confirm-dialog"]')).not.toBeVisible();
  });

  test('reorder arrows are visually distinct for movable exercises', async ({ admin }) => {
    await goToCreatePlan(admin);
    await admin.nameInput.fill(uniquePlanName());
    await admin.daysPerWeekInput.fill('1');

    await admin.addExercise('Bench');
    await admin.addExercise('Squat');

    await expect(admin.exerciseRows).toHaveCount(2);

    await expect(admin.moveUpButton(1)).toBeDisabled();
    await expect(admin.moveDownButton(1)).toBeEnabled();
    await expect(admin.moveUpButton(2)).toBeEnabled();
    await expect(admin.moveDownButton(2)).toBeDisabled();
  });

  test('save button stays visible when scrolling', async ({ admin }) => {
    await goToCreatePlan(admin);
    await admin.nameInput.fill(uniquePlanName());
    await admin.daysPerWeekInput.fill('4');

    for (let day = 1; day <= 4; day++) {
      await admin.dayTab(day).click();
      await admin.addExercise('Bench');
    }

    await admin.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    await expect(admin.saveButton).toBeVisible();
    await expect(admin.saveButton).toBeInViewport();
  });

  test('edit existing plan - loads data and saves changes', async ({ admin }) => {
    await goToCreatePlan(admin);
    const planName = uniquePlanName();
    await admin.nameInput.fill(planName);
    await admin.daysPerWeekInput.fill('2');
    await admin.addExercise('Bench');
    await admin.addSets(1, 3, 65, 5);
    await admin.dayTab(2).click();
    await admin.addExercise('Squat');
    await admin.addSets(1, 3, 70, 5);
    await admin.saveButton.click();
    await expect(admin.successToast).toBeVisible();
    await admin.page.waitForURL(/\/admin\/plans\/\d+/);

    await admin.page.reload();
    await admin.expandMetadata();
    await expect(admin.nameInput).toHaveValue(planName);
    await expect(admin.dayTabs).toHaveCount(2);
    await expect(admin.exerciseRows).not.toHaveCount(0);

    const testDesc = `Updated description ${crypto.randomUUID().slice(0, 8)}`;
    await admin.descriptionInput.fill(testDesc);

    await admin.saveButton.click();
    await expect(admin.successToast).toBeVisible();

    await admin.page.reload();
    await admin.expandMetadata();
    await expect(admin.descriptionInput).toHaveValue(testDesc);
  });
});
