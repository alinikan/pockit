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

test('populated Waypoint months show their range and a reimbursement remains a positive refund', async ({
  page,
}) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
  await page.getByRole('button', { name: 'More', exact: true }).click()
  const { current, previous } = await page.evaluate(() => {
    const today = new Date()
    const month = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    return {
      current: month(today),
      previous: month(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
    }
  })
  const csv = {
    'transactions.csv': `Date,Description,Amount,Category,Group,Type,Tags,Notes,Excluded from Budget,Account,Account Last 4,Bank\n${previous}-11,Prior market,-80,Groceries,,expense,,,No,,,\n${previous}-12,Prior return,25,Groceries,,reimbursement,,,No,,,\n${previous}-15,Prior pay,500,,,income,,,No,,,\n${current}-11,Current market,-50,Groceries,,expense,,,No,,,`,
    'budgets.csv':
      'Group,Category,Budget Amount,Recurrence,Due Date (Day of Month)\n,Monthly Income,0,,\n,Groceries,390,monthly,',
    'categories.csv': 'Group,Category,Icon,Color\n,Groceries,ShoppingCart,#10B981',
    'goals.csv':
      'Goal,Type,Target Amount,Current Amount,Remaining Balance,Progress,Monthly Contribution Target,Manual Contributions,Transaction Contributions,Original Debt Amount,Interest Rate,Minimum Payment,Target Date,Description',
    'accounts.csv':
      'Bank,Account,Type,Subtype,Account Last 4,Balance,Available Balance,Credit Limit,Connection,Last Updated',
  }
  const buffer = Buffer.from(
    zipSync(Object.fromEntries(Object.entries(csv).map(([name, value]) => [name, strToU8(value)]))),
  )
  await page
    .getByLabel('Choose Waypoint ZIP')
    .setInputFiles({ name: 'populated.zip', mimeType: 'application/zip', buffer })
  await page.getByLabel('I confirm the amounts in this Waypoint export are CAD.').check()
  await expect(page.getByRole('group', { name: 'Import counts' })).toContainText(
    '4new transactions',
  )
  await expect(page.getByText(/Transaction history in this ZIP:/)).toContainText('2 months')
  await expect(page.getByText(/Waypoint exported a \$0 monthly income plan/)).toBeVisible()
  await page.getByRole('button', { name: 'Download backup and import' }).click()
  await page.getByRole('button', { name: 'Activity', exact: true }).click()
  await page.getByRole('button', { name: 'Previous month' }).click()
  const reimbursement = page.locator('.transaction-row').filter({ hasText: 'Prior return' })
  await expect(reimbursement).toContainText('Reimbursement · Groceries')
  await expect(reimbursement).toContainText('+$25.00')
  await expect(page.locator('.transaction-row').filter({ hasText: 'Prior market' })).toBeVisible()
})
