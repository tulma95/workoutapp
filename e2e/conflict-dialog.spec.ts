import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

/** Click the "Start Workout" (or "Continue Workout") button inside a specific day card */
async function clickDayButton(page: Page, dayNumber: number) {
  const card = page.locator('.workout-card').filter({
    has: page.getByRole('heading', { name: `Day ${dayNumber}` }),
  })
  await card.getByRole('button').click()
}

/** Start a Day 1 workout from dashboard and wait for it to load */
async function startDay1Workout(page: Page) {
  await page.waitForSelector('text=Training Maxes')
  await clickDayButton(page, 1)
  await page.waitForURL(/\/workout\/\d+/)
  await expect(page.getByRole('heading', { name: /day 1/i })).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('checkbox').first()).toBeVisible()
}

/** Navigate back to dashboard and click Day 2, triggering conflict dialog */
async function triggerConflictDialog(page: Page) {
  await page.goto('/')
  await page.waitForSelector('text=Training Maxes')
  await clickDayButton(page, 2)
  await expect(
    page.getByRole('heading', { name: /workout in progress/i }),
  ).toBeVisible({ timeout: 5000 })
}

test.describe('Conflict Dialog', () => {
  test('starting a different day workout while one is in-progress shows conflict dialog', async ({
    setupCompletePage,
  }) => {
    const { page } = setupCompletePage
    await startDay1Workout(page)

    // Navigate back to dashboard and try to start Day 2
    await page.goto('/')
    await page.waitForSelector('text=Training Maxes')
    await clickDayButton(page, 2)

    // Wait for conflict dialog to appear - should mention "Day 1"
    await expect(page.getByText(/you have a day 1 workout/i)).toBeVisible({ timeout: 5000 })
  })

  test('clicking Continue button in conflict dialog navigates to existing workout', async ({
    setupCompletePage,
  }) => {
    const { page } = setupCompletePage
    await startDay1Workout(page)
    await triggerConflictDialog(page)

    // Click "Continue Day 1" button
    const continueButton = page.getByRole('button', { name: 'Continue Day 1' })
    await expect(continueButton).toBeVisible()
    await continueButton.click()

    // Should navigate to Day 1 workout page
    await page.waitForURL(/\/workout\/\d+/, { timeout: 10000 })
    await expect(page.getByRole('heading', { name: /day 1/i })).toBeVisible()
    await expect(page.getByText(/bench press/i).first()).toBeVisible()
  })

  test('clicking Discard & Start New button in conflict dialog starts the new workout', async ({
    setupCompletePage,
  }) => {
    const { page } = setupCompletePage
    await startDay1Workout(page)
    await triggerConflictDialog(page)

    // Click "Discard & Start New" button
    const discardButton = page.getByRole('button', { name: /discard.*start.*new/i })
    await expect(discardButton).toBeVisible()
    await discardButton.click()

    // Should navigate to a new workout page showing Day 2
    await page.waitForURL(/\/workout\/\d+/, { timeout: 10000 })
    await expect(page.getByRole('heading', { name: /day 2/i })).toBeVisible()
    await expect(page.getByText(/squat/i)).toBeVisible()
    await expect(page.getByText(/sumo.*deadlift/i)).toBeVisible()
  })

  test('clicking overlay outside conflict dialog navigates back to dashboard', async ({
    setupCompletePage,
  }) => {
    const { page } = setupCompletePage
    await startDay1Workout(page)
    await triggerConflictDialog(page)

    // Click the overlay (not the dialog content)
    const overlay = page.locator('.conflict-dialog-overlay')
    await expect(overlay).toBeVisible()
    await overlay.click({ position: { x: 10, y: 10 } })

    // Should navigate back to dashboard
    await page.waitForURL('/')
    await expect(page.getByText(/training maxes/i)).toBeVisible()
  })
})
