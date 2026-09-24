import { expect, test } from '@playwright/test'
import { strToU8, zipSync } from 'fflate'

test('Waypoint ZIP preview and import stay usable on iPhone and connect the main views', async ({
  page,
}) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
  await page.getByRole('button', { name: 'More', exact: true }).click()
  const month = await page.evaluate(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const csv = {
    'transactions.csv': `Date,Description,Amount,Category,Group,Type,Tags,Notes,Excluded from Budget,Account,Account Last 4,Bank\n${month}-12,Waypoint Market,-30,Groceries,,expense,food,Imported snack,false,Daily,1234,Example Bank`,
    'budgets.csv':
      'Group,Category,Budget Amount,Recurrence,Due Date (Day of Month)\n,Monthly Income,4300,,\n,Groceries,390,monthly,15',
    'categories.csv': 'Group,Category,Icon,Color\n,Groceries,ShoppingCart,#10B981',
    'goals.csv':
      'Goal,Type,Target Amount,Current Amount,Remaining Balance,Progress,Monthly Contribution Target,Manual Contributions,Transaction Contributions,Original Debt Amount,Interest Rate,Minimum Payment,Target Date,Description\nWaypoint Trip,savings,5000,1000,,20%,200,0,0,,,,,A big trip',
    'accounts.csv': `Bank,Account,Type,Subtype,Account Last 4,Balance,Available Balance,Credit Limit,Connection,Last Updated\nExample Bank,Daily,Chequing,Everyday,1234,1000,950,,Manual,${month}-01`,
  }
  const buffer = Buffer.from(
    zipSync(Object.fromEntries(Object.entries(csv).map(([name, value]) => [name, strToU8(value)]))),
  )
  await page
    .getByLabel('Choose Waypoint ZIP')
    .setInputFiles({ name: 'waypoint-export.zip', mimeType: 'application/zip', buffer })
  await expect(page.getByRole('group', { name: 'Waypoint import preview' })).toContainText(
    '1 transactions',
  )
  await page.getByLabel('I confirm the amounts in this Waypoint export are CAD.').check()
  await expect(page.getByRole('group', { name: 'Import counts' })).toContainText('1new goals')
  await expect(page.getByRole('group', { name: 'Import counts' })).toContainText(
    '1new transactions',
  )
  await expect(page.locator('.waypoint-detail').first()).toContainText('Review')
  const previewWidth = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }))
  expect(previewWidth.content).toBeLessThanOrEqual(previewWidth.viewport + 1)
  await page.getByRole('button', { name: 'Download backup and import' }).click()
  await expect(page.getByRole('status')).toContainText('Waypoint data imported')
  await expect(page.getByText('Daily', { exact: true })).toBeVisible()
  let widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }))
  expect(widths.content).toBeLessThanOrEqual(widths.viewport + 1)
  await page.getByRole('button', { name: 'Goals', exact: true }).click()
  await expect(page.locator('.goal-card').filter({ hasText: 'Waypoint Trip' })).toBeVisible()
  await page.getByRole('button', { name: 'Activity', exact: true }).click()
  await page.locator('.transaction-row').filter({ hasText: 'Waypoint Market' }).click()
  await expect(page.getByRole('dialog', { name: 'Edit transaction' })).toContainText(
    'Imported from Waypoint',
  )
  await page
    .getByRole('dialog', { name: 'Edit transaction' })
    .getByRole('spinbutton', { name: 'Amount' })
    .fill('45')
  await page.getByRole('button', { name: 'Save transaction' }).click()
  await expect(
    page.locator('.transaction-row').filter({ hasText: 'Waypoint Market' }),
  ).toContainText('$45')
  await page.getByRole('button', { name: 'Calendar', exact: true }).click()
  await page
    .locator('.calendar-day')
    .filter({ has: page.locator('span', { hasText: /^15$/ }) })
    .click()
  await expect(
    page.getByText('Budget payment date · confirm or add a bill for reminders'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Compare', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Put your months in perspective.' })).toBeVisible()
  widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }))
  expect(widths.content).toBeLessThanOrEqual(widths.viewport + 1)
})
