import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function preview(page: Page) {
  await page.setViewportSize({ width: 402, height: 874 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
}
async function reachGoal(page: Page) {
  await page.locator('.bottom-nav').getByRole('button', { name: 'Goals', exact: true }).click()
  const goal = page.locator('.goal-card').filter({ hasText: 'Emergency fund' }).first()
  await goal.getByRole('button', { name: /^Save money/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('spinbutton', { name: 'Amount' }).fill('3650')
  await dialog.getByRole('button', { name: 'Save contribution' }).click()
  await expect(goal.locator('.goal-amount')).toContainText('$6,000')
}

test('only a recorded contribution celebrates; it can be dismissed and does not replay on reload', async ({
  page,
}) => {
  await preview(page)
  await expect(page.getByLabel('Savings goal reached')).toHaveCount(0)
  await reachGoal(page)
  const celebration = page.getByLabel('Savings goal reached')
  await expect(celebration).toBeVisible()
  await expect(celebration).toBeInViewport()
  await expect(celebration).toContainText('Emergency fund')
  for (const width of [320, 375, 402, 440, 1280]) {
    await page.setViewportSize({ width, height: 874 })
    await expect(celebration).toBeInViewport()
    if (width <= 760) {
      const notice = (await celebration.boundingBox())!
      const navigation = (await page.locator('.bottom-nav').boundingBox())!
      expect(notice.y + notice.height).toBeLessThanOrEqual(navigation.y - 8)
      expect(notice.x).toBeGreaterThanOrEqual(8)
      expect(notice.x + notice.width).toBeLessThanOrEqual(width - 8)
    }
    expect(
      await celebration.evaluate((node) => node.scrollWidth - node.clientWidth),
    ).toBeLessThanOrEqual(1)
    expect(
      await page.locator('html').evaluate((node) => node.scrollWidth - node.clientWidth),
    ).toBeLessThanOrEqual(1)
  }
  const results = await new AxeBuilder({ page })
    .include('.goal-reached')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()
  expect(results.violations).toEqual([])
  await page.setViewportSize({ width: 402, height: 874 })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: 'test-results/goal-reached-iphone.png' })
  await celebration.getByRole('button', { name: 'Dismiss goal celebration' }).click()
  await expect(celebration).toHaveCount(0)
  await expect(
    page
      .locator('.goal-card')
      .filter({ hasText: 'Emergency fund' })
      .first()
      .locator('.goal-amount'),
  ).toContainText('$6,000')
  await page.reload()
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
  await expect(celebration).toHaveCount(0)
})

test('goal celebrations can be switched off without changing savings behaviour', async ({
  page,
}) => {
  await preview(page)
  await page.locator('.bottom-nav').getByRole('button', { name: 'More', exact: true }).click()
  await page.getByRole('button', { name: 'Preferences', exact: true }).click()
  await page.getByRole('checkbox', { name: /^Goal celebrations/ }).click()
  await reachGoal(page)
  await expect(page.getByLabel('Savings goal reached')).toHaveCount(0)
})

test('saved entry feedback can reveal a filtered entry and undo its financial change', async ({
  page,
}) => {
  await preview(page)
  await page.locator('.bottom-nav').getByRole('button', { name: 'Activity', exact: true }).click()
  await page.getByRole('button', { name: /^Income \(/ }).click()
  await page.getByRole('button', { name: 'Add transaction', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'New transaction' })
  await dialog
    .getByRole('textbox', { name: 'Store or purchase (optional)' })
    .fill('Animation test purchase')
  await dialog.getByRole('spinbutton', { name: 'Amount' }).fill('12.34')
  await dialog.getByRole('button', { name: 'Save transaction', exact: true }).click()
  await page.getByRole('button', { name: 'Show entry', exact: true }).click()
  await expect(
    page.locator('.transaction-row').filter({ hasText: 'Animation test purchase' }),
  ).toBeVisible()
  await page.locator('.undo-strip').getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(
    page.locator('.transaction-row').filter({ hasText: 'Animation test purchase' }),
  ).toHaveCount(0)
})

test('reduced motion keeps milestone artwork still and sheets restore focus on Escape', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await preview(page)
  const trigger = page.getByRole('button', { name: 'Customize Home' })
  await trigger.click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await expect(page.locator('body')).not.toHaveCSS('position', 'fixed')
  await reachGoal(page)
  await expect(page.locator('.goal-reached img')).toHaveCSS('transform', 'none')
})

test('deleting a linked contribution clears a stale goal-reached message and restores progress', async ({
  page,
}) => {
  await preview(page)
  await reachGoal(page)
  await page.locator('.bottom-nav').getByRole('button', { name: 'Activity', exact: true }).click()
  await page.locator('.transaction-row').filter({ hasText: 'Savings for Emergency fund' }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByLabel('Savings goal reached')).toHaveCount(0)
  await page.locator('.bottom-nav').getByRole('button', { name: 'Goals', exact: true }).click()
  await expect(
    page
      .locator('.goal-card')
      .filter({ hasText: 'Emergency fund' })
      .first()
      .locator('.goal-amount'),
  ).toContainText('$2,350')
})
