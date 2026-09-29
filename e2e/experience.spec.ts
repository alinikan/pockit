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

test('Home sections can be hidden, moved, and reset on an iPhone-sized screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await preview(page)
  const monthlyPlan = (await page.getByText('YOUR MONTHLY PLAN', { exact: true }).boundingBox())!
  const nextMove = (await page.getByLabel('Pockit Today').boundingBox())!
  expect(monthlyPlan.y).toBeLessThan(nextMove.y)
  await page.getByRole('button', { name: 'Customize Home' }).click()
  const dialog = page.getByRole('dialog', { name: 'Customize Home' })
  await dialog.getByRole('checkbox', { name: /Weekly check-in/ }).uncheck()
  await expect(page.getByLabel('Pockit Pulse')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Drag Income and expenses to reorder' }).press('ArrowUp')
  await expect(dialog.locator('.home-layout-row').nth(4)).toContainText('Income and expenses')
  await dialog
    .getByRole('button', { name: 'Drag Income and expenses to reorder' })
    .dragTo(dialog.locator('[data-home-section="overview"]'))
  await expect(dialog.locator('.home-layout-row').first()).toContainText('Income and expenses')
  await dialog.getByRole('button', { name: 'Reset layout' }).click()
  await expect(page.getByLabel('Pockit Pulse')).toBeVisible()
  await noOverflow(page)
})

test('recorded income uses its real date and amount on Home', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await preview(page)
  await page.getByRole('button', { name: 'Record income' }).click()
  const form = page.getByRole('dialog', { name: 'New transaction' })
  await expect(form.getByRole('button', { name: 'Income' })).toHaveClass(/active/)
  await form.getByRole('textbox', { name: 'Income from' }).fill('Overtime pay')
  await form.getByRole('spinbutton', { name: 'Amount' }).fill('567.89')
  await form.getByRole('button', { name: 'Save transaction' }).click()
  await expect(page.getByText('Overtime pay')).toBeVisible()
  await page.locator('.bottom-nav').getByRole('button', { name: 'Home' }).click()
  await expect(page.getByText('Left in your monthly plan')).toBeVisible()
  await noOverflow(page)
})

test('Calendar opens manual income entry with the selected day', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await preview(page)
  await page.locator('.bottom-nav').getByRole('button', { name: 'Calendar' }).click()
  await page.getByRole('button', { name: /^18$/ }).click()
  await page.getByRole('button', { name: 'Record income for this day' }).click()
  const form = page.getByRole('dialog', { name: 'New transaction' })
  await expect(form.getByRole('button', { name: 'Income' })).toHaveClass(/active/)
  const date = await form.locator('input[type="date"]').first().inputValue()
  expect(date).toMatch(/^\d{4}-\d{2}-18$/)
  await expect(form.getByRole('spinbutton', { name: 'Amount' })).toBeEmpty()
})

test('iPhone bottom tabs can be simplified while every page remains reachable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await preview(page)
  await page.locator('.bottom-nav').getByRole('button', { name: 'More' }).click()
  await page.getByRole('button', { name: 'Preferences' }).click()
  await page.getByText('iPhone bottom tabs').click()
  await page.getByRole('checkbox', { name: 'Compare' }).uncheck()
  await expect(page.locator('.bottom-nav').getByRole('button', { name: 'Compare' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Search pages and actions' }).click()
  const search = page.getByRole('dialog', { name: 'Search Pockit' })
  await search.getByRole('combobox', { name: 'Search pages and actions' }).fill('compare')
  await search.getByRole('combobox', { name: 'Search pages and actions' }).press('Enter')
  await expect(page.getByRole('heading', { name: 'Put your months in perspective.' })).toBeVisible()
  await page.locator('.bottom-nav').getByRole('button', { name: 'More' }).click()
  await page.getByRole('button', { name: 'Preferences' }).click()
  await page.getByText('iPhone bottom tabs').click()
  await page.getByRole('button', { name: 'Reset bottom tabs' }).click()
  await expect(page.locator('.bottom-nav').getByRole('button', { name: 'Compare' })).toBeVisible()
  await noOverflow(page)
})

test('quick actions and appearance switch work from the top bar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 850 })
  await preview(page)
  await page.keyboard.press('ControlOrMeta+k')
  const dialog = page.getByRole('dialog', { name: 'Search Pockit' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('combobox', { name: 'Search pages and actions' }).fill('compare')
  await dialog.getByRole('combobox', { name: 'Search pages and actions' }).press('Enter')
  await expect(page.getByRole('heading', { name: 'Put your months in perspective.' })).toBeVisible()
  await page.getByRole('button', { name: 'Switch to light mode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('Calendar turns a planned phone cost into a dated reminder without recording a payment', async ({
  page,
}) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await preview(page)
  await page.locator('.bottom-nav').getByRole('button', { name: 'Calendar' }).click()
  await page.getByRole('button', { name: /Set Phone date/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Add a bill' })
  await expect(dialog.getByRole('button', { name: 'Save bill' })).toBeDisabled()
  await dialog.getByRole('spinbutton', { name: 'Day of month' }).fill('15')
  await dialog.getByRole('button', { name: 'Save bill' }).click()
  await expect(page.getByRole('button', { name: /Set Phone date/ })).toHaveCount(0)
  await page.getByRole('button', { name: '15', exact: true }).click()
  await expect(page.getByText('Phone', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Record payment' })).toBeVisible()
  await noOverflow(page)
})

test('a merchant rule suggests a category and tags make the new transaction searchable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await preview(page)
  await page.locator('.bottom-nav').getByRole('button', { name: 'More' }).click()
  await page.getByRole('button', { name: 'Preferences' }).click()
  await page.getByText('Merchant category rules').click()
  await page.getByRole('textbox', { name: 'Payee for new rule' }).fill('My Cafe')
  await page
    .getByRole('combobox', { name: 'Category for new rule' })
    .selectOption({ label: 'Groceries' })
  await page.getByRole('button', { name: 'Add rule' }).click()
  await expect(page.getByRole('button', { name: 'Remove rule for my cafe' })).toBeVisible()
  await page.locator('.bottom-nav').getByRole('button', { name: 'Activity' }).click()
  await page.getByRole('button', { name: 'Add transaction', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'New transaction' })
  await dialog.getByRole('textbox', { name: 'Payee or description' }).fill('My Cafe')
  await expect(dialog.getByRole('combobox', { name: 'Category' })).toHaveValue(
    (await page
      .locator('select[aria-label="Filter category"] option', { hasText: 'Groceries' })
      .getAttribute('value')) || '',
  )
  await dialog.getByRole('spinbutton', { name: 'Amount' }).fill('12')
  await dialog.getByRole('textbox', { name: /Tags \(optional\)/ }).fill('work, reimbursable')
  await dialog.getByRole('button', { name: 'Save transaction' }).click()
  await page.getByPlaceholder('Search transactions').fill('reimbursable')
  await expect(page.locator('.transaction-row')).toHaveCount(1)
  await expect(page.locator('.transaction-row')).toContainText('My Cafe')
  await noOverflow(page)
})

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
      await page.getByRole('button', { name: 'Home', exact: true }).click()
      const fab = await page.getByRole('button', { name: 'Quick add transaction' }).boundingBox()
      const nav = await page.locator('.bottom-nav').boundingBox()
      expect(fab!.y + fab!.height).toBeLessThan(nav!.y)
      await page.getByRole('button', { name: 'More', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Quick add transaction' })).toHaveCount(0)
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
  await page.getByRole('button', { name: 'More ways to add' }).click()
  const recentMerchant = page.locator('.recent-merchants button').first()
  const merchantName = (await recentMerchant.innerText()).trim()
  await recentMerchant.click()
  await expect(page.getByLabel('Payee or description')).toHaveValue(merchantName)
  await page
    .getByRole('dialog', { name: 'New transaction' })
    .getByRole('button', { name: 'Close' })
    .click()
  await page.getByRole('button', { name: 'Import transactions from a CSV file' }).click()
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
  await page.getByRole('button', { name: 'Install Pockit' }).click()
  await expect(page.getByText('Put Pockit on your Home Screen')).toBeVisible()
  await page.getByRole('button', { name: 'Back to More' }).click()
  await page.getByRole('button', { name: 'Paycheques' }).click()
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
  const chart = page.getByRole('button', { name: /Inspect Emergency fund projection/i })
  const chartBox = await chart.boundingBox()
  await page.mouse.move(chartBox!.x + chartBox!.width * 0.6, chartBox!.y + chartBox!.height / 2)
  await page.mouse.down()
  await expect(chart.locator('..').getByText(/Month \d+ ·/)).toBeVisible()
  await page.mouse.up()
  await expect(chart.locator('..').getByText('Today')).toBeVisible()
  await expect(chart.locator('..').locator('.goal-chart-axis')).toContainText(/20\d\d/)
  await page.getByRole('button', { name: 'Budget', exact: true }).click()
  const breakdown = page.getByRole('region', { name: 'Budget Breakdown' })
  await breakdown.getByRole('button', { name: /^Highlight Groceries,/ }).click()
  await expect(breakdown.locator('.budget-donut-center')).toContainText('Groceries')
  for (const button of await page.locator('button:visible').all()) {
    const box = await button.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(44)
  }
  await context.close()
})

test('colour choices, light mode, and carryover explanation fit a small iPhone screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await preview(page)
  await page.getByRole('button', { name: 'More', exact: true }).click()
  await page.getByRole('button', { name: 'Preferences' }).click()
  await page.getByRole('radio', { name: /Coral Slate/ }).click()
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'waypoint')
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#111827')
  await page.getByRole('button', { name: /Switch to (light|dark) mode/ }).click()
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f7f8fb')
  for (const palette of ['Pacific', 'Afterglow', 'Pockit Garden']) {
    await page.getByRole('radio', { name: new RegExp(palette) }).click()
    const dimensions = await page.evaluate(() => [
      document.documentElement.clientWidth,
      document.documentElement.scrollWidth,
    ])
    expect(dimensions[1]).toBeLessThanOrEqual(dimensions[0] + 1)
  }
  await page.getByRole('button', { name: 'Budget', exact: true }).click()
  await page
    .locator('.allocation-row')
    .filter({ hasText: /^Savings/ })
    .click()
  await expect(page.getByText('How this month’s balance adds up')).toBeVisible()
  await expect(page.locator('.rollover-breakdown')).toContainText('Carried from last month')
  await expect(page.locator('.rollover-breakdown')).toContainText('Available now')
  const dialog = page.getByRole('dialog', { name: 'Edit category' })
  const bounds = await dialog.boundingBox()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391)
})
