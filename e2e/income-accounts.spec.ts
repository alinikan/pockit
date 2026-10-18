import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { makeDemoData } from '../src/lib/defaults'
import { todayISO } from '../src/lib/finance'
import { addDays } from '../src/lib/experience'

async function start(page: Page) {
  const data = makeDemoData()
  data.transactions = []
  data.bills = []
  data.accounts = [
    {
      id: 'checking',
      name: 'Wealthsimple Chequing',
      kind: 'chequing',
      openingBalance: 1000,
      asOf: todayISO(),
    },
  ]
  await page.addInitScript((value) => {
    if (!localStorage.getItem('pockit-demo-v1'))
      localStorage.setItem('pockit-demo-v1', JSON.stringify(value))
  }, data)
  await page.setViewportSize({ width: 402, height: 874 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
}
async function accounts(page: Page) {
  await page.locator('.bottom-nav').getByRole('button', { name: 'More', exact: true }).click()
  await page.getByRole('button', { name: 'Accounts', exact: true }).click()
}
async function income(
  page: Page,
  name: string,
  amount: string,
  date: string,
  mode: 'add' | 'included',
) {
  await page.locator('.bottom-nav').getByRole('button', { name: 'Activity', exact: true }).click()
  await page.getByRole('button', { name: 'Record income', exact: true }).click()
  const form = page.getByRole('dialog')
  await form.getByLabel('Income from').fill(name)
  await form.getByLabel('Amount', { exact: true }).fill(amount)
  await form.getByLabel('Date', { exact: true }).fill(date)
  await form.getByRole('combobox', { name: /Income category/ }).selectOption('paycheque')
  await expect(form.getByRole('button', { name: 'Save transaction', exact: true })).toBeDisabled()
  await form
    .getByRole('radio', {
      name: mode === 'add' ? /Yes, add this income/ : /No, it’s already included/,
    })
    .check()
  await form.getByRole('button', { name: 'Save transaction', exact: true }).click()
  await expect(form).toHaveCount(0)
}
test('income decisions update Accounts immediately, persist, and do not double-count historical income', async ({
  page,
}) => {
  await start(page)
  await income(page, 'Today’s pay', '250', todayISO(), 'add')
  await accounts(page)
  await expect(page.locator('.account-balance')).toContainText('$1,250.00')
  await income(page, 'Earlier pay', '900', addDays(todayISO(), -14), 'included')
  await accounts(page)
  await expect(page.locator('.account-balance')).toContainText('$1,250.00')
  await income(page, 'Missing older pay', '50', addDays(todayISO(), -21), 'add')
  await accounts(page)
  await expect(page.locator('.account-balance')).toContainText('$1,300.00')
  await page.reload()
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
  await accounts(page)
  await expect(page.locator('.account-balance')).toContainText('$1,300.00')
  await page.getByRole('button', { name: 'Check balance', exact: true }).click()
  await page.getByLabel('Balance shown by your account now').fill('1300')
  await page.getByRole('button', { name: 'Use this balance', exact: true }).click()
  await expect(page.locator('.account-balance')).toContainText('$1,300.00')
  await page.locator('.bottom-nav').getByRole('button', { name: 'Activity', exact: true }).click()
  await page.getByRole('button', { name: 'Filter & sort' }).click()
  await page.getByLabel('Filter category').selectOption('income:paycheque')
  await expect(page.locator('.transaction-row').first()).toContainText('Paycheque')
})
test('income choices remain readable at small phone widths and support keyboard and screen readers', async ({
  page,
}) => {
  await start(page)
  await page.getByRole('button', { name: 'Record income', exact: true }).click()
  const form = page.getByRole('dialog')
  await form.getByLabel('Amount', { exact: true }).fill('250')
  await form.getByLabel('Date', { exact: true }).fill('')
  await form.getByRole('radio', { name: /Yes, add this income/ }).check()
  await expect(form.getByRole('status')).toContainText('the date you choose')
  await form.getByLabel('Date', { exact: true }).fill(todayISO())
  for (const width of [320, 402, 440, 1280]) {
    await page.setViewportSize({ width, height: 874 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width + 1,
    )
    expect(await form.evaluate((node) => node.scrollWidth)).toBeLessThanOrEqual(
      await form.evaluate((node) => node.clientWidth + 1),
    )
  }
  await page.setViewportSize({ width: 402, height: 874 })
  await form.getByRole('radio', { name: /Yes, add this income/ }).focus()
  await page.keyboard.press('ArrowDown')
  await expect(form.getByRole('radio', { name: /No, it’s already included/ })).toBeChecked()
  const result = await new AxeBuilder({ page }).include('[role="dialog"]').analyze()
  expect(result.violations).toEqual([])
})
