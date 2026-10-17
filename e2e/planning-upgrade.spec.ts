import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { makeDemoData } from '../src/lib/defaults'
import { addDays } from '../src/lib/experience'
import { todayISO } from '../src/lib/finance'
async function start(page: Page) {
  const data = makeDemoData()
  data.transactions = []
  data.bills = []
  data.changeLog = []
  data.accounts = [
    {
      id: 'checking',
      name: 'Wealthsimple Chequing',
      kind: 'chequing',
      openingBalance: 1000,
      asOf: addDays(todayISO(), -1),
    },
    {
      id: 'saving',
      name: 'Savings',
      kind: 'savings',
      openingBalance: 500,
      asOf: addDays(todayISO(), -1),
    },
  ]
  data.goals = data.goals
    .filter((item) => item.kind === 'saving')
    .map((item) => ({ ...item, balance: 200, history: [] }))
  await page.addInitScript((value) => {
    if (!localStorage.getItem('pockit-demo-v1'))
      localStorage.setItem('pockit-demo-v1', JSON.stringify(value))
  }, data)
  await page.setViewportSize({ width: 402, height: 874 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
}
async function tab(page: Page, name: string) {
  await page.locator('.bottom-nav').getByRole('button', { name, exact: true }).click()
}
async function more(page: Page, name: string) {
  await tab(page, 'More')
  await page.getByRole('button', { name, exact: true }).click()
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    (await page.viewportSize())!.width + 1,
  )
}

test('fast entry keeps optional fields out of the way, pins a template, and saves another', async ({
  page,
}) => {
  await start(page)
  await tab(page, 'Activity')
  await page.getByText('Quick text entry', { exact: true }).click()
  await page.getByLabel('Quick entry text').fill('Coffee 6.50 yesterday')
  await page.getByRole('button', { name: 'Review entry', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'New transaction' })
  await expect(dialog.getByLabel('Amount', { exact: true })).toHaveValue('6.5')
  await expect(dialog.getByRole('textbox', { name: 'Payee or description' })).toHaveValue('Coffee')
  await expect(dialog.locator('.entry-more-details')).not.toHaveAttribute('open')
  await dialog.getByText('More details', { exact: true }).click()
  await dialog.getByRole('button', { name: 'Pin as quick entry' }).click()
  await dialog.getByRole('button', { name: 'Save & add another' }).click()
  await expect(dialog.getByLabel('Amount', { exact: true })).toHaveValue('')
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.locator('.transaction-row')).toHaveCount(1)
  await page.getByRole('button', { name: 'Coffee', exact: true }).click()
  await expect(
    page.getByRole('dialog').getByRole('textbox', { name: 'Payee or description' }),
  ).toHaveValue('Coffee')
  await noOverflow(page)
})

test('an interrupted draft survives leaving Activity and reloading the app', async ({ page }) => {
  await start(page)
  await tab(page, 'Activity')
  await page.getByRole('button', { name: 'Add transaction', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog
    .getByRole('textbox', { name: 'Payee or description' })
    .fill('Unfinished grocery entry')
  await dialog.getByLabel('Amount', { exact: true }).fill('42.10')
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await tab(page, 'Home')
  await tab(page, 'Activity')
  await page.getByRole('button', { name: 'Resume saved draft' }).click()
  await expect(
    page.getByRole('dialog').getByRole('textbox', { name: 'Payee or description' }),
  ).toHaveValue('Unfinished grocery entry')
  await page.reload()
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
  await tab(page, 'Activity')
  await page.getByRole('button', { name: 'Resume saved draft' }).click()
  await expect(page.getByRole('dialog').getByLabel('Amount', { exact: true })).toHaveValue('42.1')
})

test('account forecasts and purchase checks stay within phone and desktop sheets', async ({
  page,
}) => {
  await start(page)
  await page.getByRole('button', { name: 'Next 60 days', exact: true }).click()
  const forecast = page.getByRole('dialog', { name: 'Your account forecast' })
  await expect(forecast.getByRole('slider')).toBeVisible()
  await forecast.getByRole('slider').press('ArrowRight')
  await expect(forecast.locator('.timeline-readout')).toContainText('$')
  for (const width of [320, 402, 440, 1280]) {
    await page.setViewportSize({ width, height: 874 })
    await noOverflow(page)
    expect(
      await forecast.evaluate((element) => element.scrollWidth > element.clientWidth + 1),
    ).toBe(false)
  }
  await page.setViewportSize({ width: 402, height: 874 })
  await forecast.screenshot({ path: '/tmp/pockit-forecast-new.png' })
  await forecast.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('button', { name: 'Can I afford this?', exact: true }).click()
  const purchase = page.getByRole('dialog', { name: 'Can I afford this?' })
  await purchase.getByLabel('Purchase amount').fill('1000000')
  await expect(purchase.getByText('This purchase needs a change')).toBeVisible()
  await expect(purchase.locator('.tool-result')).toHaveClass(/attention/)
  const expectedPay = purchase.getByRole('checkbox', { name: /Include expected pay/ })
  await expect(expectedPay).toBeChecked()
  await expectedPay.uncheck()
  await expect(expectedPay).not.toBeChecked()
  await expect(purchase.getByRole('slider')).toBeVisible()
  const result = await new AxeBuilder({ page }).include('.experience-sheet').analyze()
  expect(result.violations).toEqual([])
})

test('goals can earmark existing account money without creating a transaction', async ({
  page,
}) => {
  await start(page)
  await tab(page, 'Goals')
  await page.getByRole('button', { name: 'Assign existing money', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: /Money behind/ })
  await dialog.getByLabel('Assign from Wealthsimple Chequing', { exact: true }).fill('300')
  await dialog.getByLabel('Assign from Savings', { exact: true }).fill('100')
  await dialog.getByRole('button', { name: 'Save assignments' }).click()
  await expect(page.getByText('$400.00 assigned in accounts')).toBeVisible()
  await tab(page, 'Activity')
  await expect(page.locator('.transaction-row')).toHaveCount(0)
  await more(page, 'Accounts')
  await expect(page.locator('.account-balance').filter({ hasText: '$1,000.00' })).toBeVisible()
})

test('project spending and subscription deadlines appear in their own focused views', async ({
  page,
}) => {
  await start(page)
  await more(page, 'Trips & projects')
  await page.getByRole('button', { name: 'Add project' }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('Project name').fill('Island trip')
  await dialog.getByLabel('Total spending budget in CAD').fill('500')
  await dialog.getByRole('button', { name: 'Save project' }).click()
  await tab(page, 'Activity')
  await page.getByRole('button', { name: 'Add transaction', exact: true }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('Amount', { exact: true }).fill('80')
  await dialog.getByRole('textbox', { name: 'Payee or description' }).fill('Ferry')
  await dialog.getByText('More details', { exact: true }).click()
  await dialog
    .getByLabel('Project (optional)', { exact: true })
    .selectOption({ label: 'Island trip' })
  await dialog.getByRole('button', { name: 'Save transaction' }).click()
  await more(page, 'Trips & projects')
  await expect(page.locator('.project-metrics')).toContainText('$80.00')
  await expect(page.locator('.project-metrics')).toContainText('$420.00')
  await page.getByRole('button', { name: 'Back to More' }).click()
  await page.getByRole('button', { name: 'Subscriptions & trials', exact: true }).click()
  await page.getByRole('button', { name: 'Add subscription' }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('Subscription name').fill('Music trial')
  await dialog.getByLabel('Price per billing period').fill('10')
  await dialog.getByLabel('Next renewal date').fill(addDays(todayISO(), 2))
  await dialog.getByLabel('Cancel by (optional)', { exact: true }).fill(todayISO())
  await dialog.getByRole('button', { name: 'Save subscription' }).click()
  await expect(page.getByText('$120.00', { exact: true })).toBeVisible()
  await tab(page, 'Calendar')
  await expect(page.getByRole('heading', { name: /Subscription decisions/ })).toBeVisible()
  await expect(page.getByText('Cancel-by deadline', { exact: false })).toBeVisible()
})

test('editing a transaction previews related amounts and can be restored from private history', async ({
  page,
}) => {
  await start(page)
  await tab(page, 'Activity')
  await page.getByRole('button', { name: 'Add transaction', exact: true }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('Amount', { exact: true }).fill('50')
  await dialog.getByRole('textbox', { name: 'Payee or description' }).fill('History test')
  await dialog.getByRole('button', { name: 'Save transaction' }).click()
  await page.locator('.transaction-row').click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('Amount', { exact: true }).fill('80')
  await expect(dialog.getByText('What this edit will change')).toBeVisible()
  await expect(dialog.locator('.edit-impact')).toContainText('Wealthsimple Chequing')
  await dialog.getByRole('button', { name: 'Save transaction' }).click()
  await more(page, 'Change history')
  await page.getByRole('button', { name: /Updated History test/ }).click()
  dialog = page.getByRole('dialog', { name: 'Review this edit' })
  await expect(dialog.getByText('$50.00', { exact: true })).toBeVisible()
  await expect(dialog.getByText('$80.00', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Restore these records' }).click()
  await tab(page, 'Activity')
  await expect(page.locator('.transaction-row')).toContainText('$50.00')
})

test('Pockit Pulse progress survives navigation and completion labels are optional', async ({
  page,
}) => {
  await start(page)
  const review = page.locator('.pulse-review')
  await expect(review).toContainText('0 of 4 steps checked')
  await review.getByRole('checkbox', { name: /Review activity/ }).check()
  await tab(page, 'Calendar')
  await tab(page, 'Home')
  await expect(page.locator('.pulse-review')).toContainText('1 of 4 steps checked')
  await page
    .locator('.pulse-review')
    .getByText('Confirm a complete month for better comparisons')
    .click()
  await page.getByLabel('Month to review').fill('2026-08')
  await page.getByRole('button', { name: 'Mark this month complete' }).click()
  await expect(page.getByRole('button', { name: 'Remove complete label' })).toBeVisible()
})

test('the companion deep link opens quick entry without recording anything', async ({ page }) => {
  await start(page)
  await page.goto('/?open=activity&add=expense')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
  await expect(page.getByRole('dialog', { name: 'New transaction' })).toBeVisible()
  await expect(page.locator('.transaction-row')).toHaveCount(0)
})
