import { test as base, expect, type Page, type Locator } from '@playwright/test';

// ── Admin page object with reusable locators ────────────────────────

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

  constructor(page: Page) {
    this.page = page;

    this.nameInput = page.getByLabel(/plan name/i);
    this.slugInput = page.getByLabel(/^slug/i);
    this.descriptionInput = page.getByLabel(/description/i);
    this.daysPerWeekInput = page.getByLabel(/days per week/i);

    this.dayTabs = page.locator('.day-tab');
    this.dayNameInput = page.getByLabel(/day name/i);

    this.addExerciseButton = page.getByRole('button', { name: /add exercise/i });
    this.exerciseRows = page.locator('.exercise-row');
    this.exerciseSearch = page.getByPlaceholder(/search exercises/i);
    this.exercisePickerItems = page.locator('.exercise-picker-item');

    this.saveButton = page.getByRole('button', { name: /save plan/i });
    this.validationErrors = page.locator('.validation-errors');

    this.successToast = page.locator('.toast--success');

    this.unsavedModal = page.locator('.unsaved-modal');
    this.stayButton = page.getByRole('button', { name: /^stay$/i });
    this.leaveButton = page.getByRole('button', { name: /^leave$/i });

    this.setSchemeModal = page.locator('.set-scheme-modal');

    this.progressionRulesSection = page.locator('.progression-rules-editor');
    this.addRuleButton = page.getByRole('button', { name: /add rule/i });

    this.metadataToggle = page.locator('.metadata-toggle');
  }

  dayTab(n: number) {
    return this.dayTabs.nth(n - 1);
  }

  completeDayTabs() {
    return this.page.locator('.day-tab--complete');
  }

  incompleteDayTabs() {
    return this.page.locator('.day-tab--incomplete');
  }

  editSetsButton(n: number) {
    return this.page.getByRole('button', { name: /edit sets/i }).nth(n - 1);
  }

  removeExerciseButton(n: number) {
    return this.exerciseRows.nth(n - 1).locator('.btn-remove');
  }

  moveUpButton(n: number) {
    return this.exerciseRows.nth(n - 1).getByRole('button', { name: /↑/ });
  }

  moveDownButton(n: number) {
    return this.exerciseRows.nth(n - 1).getByRole('button', { name: /↓/ });
  }

  copySelect(n: number) {
    return this.exerciseRows.nth(n - 1).locator('.copy-sets-select');
  }

  // Set scheme modal locators
  get addSetButton() {
    return this.setSchemeModal.getByRole('button', { name: /add set/i });
  }
  get saveSetsButton() {
    return this.setSchemeModal.getByRole('button', { name: /^save$/i });
  }
  get setRows() {
    return this.setSchemeModal.locator('.sets-table tbody tr');
  }

  // Progression rule row locators
  ruleMinReps(n: number) {
    return this.page.locator('.progression-rules-table tbody tr').nth(n - 1).locator('.reps-input').first();
  }
  ruleMaxReps(n: number) {
    return this.page.locator('.progression-rules-table tbody tr').nth(n - 1).locator('.reps-input').nth(1);
  }
  ruleIncrease(n: number) {
    return this.page.locator('.progression-rules-table tbody tr').nth(n - 1).locator('.increase-input');
  }

  // Metadata toggle
  readonly metadataToggle: Locator;

  // ── Actions ──

  async expandMetadata() {
    await this.metadataToggle.waitFor();
    const isCollapsed = await this.page.locator('.plan-metadata-section--collapsed').isVisible();
    if (isCollapsed) {
      await this.metadataToggle.click();
      await this.nameInput.waitFor();
    }
  }

  async addExercise(searchTerm: string) {
    await this.addExerciseButton.click();
    await this.exerciseSearch.waitFor();
    await this.exerciseSearch.fill(searchTerm);
    await this.exercisePickerItems.first().click();
  }

  async addSets(exerciseIndex: number, count: number, percentage: number, reps: number) {
    await this.editSetsButton(exerciseIndex).click();
    await this.setSchemeModal.waitFor();

    for (let i = 0; i < count; i++) {
      await this.addSetButton.click();
    }

    // Fill percentage and reps for each set
    const percentageInputs = this.setSchemeModal.locator('.percentage-input');
    const repsInputs = this.setSchemeModal.locator('.reps-input');
    for (let i = 0; i < count; i++) {
      await percentageInputs.nth(i).fill(String(percentage));
      await repsInputs.nth(i).fill(String(reps));
    }

    await this.saveSetsButton.click();
    await expect(this.setSchemeModal).not.toBeVisible();
  }
}

// ── Fixture ─────────────────────────────────────────────────────────

interface AdminFixture {
  admin: AdminPlanEditor;
}

const test = base.extend<AdminFixture>({
  admin: async ({ page }, use) => {
    // Register unique user
    const uid = crypto.randomUUID().slice(0, 8);
    const email = `admin-${uid}@example.com`;

    await page.goto('/register');
    await page.fill('#email', email);
    await page.fill('#password', 'ValidPassword123');
    await page.fill('#displayName', 'Admin User');
    await page.click('button[type="submit"]');

    // Select plan to get JWT stored
    await page.waitForURL('/select-plan');
    await page.click('button:has-text("Select Plan")');
    await page.waitForURL(/\/setup/);

    // Promote to admin via dev endpoint
    const token = await page.evaluate(() => localStorage.getItem('accessToken'));
    const res = await page.request.post('/api/dev/promote-admin', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();

    // Re-login to get a new JWT with isAdmin=true (admin flag is in the JWT payload)
    await page.evaluate(() => localStorage.removeItem('accessToken'));
    await page.goto('/login');
    await page.fill('#email', email);
    await page.fill('#password', 'ValidPassword123');
    await page.click('button[type="submit"]');
    // After login, user goes to /setup (no TMs) — that's fine, we just need the new token
    await page.waitForURL(/\/(setup|$)/);

    // Navigate to admin
    await page.goto('/admin/plans');
    await page.getByRole('heading', { name: /workout plans/i }).waitFor({ timeout: 10000 });

    await use(new AdminPlanEditor(page));
  },
});

// ── Helpers ──────────────────────────────────────────────────────────

function uniquePlanName() {
  return `Test Plan ${crypto.randomUUID().slice(0, 8)}`;
}

async function goToCreatePlan(admin: AdminPlanEditor) {
  await admin.page.goto('/admin/plans');
  await admin.page.getByRole('link', { name: /create plan/i }).click();
  await admin.page.waitForURL('/admin/plans/new');
}

// ── Tests ────────────────────────────────────────────────────────────

test.describe('Admin Plan Editor', () => {
  // 1. Plan creation — happy path
  test('create a new plan with days, exercises, and sets', async ({ admin }) => {
    await goToCreatePlan(admin);
    const planName = uniquePlanName();

    // Fill metadata
    await admin.nameInput.fill(planName);

    // Verify slug auto-generates
    const expectedSlug = planName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    await expect(admin.slugInput).toHaveValue(expectedSlug);

    // Set days per week to 3
    await admin.daysPerWeekInput.fill('3');

    // Name Day 1
    await admin.dayNameInput.fill('Push Day');

    // Verify tab shows custom name
    await expect(admin.dayTab(1)).toContainText('Push Day');

    // Add exercise with sets
    await admin.addExercise('Bench');
    await admin.addSets(1, 3, 65, 5);

    // Verify sets indicator
    await expect(admin.exerciseRows.first()).toContainText('3 sets');

    // Save
    await admin.saveButton.click();
    await expect(admin.successToast).toBeVisible();
    await admin.page.waitForURL(/\/admin\/plans\/\d+/, { timeout: 10000 });

    // Verify plan appears in list
    await admin.page.goto('/admin/plans');
    await expect(admin.page.getByText(planName)).toBeVisible();
  });

  // 2. Percentage input — correct conversion
  test('percentage input displays correctly without double-conversion', async ({ admin }) => {
    await goToCreatePlan(admin);
    await admin.nameInput.fill(uniquePlanName());
    await admin.daysPerWeekInput.fill('1');

    await admin.addExercise('Bench');

    // Open set editor and add a single set
    await admin.editSetsButton(1).click();
    await admin.setSchemeModal.waitFor();
    await admin.addSetButton.click();

    // Type 70 in percentage
    const percentageInput = admin.setSchemeModal.locator('.percentage-input').first();
    await percentageInput.fill('70');
    await expect(percentageInput).toHaveValue('70');

    // Save and reopen — should still show 70
    await admin.saveSetsButton.click();
    await expect(admin.setSchemeModal).not.toBeVisible();

    await admin.editSetsButton(1).click();
    await admin.setSchemeModal.waitFor();
    await expect(admin.setSchemeModal.locator('.percentage-input').first()).toHaveValue('70');
  });

  // 3. Description field persistence
  test('description persists across tab switches and after save', async ({ admin }) => {
    await goToCreatePlan(admin);
    const planName = uniquePlanName();
    const desc = 'A detailed plan description for testing persistence.';

    await admin.nameInput.fill(planName);
    await admin.descriptionInput.fill(desc);
    await admin.daysPerWeekInput.fill('2');

    // Add exercise + sets on Day 1
    await admin.addExercise('Bench');
    await admin.addSets(1, 3, 65, 5);

    // Switch to Day 2 and back
    await admin.dayTab(2).click();
    await admin.dayTab(1).click();

    // Description still present
    await expect(admin.descriptionInput).toHaveValue(desc);

    // Add exercise + sets on Day 2 for valid save
    await admin.dayTab(2).click();
    await admin.addExercise('Squat');
    await admin.addSets(1, 3, 70, 5);

    // Save
    await admin.saveButton.click();
    await expect(admin.successToast).toBeVisible();

    // Reload and verify persistence (metadata section starts collapsed in edit mode)
    await admin.page.reload();
    await admin.expandMetadata();
    await expect(admin.descriptionInput).toHaveValue(desc);
  });

  // 4. Unsaved changes warning — browser navigation
  test('shows unsaved changes warning on navigation', async ({ admin }) => {
    await goToCreatePlan(admin);
    await admin.nameInput.fill(uniquePlanName());

    // Navigate to Plans tab
    await admin.page.getByRole('link', { name: /^plans$/i }).click();

    // Unsaved modal appears
    await expect(admin.unsavedModal).toBeVisible();

    // Click Stay — still on editor
    await admin.stayButton.click();
    await expect(admin.unsavedModal).not.toBeVisible();
    await expect(admin.page).toHaveURL('/admin/plans/new');

    // Try again, click Leave
    await admin.page.getByRole('link', { name: /^plans$/i }).click();
    await expect(admin.unsavedModal).toBeVisible();
    await admin.leaveButton.click();
    await admin.page.waitForURL('/admin/plans');
  });

  // 5. No unsaved changes warning when clean
  test('no unsaved changes warning after saving', async ({ admin }) => {
    await goToCreatePlan(admin);
    await admin.nameInput.fill(uniquePlanName());
    await admin.daysPerWeekInput.fill('1');

    await admin.addExercise('Bench');
    await admin.addSets(1, 3, 65, 5);

    // Save
    await admin.saveButton.click();
    await expect(admin.successToast).toBeVisible();

    // Navigate away — no dialog
    await admin.page.getByRole('link', { name: /^plans$/i }).click();
    await admin.page.waitForURL('/admin/plans');
    await expect(admin.unsavedModal).not.toBeVisible();
  });

  // 6. Validation — all errors shown at once
  test('shows all validation errors at once, no alert dialog', async ({ admin }) => {
    let dialogFired = false;
    admin.page.on('dialog', () => { dialogFired = true; });

    await goToCreatePlan(admin);
    await admin.nameInput.fill(uniquePlanName());
    await admin.daysPerWeekInput.fill('3');

    // Add exercise to Day 1 without sets
    await admin.addExercise('Bench');

    // Save
    await admin.saveButton.click();

    // Inline validation errors
    await expect(admin.validationErrors).toBeVisible();
    const errorItems = admin.validationErrors.locator('li');
    expect(await errorItems.count()).toBeGreaterThan(0);

    expect(dialogFired).toBe(false);
  });

  // 7. Day tab completion indicators
  test('day tabs show completion indicators', async ({ admin }) => {
    await goToCreatePlan(admin);
    await admin.nameInput.fill(uniquePlanName());
    await admin.daysPerWeekInput.fill('3');

    // No indicators yet
    await expect(admin.completeDayTabs()).toHaveCount(0);
    await expect(admin.incompleteDayTabs()).toHaveCount(0);

    // Add exercise without sets → incomplete (orange)
    await admin.addExercise('Bench');
    await expect(admin.incompleteDayTabs()).toHaveCount(1);

    // Add sets → complete (green)
    await admin.addSets(1, 3, 65, 5);
    await expect(admin.completeDayTabs()).toHaveCount(1);
    await expect(admin.incompleteDayTabs()).toHaveCount(0);
  });

  // 8. Progression rules — no default empty rule
  test('progression rules start empty with sensible defaults on add', async ({ admin }) => {
    await goToCreatePlan(admin);
    await admin.nameInput.fill(uniquePlanName());

    await admin.progressionRulesSection.scrollIntoViewIfNeeded();

    // Empty state
    const emptyMsg = admin.page.locator('.progression-rules-empty');
    await expect(emptyMsg).toBeVisible();

    // Add a rule
    await admin.addRuleButton.click();
    await expect(emptyMsg).not.toBeVisible();

    // Verify defaults
    await expect(admin.ruleMinReps(1)).toHaveValue('1');
    await expect(admin.ruleMaxReps(1)).toHaveValue('5');
    await expect(admin.ruleIncrease(1)).toHaveValue('2.5');
  });

  // 9. Set scheme — add set copies previous values
  test('add set copies values from previous set', async ({ admin }) => {
    await goToCreatePlan(admin);
    await admin.nameInput.fill(uniquePlanName());
    await admin.daysPerWeekInput.fill('1');

    await admin.addExercise('Bench');

    // Open set editor
    await admin.editSetsButton(1).click();
    await admin.setSchemeModal.waitFor();

    // Add first set and fill values
    await admin.addSetButton.click();
    const percentageInputs = admin.setSchemeModal.locator('.percentage-input');
    const repsInputs = admin.setSchemeModal.locator('.reps-input');
    await percentageInputs.first().fill('65');
    await repsInputs.first().fill('5');

    // Add second set — should copy percentage and reps from first
    await admin.addSetButton.click();
    await expect(admin.setRows).toHaveCount(2);
    await expect(percentageInputs.nth(1)).toHaveValue('65');
    await expect(repsInputs.nth(1)).toHaveValue('5');
  });

  // 10. Copy sets between exercises
  test('copy sets from one exercise to another', async ({ admin }) => {
    await goToCreatePlan(admin);
    await admin.nameInput.fill(uniquePlanName());
    await admin.daysPerWeekInput.fill('1');

    // Add two exercises
    await admin.addExercise('Bench');
    await admin.addExercise('Squat');

    // Add sets to exercise 1
    await admin.addSets(1, 3, 70, 5);

    // Copy to exercise 2
    const copySelect = admin.copySelect(2);
    await copySelect.selectOption({ index: 1 });

    // Open exercise 2 set editor and verify
    await admin.editSetsButton(2).click();
    await admin.setSchemeModal.waitFor();

    await expect(admin.setRows).toHaveCount(3);
    await expect(admin.setRows.first().locator('.percentage-input')).toHaveValue('70');
    await expect(admin.setRows.first().locator('.reps-input')).toHaveValue('5');
  });

  // 11. Delete exercise confirmation (with sets)
  test('confirms before deleting exercise with configured sets', async ({ admin }) => {
    await goToCreatePlan(admin);
    await admin.nameInput.fill(uniquePlanName());
    await admin.daysPerWeekInput.fill('1');

    await admin.addExercise('Bench');
    await admin.addSets(1, 3, 65, 5);

    // Click delete — custom confirm dialog appears
    await admin.removeExerciseButton(1).click();
    const dialog = admin.page.locator('.confirm-dialog__content');
    await expect(dialog).toBeVisible();

    // Dismiss confirmation — exercise stays
    await dialog.getByRole('button', { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible();
    await expect(admin.exerciseRows).toHaveCount(1);

    // Click delete again and accept — exercise removed
    await admin.removeExerciseButton(1).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /delete/i }).click();
    await expect(admin.exerciseRows).toHaveCount(0);
  });

  // 12. Delete exercise — no confirmation when empty
  test('deletes exercise without confirmation when no sets', async ({ admin }) => {
    await goToCreatePlan(admin);
    await admin.nameInput.fill(uniquePlanName());
    await admin.daysPerWeekInput.fill('1');

    await admin.addExercise('Bench');

    await admin.removeExerciseButton(1).click();
    // Should be removed immediately with no dialog
    await expect(admin.exerciseRows).toHaveCount(0);
    await expect(admin.page.locator('.confirm-dialog__content')).not.toBeVisible();
  });

  // 13. Exercise reorder visibility
  test('reorder arrows are visually distinct for movable exercises', async ({ admin }) => {
    await goToCreatePlan(admin);
    await admin.nameInput.fill(uniquePlanName());
    await admin.daysPerWeekInput.fill('1');

    await admin.addExercise('Bench');
    await admin.addExercise('Squat');

    await expect(admin.exerciseRows).toHaveCount(2);

    // First: up disabled, down enabled
    await expect(admin.moveUpButton(1)).toBeDisabled();
    await expect(admin.moveDownButton(1)).toBeEnabled();

    // Last: up enabled, down disabled
    await expect(admin.moveUpButton(2)).toBeEnabled();
    await expect(admin.moveDownButton(2)).toBeDisabled();
  });

  // 14. Sticky save button
  test('save button stays visible when scrolling', async ({ admin }) => {
    await goToCreatePlan(admin);
    await admin.nameInput.fill(uniquePlanName());
    await admin.daysPerWeekInput.fill('4');

    // Add exercises to multiple days to create scrollable content
    for (let day = 1; day <= 4; day++) {
      await admin.dayTab(day).click();
      await admin.addExercise('Bench');
    }

    // Scroll to bottom
    await admin.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Save button should still be visible (sticky)
    await expect(admin.saveButton).toBeVisible();
    await expect(admin.saveButton).toBeInViewport();
  });

  // 15. Edit existing plan — create, reload to edit mode, modify, save
  test('edit existing plan — loads data and saves changes', async ({ admin }) => {
    // First create a plan
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

    // Reload page to get a fresh edit mode load from the API
    await admin.page.reload();
    await admin.expandMetadata();
    await expect(admin.nameInput).toHaveValue(planName);
    await expect(admin.dayTabs).toHaveCount(2);
    await expect(admin.exerciseRows).not.toHaveCount(0);

    // Modify description
    const testDesc = `Updated description ${crypto.randomUUID().slice(0, 8)}`;
    await admin.descriptionInput.fill(testDesc);

    // Save
    await admin.saveButton.click();
    await expect(admin.successToast).toBeVisible();

    // Reload and verify persistence
    await admin.page.reload();
    await admin.expandMetadata();
    await expect(admin.descriptionInput).toHaveValue(testDesc);
  });
});
