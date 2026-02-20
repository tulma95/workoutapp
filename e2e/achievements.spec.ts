import { test, expect } from './fixtures';
import { DashboardPage } from './pages/dashboard.page';
import { WorkoutPage } from './pages/workout.page';

test.describe('Achievements', () => {
  test('completing Day 1 with 14 AMRAP reps unlocks First Blood and AMRAP King, shows dialog, and achievements page reflects state', async ({
    setupCompletePage,
  }) => {
    const { page } = setupCompletePage;
    const dashboard = new DashboardPage(page);
    const workout = new WorkoutPage(page);

    await dashboard.expectLoaded();
    await dashboard.startWorkout();
    await workout.expectLoaded(1);

    // Enter 14 reps on the AMRAP set (prescribed_reps=8, need 13+ to trigger amrap-king)
    await workout.fillAmrapAndWait('14');

    // Complete the workout (handle optional confirm dialog)
    await workout.completeWithDialog();

    // The achievement dialog should appear after completion
    const achievementDialog = page.getByTestId('achievement-dialog');
    await expect(achievementDialog).toBeVisible();
    await expect(achievementDialog).toContainText('Achievement Unlocked!');
    await expect(achievementDialog).toContainText('First Blood');
    await expect(achievementDialog).toContainText('AMRAP King');

    // Dismiss the dialog
    await achievementDialog.getByRole('button', { name: /awesome/i }).click();
    await expect(achievementDialog).not.toBeVisible();

    // Navigate to achievements page
    await page.goto('/achievements');

    // First Blood should be unlocked with a date
    const firstBloodCard = page.getByRole('listitem').filter({ hasText: 'First Blood' });
    await expect(firstBloodCard).toBeVisible();
    await expect(firstBloodCard).toContainText('Unlocked');

    // AMRAP King should be unlocked with a date
    const amrapKingCard = page.getByRole('listitem').filter({ hasText: 'AMRAP King' });
    await expect(amrapKingCard).toBeVisible();
    await expect(amrapKingCard).toContainText('Unlocked');

    // Consistent Lifter should be locked (requires 10 completed workouts)
    const consistentLifterCard = page.getByRole('listitem').filter({ hasText: 'Consistent Lifter' });
    await expect(consistentLifterCard).toBeVisible();
    await expect(consistentLifterCard).toContainText('Locked');
  });
});
