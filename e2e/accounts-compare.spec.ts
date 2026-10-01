import { expect, test, type Page } from '@playwright/test'

async function preview(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
}
async function accounts(page: Page) {
  await page.locator('.bottom-nav').getByRole('button', { name: 'More' }).click()
  await page.getByRole('button', { name: 'Accounts', exact: true }).click()
}
async function addAccount(page: Page, name: string, kind: string, balance: string) {
  await page.getByRole('textbox', { name: 'Account name', exact: true }).fill(name)
  await page.getByRole('combobox', { name: 'Type', exact: true }).selectOption(kind)
  await page.getByRole('spinbutton', { name: 'Balance today in CAD' }).fill(balance)
  await page.getByRole('button', { name: 'Add account', exact: true }).click()
}

test('Compare month choices have a clear hierarchy and a separate same-day option', async ({
  page,
}) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await preview(page)
  await page.locator('.bottom-nav').getByRole('button', { name: 'Compare' }).click()
  for (const width of [320, 402, 440, 1280]) {
    await page.setViewportSize({ width, height: 874 })
    const selector = page.locator('.compare-selector')
    const months = selector.locator('.compare-month-grid')
    const option = selector.locator('.compare-same-days')
    await expect
      .poll(async () => {
        const monthsBox = (await months.boundingBox())!
        const optionBox = (await option.boundingBox())!
        return optionBox.y - monthsBox.y - monthsBox.height
      })
      .toBeGreaterThanOrEqual(16)
    await expect(selector.getByLabel('BASELINE')).toBeVisible()
    await expect(selector.getByLabel('MONTH 2')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width + 1,
    )
  }
  await page.setViewportSize({ width: 402, height: 874 })
  await page.locator('.compare-selector').screenshot({ path: '/tmp/pockit-compare-after.png' })
  await page.getByRole('button', { name: 'Add month' }).click()
  await page.getByRole('button', { name: 'Add month' }).click()
  await expect(page.locator('.compare-month-control')).toHaveCount(4)
  await expect(page.locator('.compare-same-days')).toBeVisible()
})

test('long account names and balances never collide with each other or their actions', async ({
  page,
}) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await preview(page)
  await accounts(page)
  await addAccount(page, 'Wealthsimple Chequing', 'chequing', '1050.63')
  await addAccount(page, 'Wealthsimple TFSA long investment account name', 'tfsa', '1250000.63')
  for (const width of [320, 402, 440, 1280]) {
    await page.setViewportSize({ width, height: 874 })
    const layout = await page.locator('.account-card').evaluateAll((cards) =>
      cards.map((card) => {
        const boxes = ['.account-summary', '.account-balance', '.account-actions'].map(
          (selector) => {
            const rect = card.querySelector(selector)!.getBoundingClientRect()
            return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
          },
        )
        return { boxes, overflow: card.scrollWidth > card.clientWidth + 1 }
      }),
    )
    for (const card of layout) {
      expect(card.overflow).toBe(false)
      for (let i = 0; i < card.boxes.length; i++)
        for (let j = i + 1; j < card.boxes.length; j++) {
          const a = card.boxes[i],
            b = card.boxes[j]
          expect(
            a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top,
          ).toBe(true)
        }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width + 1,
    )
  }
  await page.setViewportSize({ width: 402, height: 874 })
  await page.locator('.account-card').first().screenshot({ path: '/tmp/pockit-accounts-after.png' })
  await page.locator('.account-card').first().getByRole('button', { name: 'Check balance' }).click()
  await page.getByRole('spinbutton', { name: 'Balance shown by your account now' }).fill('1000')
  await page.getByRole('button', { name: 'Use this balance' }).click()
  await expect(page.locator('.account-card').first().locator('.account-balance')).toContainText(
    '$1,000.00',
  )
})

test('a chequing-to-TFSA transfer updates balances and connected plans while expenses stay unchanged', async ({
  page,
}) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await preview(page)
  await accounts(page)
  await addAccount(page, 'Wealthsimple Chequing', 'chequing', '1050.63')
  await addAccount(page, 'Wealthsimple TFSA', 'tfsa', '500')
  await page.locator('.bottom-nav').getByRole('button', { name: 'Activity' }).click()
  await page.getByRole('button', { name: 'Add transaction', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'New transaction' })
  await dialog.getByRole('button', { name: 'Transfer', exact: true }).click()
  await dialog.getByRole('textbox', { name: 'Payee or description' }).fill('TFSA contribution')
  await dialog.getByRole('spinbutton', { name: 'Amount', exact: true }).fill('200')
  await dialog
    .getByRole('combobox', { name: 'To account' })
    .selectOption({ label: 'Wealthsimple TFSA · TFSA' })
  await expect(dialog.getByRole('combobox', { name: 'Category', exact: true })).toHaveValue(/.+/)
  await dialog.getByRole('button', { name: 'Save transaction' }).click()
  await accounts(page)
  await expect(page.locator('.account-card').first().locator('.account-balance')).toContainText(
    '$850.63',
  )
  await expect(page.locator('.account-card').nth(1).locator('.account-balance')).toContainText(
    '$700.00',
  )
  await page.locator('.bottom-nav').getByRole('button', { name: 'Budget' }).click()
  await expect(page.locator('.allocation-row').filter({ hasText: 'Investments' })).toContainText(
    '$200.00 net invested',
  )
  await page.locator('.bottom-nav').getByRole('button', { name: 'Home' }).click()
  await expect(page.locator('.hero-equation')).toContainText('$200 net invested')
  await expect(page.locator('.category-line').filter({ hasText: 'Investments' })).toContainText(
    '$200.00 net invested',
  )
  await page.getByRole('button', { name: 'View Investments transactions', exact: true }).click()
  await expect(page.getByRole('dialog', { name: /Investments/ })).toContainText('TFSA contribution')
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()
  await page.locator('.bottom-nav').getByRole('button', { name: 'Compare' }).click()
  await page.getByRole('tab', { name: 'Plan vs spent Check your monthly plan' }).click()
  await expect(page.locator('.compare-plan-panel')).toContainText(
    '$200.00 in net investment transfers',
  )
  await page.reload()
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
  await accounts(page)
  await expect(page.locator('.account-card').nth(1).locator('.account-balance')).toContainText(
    '$700.00',
  )
})
