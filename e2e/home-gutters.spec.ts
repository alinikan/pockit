import { expect, test, type Page } from '@playwright/test'

async function checkHomeGutters(page: Page) {
  const layout = await page.evaluate(() => {
    const content = document.querySelector<HTMLElement>('.page-content')!
    const contentBox = content.getBoundingClientRect()
    const style = getComputedStyle(content)
    const innerLeft = contentBox.left + parseFloat(style.paddingLeft)
    const innerRight = contentBox.right - parseFloat(style.paddingRight)
    const selectors = [
      '.home-customize-bar',
      '.hero-grid',
      '.hero-card',
      '.summary-stack',
      '.summary-card',
      '.screen-stack > .panel',
      '.dashboard-grid > .panel',
      '.category-line-top',
      '.category-line-totals strong',
      '.category-view-button',
      '.spending-chart',
      '.spending-donut',
      '.spending-row',
      '.spending-row-top strong',
    ]
    const boxes = selectors.flatMap((selector) =>
      [...document.querySelectorAll<HTMLElement>(selector)]
        .filter((element) => element.getClientRects().length > 0)
        .map((element) => {
          const box = element.getBoundingClientRect()
          return { selector, left: box.left, right: box.right, width: box.width }
        })
        .filter((box) => box.width > 0),
    )
    return {
      viewport: document.documentElement.clientWidth,
      contentLeft: contentBox.left,
      contentRight: contentBox.right,
      innerLeft,
      innerRight,
      boxes,
    }
  })
  expect(layout.contentLeft).toBeGreaterThanOrEqual(-1)
  expect(layout.contentRight).toBeLessThanOrEqual(layout.viewport + 1)
  expect(layout.innerLeft).toBeGreaterThanOrEqual(12)
  expect(layout.viewport - layout.innerRight).toBeGreaterThanOrEqual(12)
  const offenders = layout.boxes
    .filter((box) => box.left < layout.innerLeft - 1 || box.right > layout.innerRight + 1)
    .map((box) => `${box.selector}: ${box.left.toFixed(1)}–${box.right.toFixed(1)}`)
  expect(offenders, `Home gutters at ${layout.viewport}px`).toEqual([])
}

test('Home keeps both gutters through phone widths and section changes', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()

  for (const width of [320, 375, 393, 402, 430, 560, 760]) {
    await page.setViewportSize({ width, height: 852 })
    await checkHomeGutters(page)
  }

  await page.setViewportSize({ width: 393, height: 852 })
  await page.getByRole('button', { name: 'Customize Home' }).click()
  const dialog = page.getByRole('dialog', { name: 'Customize Home' })
  await dialog.getByRole('checkbox', { name: /Weekly check-in/ }).uncheck()
  await checkHomeGutters(page)
  await dialog.getByRole('button', { name: 'Reset layout' }).click()
  await checkHomeGutters(page)
})

test('long names and larger amounts cannot widen Home beyond the phone', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()

  // Stress the same slots that can contain user data after edits and imports.
  const selectors = [
    '.page-heading h1',
    '.hero-number',
    '.income-summary strong',
    '.income-summary .income-record-line small',
    '.category-line-main strong',
  ]
  await page.evaluate((items) => {
    for (const selector of items) {
      const element = document.querySelector<HTMLElement>(selector)!
      element.textContent = `ExtraordinarilyLongUnbrokenValue12345678901234567890`
    }
  }, selectors)

  await page
    .locator('.category-line-totals strong')
    .first()
    .evaluate((element) => {
      element.textContent = '$123,456,789,012.34'
    })

  for (const width of [320, 393, 402]) {
    await page.setViewportSize({ width, height: 852 })
    await checkHomeGutters(page)
  }
  const overflow = await page.evaluate(
    (items) =>
      items.filter((selector) => {
        const element = document.querySelector<HTMLElement>(selector)!
        return element.scrollWidth > element.clientWidth + 1
      }),
    selectors.filter((selector) => selector !== '.category-line-main strong'),
  )
  expect(overflow).toEqual([])
})
