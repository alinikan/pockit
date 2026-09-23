import { expect, test, type Page } from '@playwright/test'

async function openCompare(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
  await page.getByRole('button', { name: 'Compare', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Put your months in perspective.' })).toBeVisible()
}

async function noPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll<HTMLElement>('*')]
      .filter(
        (element) =>
          element.getBoundingClientRect().right > document.documentElement.clientWidth + 1 ||
          element.scrollWidth > element.clientWidth + 1,
      )
      .slice(0, 28)
      .map((element) => ({
        tag: element.tagName,
        className: typeof element.className === 'string' ? element.className : '',
        right: Math.round(element.getBoundingClientRect().right),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      })),
  }))
  expect(dimensions.content, JSON.stringify(dimensions.offenders)).toBeLessThanOrEqual(
    dimensions.viewport + 1,
  )
}

test('mobile navigation and comparison cards stay inside narrow viewports', async ({ page }) => {
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 800 })
    if (width === 320) await openCompare(page)
    const nav = page.locator('.bottom-nav')
    await expect(nav).toBeVisible()
    const navBox = await nav.boundingBox()
    expect(navBox).not.toBeNull()
    expect(navBox!.x).toBeGreaterThanOrEqual(0)
    expect(navBox!.x + navBox!.width).toBeLessThanOrEqual(width + 1)
    const buttons = nav.locator('button')
    await expect(buttons).toHaveCount(7)
    expect((await buttons.allTextContents()).map((label) => label.trim())).toEqual([
      'Home',
      'Activity',
      'Budget',
      'Calendar',
      'Goals',
      'Compare',
      'More',
    ])
    for (const button of await buttons.all()) {
      const box = await button.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.width).toBeGreaterThanOrEqual(40)
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1)
    }
    const cards = page.locator('.compare-overview-column')
    await expect(cards).toHaveCount(2)
    const grid = await page.locator('.compare-overview-grid').boundingBox()
    expect(grid).not.toBeNull()
    for (const card of await cards.all()) {
      const box = await card.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x).toBeGreaterThanOrEqual(grid!.x - 1)
      expect(box!.x + box!.width).toBeLessThanOrEqual(grid!.x + grid!.width + 1)
    }
    await noPageOverflow(page)
  }
})

test('comparison controls persist across tabs and never overflow the mobile page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openCompare(page)
  await page.getByRole('button', { name: 'Add month' }).click()
  await page.getByRole('button', { name: 'Add month' }).click()
  await expect(page.locator('input[type="month"]')).toHaveCount(4)
  await expect(page.getByRole('button', { name: 'Add month' })).toHaveCount(0)
  await page.getByRole('tab', { name: /Categories/ }).click()
  await expect(page.getByRole('table')).toBeVisible()
  const table = page.locator('.compare-table-scroll')
  const widths = await table.evaluate((element) => ({
    visible: element.clientWidth,
    full: element.scrollWidth,
  }))
  expect(widths.full).toBeGreaterThan(widths.visible)
  await page.getByRole('button', { name: 'Activity', exact: true }).click()
  await page.getByRole('button', { name: 'Compare', exact: true }).click()
  await expect(page.locator('input[type="month"]')).toHaveCount(4)
  await expect(page.getByRole('tab', { name: /Categories/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page
    .getByRole('button', { name: /^Remove / })
    .first()
    .click()
  await page
    .getByRole('button', { name: /^Remove / })
    .first()
    .click()
  await expect(page.locator('input[type="month"]')).toHaveCount(2)
  await noPageOverflow(page)
})

test('desktop sidebar, sections, and theme remain laid out', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await openCompare(page)
  await expect(page.locator('.sidebar')).toBeVisible()
  await expect(page.locator('.bottom-nav')).toBeHidden()
  const sidebar = await page.locator('.sidebar').boundingBox()
  const content = await page.locator('.page-content').boundingBox()
  expect(sidebar).not.toBeNull()
  expect(content).not.toBeNull()
  expect(content!.x).toBeGreaterThanOrEqual(sidebar!.x + sidebar!.width - 1)
  await page.getByRole('tab', { name: /Trend/ }).click()
  await expect(page.getByRole('group', { name: /Spending over 6 months/ })).toBeVisible()
  await page.getByRole('tab', { name: /Plan vs actual/ }).click()
  await expect(page.getByRole('heading', { name: 'Plan vs actual' })).toBeVisible()
  await page.getByRole('button', { name: 'Toggle theme' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await noPageOverflow(page)
})

test('all seven app tabs remain reachable without horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
  for (const width of [320, 390, 760, 761, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    for (const name of ['Home', 'Activity', 'Budget', 'Calendar', 'Goals', 'Compare', 'More']) {
      await page.getByRole('button', { name, exact: true }).click()
      await expect(page.locator('.page-heading h1')).toBeVisible()
      await noPageOverflow(page)
    }
  }
})

test('four-month overview keeps all cards within the comparison area on a small phone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await openCompare(page)
  await page.getByRole('button', { name: 'Add month' }).click()
  await page.getByRole('button', { name: 'Add month' }).click()
  const grid = await page.locator('.compare-overview-grid').boundingBox()
  expect(grid).not.toBeNull()
  const cards = page.locator('.compare-overview-column')
  await expect(cards).toHaveCount(4)
  for (const card of await cards.all()) {
    const box = await card.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(grid!.x - 1)
    expect(box!.x + box!.width).toBeLessThanOrEqual(grid!.x + grid!.width + 1)
  }
  await noPageOverflow(page)
})

test('long user-entered category names and large amounts do not break the phone layout', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
  await page.getByRole('button', { name: 'Budget', exact: true }).click()
  await page.getByRole('button', { name: 'Add category' }).click()
  const longName = 'AnnualVehicleRegistrationAndUnexpectedMaintenanceForTheWholeFamily'
  await page.getByLabel('Category name').fill(longName)
  await page.getByLabel('Amount each period').fill('12345678.90')
  await noPageOverflow(page)
  await page.getByRole('button', { name: 'Save category' }).click()
  await noPageOverflow(page)
  await page.getByRole('button', { name: 'Compare', exact: true }).click()
  await page.getByRole('tab', { name: /Categories/ }).click()
  await page.getByLabel('Include $0 categories').check()
  await expect(page.getByRole('row', { name: new RegExp(longName) })).toBeVisible()
  await noPageOverflow(page)
  await page.getByRole('tab', { name: /Plan vs actual/ }).click()
  await noPageOverflow(page)
})

test('editing dialogs fit a small phone and keep their actions reachable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
  for (const [tab, action, title] of [
    ['Activity', 'Add transaction', 'New transaction'],
    ['Budget', 'Add category', 'New category'],
  ]) {
    await page.getByRole('button', { name: tab, exact: true }).click()
    await page.getByRole('button', { name: action, exact: true }).click()
    const dialog = page.getByRole('dialog', { name: title })
    await expect(dialog).toBeVisible()
    const box = await dialog.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(321)
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height).toBeLessThanOrEqual(569)
    const actionButton = dialog.getByRole('button', {
      name: `Save ${tab === 'Activity' ? 'transaction' : 'category'}`,
    })
    await actionButton.scrollIntoViewIfNeeded()
    await expect(actionButton).toBeInViewport()
    await dialog.getByRole('button', { name: 'Close' }).click()
    await noPageOverflow(page)
  }
})
