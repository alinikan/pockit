import { expect, test, type Page } from '@playwright/test'

test.use({ hasTouch: true, reducedMotion: 'reduce' })

async function fit(page: Page, label: string) {
  const problems = await page.evaluate(() => {
    const width = document.documentElement.clientWidth
    const targets = document.querySelectorAll<HTMLElement>(
      '.page-content, .topbar, .bottom-nav, .panel, .more-menu, .more-detail, .modal, .help-popover, .coach-panel, input:not([type="checkbox"]):not([type="radio"]), select, textarea',
    )
    const bad: string[] = []
    for (const el of targets) {
      if (!el.getClientRects().length || el.closest('[hidden]')) continue
      // Tables have an intentional local horizontal scroller; their parent must fit.
      if (el.closest('.compare-table-scroll')) continue
      const box = el.getBoundingClientRect()
      if (!box.width) continue
      if (box.left < -1 || box.right > width + 1)
        bad.push(`${el.tagName}.${el.className}: ${box.left.toFixed(1)}..${box.right.toFixed(1)}`)
      if (
        ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) &&
        parseFloat(getComputedStyle(el).fontSize) < 16
      )
        bad.push(`${el.tagName} ${el.getAttribute('aria-label') || ''}: small input font`)
    }
    if (document.documentElement.scrollWidth > width + 1 || document.body.scrollWidth > width + 1)
      bad.push(`document wider than ${width}`)
    return bad
  })
  expect(problems, label).toEqual([])
}

test('all tabs, More destinations, and dialogs fit narrow and landscape iPhone screens', async ({
  page,
}) => {
  test.setTimeout(120_000)
  page.setDefaultTimeout(7000)
  await page.setViewportSize({ width: 402, height: 874 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
  const nav = page.locator('.bottom-nav')
  for (const width of [320, 375, 402, 440, 874, 956]) {
    await page.setViewportSize({ width, height: width > 760 ? 402 : 874 })
    for (const name of ['Home', 'Activity', 'Budget', 'Calendar', 'Goals', 'Compare', 'More']) {
      // A layout that switches to a desktop sidebar on an iPhone rotation is a regression.
      await nav.getByRole('button', { name, exact: true }).click()
      await fit(page, `${name} at ${width}`)
    }
    for (const name of [
      'Profile',
      'Accounts',
      'Paycheques',
      'Preferences',
      'Notifications',
      'Imports & data',
      'Install Pockit',
      'Help & terms',
      'Trips & projects',
      'Subscriptions & trials',
      'Change history',
    ]) {
      await page.getByRole('button', { name, exact: true }).click()
      await fit(page, `More / ${name} at ${width}`)
      await page.getByRole('button', { name: 'Back to More' }).click()
    }
    await nav.getByRole('button', { name: 'Activity', exact: true }).click()
    await page.getByRole('button', { name: 'Add transaction', exact: true }).click()
    const entry = page.getByRole('dialog', { name: 'New transaction' })
    await entry.getByRole('button', { name: /^Category Choose a category/ }).click()
    await fit(page, `Transaction picker at ${width}`)
    await entry.getByRole('button', { name: 'Close', exact: true }).click()
    await nav.getByRole('button', { name: 'Calendar', exact: true }).click()
    await page.getByRole('button', { name: 'Add bill', exact: true }).click()
    await fit(page, `Bill at ${width}`)
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()
    await nav.getByRole('button', { name: 'Home', exact: true }).click()
    await page.getByRole('button', { name: 'View Rent transactions', exact: true }).click()
    await fit(page, `Category details at ${width}`)
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()
    await page.getByRole('banner').getByRole('button', { name: 'Open Pockit Insights' }).click()
    await fit(page, `Insights at ${width}`)
    await page.getByRole('dialog').getByRole('button', { name: 'Close coach' }).click()
  }
})

test('shared dialogs resize above the keyboard and keep the page locked', async ({ page }) => {
  await page.setViewportSize({ width: 956, height: 440 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
  await page.getByRole('button', { name: 'Quick add transaction' }).click()
  const dialog = page.getByRole('dialog', { name: 'New transaction' })
  await dialog.getByRole('textbox', { name: 'Store or purchase (optional)' }).focus()
  await page.evaluate(() => {
    const visual = window.visualViewport!
    Object.defineProperty(visual, 'height', { configurable: true, value: 240 })
    Object.defineProperty(visual, 'offsetTop', { configurable: true, value: 10 })
    visual.dispatchEvent(new Event('resize'))
  })
  await expect(page.locator('.modal-backdrop')).toHaveCSS('height', '240px')
  await expect(page.locator('body')).toHaveCSS('position', 'fixed')
  const box = (await dialog.boundingBox())!
  expect(box.y).toBeGreaterThanOrEqual(10)
  expect(box.y + box.height).toBeLessThanOrEqual(250)
  await dialog.getByRole('button', { name: 'Save transaction' }).scrollIntoViewIfNeeded()
  await fit(page, 'Keyboard landscape dialog')
})
