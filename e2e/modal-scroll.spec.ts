import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 650 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
})

test('Add bill keeps the page still while the dialog scrolls', async ({ page }) => {
  await page.locator('.bottom-nav').getByRole('button', { name: 'Calendar' }).click()
  await page.getByRole('button', { name: 'Add bill' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add a bill' })
  await expect(dialog).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('position', 'fixed')
  const backgroundTop = await page
    .locator('.page-content')
    .evaluate((element) => element.getBoundingClientRect().top)
  const box = await dialog.boundingBox()
  const dialogBefore = await dialog.evaluate((element) => element.scrollTop)
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.wheel(0, 450)
  await expect
    .poll(() => dialog.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(dialogBefore)
  const backgroundAfter = await page
    .locator('.page-content')
    .evaluate((element) => element.getBoundingClientRect().top)
  expect(backgroundAfter).toBe(backgroundTop)
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(page.locator('body')).not.toHaveCSS('position', 'fixed')
})

test('category transaction details do not swipe Home behind them', async ({ page }) => {
  const eye = page.getByRole('button', { name: 'View Rent transactions', exact: true })
  await eye.click()
  const dialog = page.getByRole('dialog', { name: 'Rent transactions' })
  await expect(dialog).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('position', 'fixed')
  const before = await page
    .locator('.page-content')
    .evaluate((element) => element.getBoundingClientRect().top)
  await page.mouse.move(4, 350)
  await page.mouse.wheel(0, 450)
  const after = await page
    .locator('.page-content')
    .evaluate((element) => element.getBoundingClientRect().top)
  expect(after).toBe(before)
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(page.locator('body')).not.toHaveCSS('position', 'fixed')
})
