import { expect, test } from '@playwright/test'

test('the phone budget shows its breakdown without making recorded pay a full card', async ({
  page,
}) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
  await page.locator('.bottom-nav').getByRole('button', { name: 'Budget' }).click()

  const plan = page.getByRole('region', { name: 'Monthly income and plan' })
  const breakdown = page.getByRole('region', { name: 'Budget Breakdown' })
  const planBox = (await plan.boundingBox())!
  const breakdownBox = (await breakdown.boundingBox())!
  expect(planBox.height).toBeLessThan(270)
  expect(breakdownBox.y).toBeLessThan(874)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(403)

  const details = plan.locator('details')
  await expect(details).not.toHaveAttribute('open')
  await details.locator('summary').click()
  await expect(details).toHaveAttribute('open')
  await expect(details).toContainText('If a paycheque is higher or lower than expected')
})

test('budget slices and rows focus the same category on iPhone', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
  await page.locator('.bottom-nav').getByRole('button', { name: 'Budget' }).click()
  const panel = page.getByRole('region', { name: 'Budget Breakdown' })
  const chart = panel.locator('.budget-donut-chart')
  const segments = panel.locator('.budget-donut-segment')
  await expect.poll(() => segments.count()).toBeGreaterThan(5)
  await expect(panel.locator('.budget-donut-center')).toContainText('TOTAL BUDGET')
  const rent = panel.getByRole('button', { name: /^Show Rent:/ })
  const svgBox = (await chart.boundingBox())!
  const dash = await rent.getAttribute('stroke-dasharray')
  const share = Number(dash!.split(' ')[0]) / (2 * Math.PI * 85)
  const angle = ((-90 + (share * 360) / 2) * Math.PI) / 180
  const ringRadius = (svgBox.width * 85) / 240
  await page.mouse.click(
    svgBox.x + svgBox.width / 2 + ringRadius * Math.cos(angle),
    svgBox.y + svgBox.height / 2 + ringRadius * Math.sin(angle),
  )
  await expect(rent).toHaveAttribute('aria-pressed', 'true')
  await expect(panel.locator('.budget-donut-center')).toContainText('Rent')
  await expect(panel.locator('.budget-donut-center')).toContainText('% of total budget')
  expect(await panel.locator('.budget-donut-segment.dimmed').count()).toBe(
    (await segments.count()) - 1,
  )
  const rentRow = panel.getByRole('button', { name: /^Highlight Rent,/ })
  await expect(rentRow).toHaveAttribute('aria-pressed', 'true')
  await expect(rentRow.locator('.budget-breakdown-percent')).toBeVisible()
  const groceries = panel.getByRole('button', { name: /^Highlight Groceries,/ })
  await groceries.click()
  await expect(panel.locator('.budget-donut-center')).toContainText('Groceries')
  await groceries.click()
  await expect(panel.locator('.budget-donut-center')).toContainText('TOTAL BUDGET')
})

test('the budget chart stays readable in light and dark phone layouts', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
  await page.locator('.bottom-nav').getByRole('button', { name: 'Budget' }).click()
  for (const width of [320, 402, 1280]) {
    await page.setViewportSize({ width, height: 874 })
    const panel = page.getByRole('region', { name: 'Budget Breakdown' })
    const chart = panel.locator('.budget-donut-chart')
    const panelBox = (await panel.boundingBox())!
    const chartBox = (await chart.boundingBox())!
    expect(chartBox.width).toBeGreaterThan(220)
    expect(chartBox.x).toBeGreaterThanOrEqual(panelBox.x)
    expect(chartBox.x + chartBox.width).toBeLessThanOrEqual(panelBox.x + panelBox.width + 1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width + 1,
    )
    if (width === 402) {
      await page.getByRole('button', { name: 'Switch to light mode' }).click()
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
      await expect
        .poll(() =>
          page.locator('html').evaluate((element) => element.classList.contains('theme-revealing')),
        )
        .toBe(false)
    }
  }
})

test('long names and large planned amounts stay inside the small-phone chart', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 874 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
  await page.locator('.bottom-nav').getByRole('button', { name: 'Budget' }).click()
  await page.locator('.allocation-row').filter({ hasText: 'Rent' }).first().click()
  const editor = page.getByRole('dialog', { name: 'Edit category' })
  const categoryName = 'A very long housing and parking category name'
  await editor.getByLabel('Category name').fill(categoryName)
  await editor.getByLabel('Amount to plan each period').fill('123456789.12')
  await editor.getByRole('button', { name: 'Save category' }).click()
  const panel = page.getByRole('region', { name: 'Budget Breakdown' })
  await panel.getByRole('button', { name: new RegExp(`^Highlight ${categoryName},`) }).click()
  await expect(panel.locator('.budget-donut-center')).toContainText(categoryName)
  const stage = (await panel.locator('.budget-donut-stage').boundingBox())!
  const amount = (await panel.locator('.budget-donut-center strong').boundingBox())!
  expect(amount.x).toBeGreaterThanOrEqual(stage.x)
  expect(amount.x + amount.width).toBeLessThanOrEqual(stage.x + stage.width + 1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321)
})
