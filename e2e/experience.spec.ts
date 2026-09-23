import { expect, test, type Page } from '@playwright/test'

async function preview(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
}
async function noOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }))
  expect(widths.content).toBeLessThanOrEqual(widths.viewport + 1)
}

test('iPhone Air, iPhone 17 Pro, newer phone, MacBook, and Windows-sized layouts stay usable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await preview(page)
  for (const width of [402, 420, 440, 1280, 1440]) {
    await page.setViewportSize({ width, height: 874 })
    for (const name of ['Home', 'Activity', 'Budget', 'Calendar', 'Goals', 'Compare', 'More']) {
      await page.getByRole('button', { name, exact: true }).click()
      await noOverflow(page)
    }
    if (width < 761) {
      for (const button of await page.locator('.bottom-nav button').all()) {
        const box = await button.boundingBox()
        expect(box!.width).toBeGreaterThanOrEqual(44)
        expect(box!.height).toBeGreaterThanOrEqual(44)
      }
      const fab = await page.getByRole('button', { name: 'Quick add transaction' }).boundingBox()
      const nav = await page.locator('.bottom-nav').boundingBox()
      expect(fab!.y + fab!.height).toBeLessThan(nav!.y)
    }
  }
})

test('quick add, recent merchant, undo, and CSV review work on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await preview(page)
  await page.getByRole('button', { name: 'Quick add transaction' }).click()
  await expect(page.getByRole('dialog', { name: 'New transaction' })).toBeVisible()
  await page.getByLabel('Payee or description').fill('Pockit Test Shop')
  await page
    .getByRole('dialog', { name: 'New transaction' })
    .getByRole('spinbutton', { name: 'Amount' })
    .fill('12.50')
  await page.getByRole('button', { name: 'Save transaction' }).click()
  await expect(
    page.locator('.transaction-row').filter({ hasText: 'Pockit Test Shop' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(
    page.locator('.transaction-row').filter({ hasText: 'Pockit Test Shop' }),
  ).toHaveCount(0)
  const recentMerchant = page.locator('.recent-merchants button').first()
  const merchantName = (await recentMerchant.innerText()).trim()
  await recentMerchant.click()
  await expect(page.getByLabel('Payee or description')).toHaveValue(merchantName)
  await page
    .getByRole('dialog', { name: 'New transaction' })
    .getByRole('button', { name: 'Close' })
    .click()
  await page.getByRole('button', { name: 'Import CSV' }).click()
  const date = await page.evaluate(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })
  await page.getByLabel('Bank CSV file').setInputFiles({
    name: 'transactions.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(`Date,Description,Amount\n${date},A New Shop,-19.75\ninvalid,Wrong,-2`),
  })
  await expect(
    page.getByText(
      /1 selected · 0 possible matches to review · 0 matching reference IDs skipped · 1 rows need review/,
    ),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Import selected transactions' }).click()
  await expect(page.locator('.transaction-row').filter({ hasText: 'A New Shop' })).toBeVisible()
  await noOverflow(page)
})

test('paycheque estimate, What-if Lab, comparison details, and install help are reachable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 420, height: 900 })
  await preview(page)
  await page.getByRole('button', { name: 'More', exact: true }).click()
  await expect(page.getByText('Put Pockit on your Home Screen')).toBeVisible()
  await page.getByLabel('Money available now').fill('500')
  await page.getByRole('button', { name: 'Home', exact: true }).click()
  await expect(page.getByText('Estimated after upcoming bills')).toBeVisible()
  await page.getByRole('button', { name: 'Goals', exact: true }).click()
  const lab = page.getByRole('region', { name: 'What-if Lab' })
  await expect(lab).toBeVisible()
  const before = await lab.locator('.whatif-results').innerText()
  await lab.getByRole('spinbutton', { name: 'Extra debt payment each month' }).fill('100')
  expect(await lab.locator('.whatif-results').innerText()).not.toBe(before)
  await page.getByRole('button', { name: 'Compare', exact: true }).click()
  await page.getByRole('tab', { name: /Categories/ }).click()
  await page.getByRole('button', { name: 'Explain Groceries' }).click()
  await expect(page.getByRole('heading', { name: 'Why Groceries changed' })).toBeVisible()
  await expect(page.locator('.compare-drilldown')).toContainText('Fresh Market')
  await noOverflow(page)
})

test('reduced motion turns off decorative transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await preview(page)
  const duration = await page
    .locator('.quick-add-fab')
    .evaluate((element) => getComputedStyle(element).transitionDuration)
  expect(parseFloat(duration)).toBeLessThan(0.01)
})

test('touch controls stay at least 44 pixels high and charts expose their values', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 402, height: 874 },
    hasTouch: true,
    isMobile: true,
  })
  const page = await context.newPage()
  await preview(page)
  expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
  await page.getByRole('button', { name: 'Goals', exact: true }).click()
  await page.getByRole('slider', { name: /Inspect Emergency fund projection/i }).fill('3')
  await expect(page.getByText(/Month 3:/)).toBeVisible()
  await page.getByRole('button', { name: 'Budget', exact: true }).click()
  await page.getByRole('button', { name: 'Inspect Groceries allocation' }).click()
  await expect(page.getByRole('status')).toContainText('Groceries:')
  for (const button of await page.locator('button:visible').all()) {
    const box = await button.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(44)
  }
  await context.close()
})
