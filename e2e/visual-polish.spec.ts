import { expect, test } from '@playwright/test'

test('completion preview has its own readable space on small and large screens', async ({
  page,
}) => {
  await page.goto('/')
  for (const width of [320, 402, 1280]) {
    await page.setViewportSize({ width, height: 850 })
    await page.evaluate(() => {
      document.getElementById('root')!.innerHTML =
        `<div class="onboarding"><div class="onboarding-body"><div class="finish-card"><div class="finish-icon">✓</div><strong>Good things start with a clear picture.</strong><p>A first draft in Canadian dollars.</p><div class="onboarding-plan-preview" aria-label="Starting monthly plan"><div><span>Pay this month</span><strong>$4,000.00</strong></div><div><span>Starting monthly plan</span><strong>$3,500.00</strong></div><div><span>Not yet planned</span><strong>$500.00</strong></div><small>This is a plan, not money already spent.</small></div></div></div></div>`
    })
    const icon = await page.locator('.finish-icon').boundingBox()
    const preview = await page.getByLabel('Starting monthly plan').boundingBox()
    const card = await page.locator('.finish-card').boundingBox()
    expect(icon!.width).toBe(86)
    expect(preview!.width).toBeGreaterThan(200)
    expect(preview!.y).toBeGreaterThan(icon!.y + icon!.height)
    expect(preview!.x).toBeGreaterThanOrEqual(card!.x)
    expect(preview!.x + preview!.width).toBeLessThanOrEqual(card!.x + card!.width + 1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width + 1,
    )
  }
})

test('phone header controls and goal charts are legible and inside their cards', async ({
  page,
}) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await page.goto('/')
  await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute(
    'content',
    'black',
  )
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
  const topbar = await page.locator('.topbar').boundingBox()
  for (const button of await page.locator('.topbar button').all()) {
    if (!(await button.isVisible())) continue
    const box = await button.boundingBox()
    expect(box!.y).toBeGreaterThanOrEqual(topbar!.y)
    expect(box!.y + box!.height).toBeLessThanOrEqual(topbar!.y + topbar!.height + 1)
  }
  const help = page.locator('.help').first()
  expect(await help.evaluate((element) => getComputedStyle(element).borderTopWidth)).toBe('0px')
  await page.getByRole('button', { name: 'Goals', exact: true }).click()
  const chart = page.locator('.goal-chart').first()
  const chartBox = await chart.boundingBox()
  const svgBox = await chart.locator('svg').boundingBox()
  expect(svgBox!.height).toBeGreaterThanOrEqual(135)
  expect(svgBox!.x).toBeGreaterThanOrEqual(chartBox!.x)
  expect(svgBox!.x + svgBox!.width).toBeLessThanOrEqual(chartBox!.x + chartBox!.width + 1)
  await page.getByRole('button', { name: /Switch to (light|dark) mode/ }).click()
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f6f6fc')
  await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute(
    'content',
    'default',
  )
})
