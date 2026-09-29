import { expect, test, type Page } from '@playwright/test'

async function preview(page: Page) {
  await page.setViewportSize({ width: 402, height: 874 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
}

test('tab, chart, and dialog motion is present without widening the phone layout', async ({
  page,
}) => {
  await preview(page)
  const nav = page.locator('.bottom-nav')
  await nav.getByRole('button', { name: 'Budget' }).click()
  await expect(page.getByRole('heading', { name: 'Your monthly budget.' })).toBeVisible()
  const headingMotion = await page
    .locator('.page-heading')
    .evaluate((node) => getComputedStyle(node).animationName)
  const pageMotion = await page
    .locator('.page-content > .screen-stack')
    .evaluate((node) => getComputedStyle(node).animationName)
  expect(headingMotion).toBe('pockit-heading-in')
  expect(pageMotion).toBe('pockit-page-in')
  await expect(page.locator('.page-content > .screen-stack')).toHaveCSS('transform', 'none')

  const chartSlice = page.locator('.budget-donut-segment').first()
  if (await chartSlice.count()) {
    const chartTransition = await chartSlice.evaluate(
      (node) => getComputedStyle(node).transitionProperty,
    )
    expect(chartTransition).toContain('stroke-dasharray')
  }

  await nav.getByRole('button', { name: 'Compare' }).click()
  await expect(page.getByRole('heading', { name: 'Put your months in perspective.' })).toBeVisible()
  const compareMotion = await page
    .locator('.compare-stage')
    .evaluate((node) => getComputedStyle(node).animationName)
  expect(compareMotion).toBe('pockit-page-in')
  await expect(page.locator('.compare-stage')).toHaveCSS('transform', 'none')

  await nav.getByRole('button', { name: 'Activity' }).click()
  await page.getByRole('button', { name: 'Add transaction', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'New transaction' })
  await expect(dialog).toBeVisible()
  expect(await dialog.evaluate((node) => getComputedStyle(node).animationName)).toBe(
    'pockit-dialog-in',
  )
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }))
  expect(widths.content).toBeLessThanOrEqual(widths.viewport + 1)
})

test('reduced motion removes navigation and dialog entrance animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await preview(page)
  await page.locator('.bottom-nav').getByRole('button', { name: 'Activity' }).click()
  expect(
    await page.locator('.page-heading').evaluate((node) => getComputedStyle(node).animationName),
  ).toBe('none')
  await page.getByRole('button', { name: 'Add transaction', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'New transaction' })
  expect(await dialog.evaluate((node) => getComputedStyle(node).animationName)).toBe('none')
  await expect(dialog).toBeVisible()
})
