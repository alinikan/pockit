import { expect, test } from '@playwright/test'
import { makeDemoData } from '../src/lib/defaults'

test('a rejected backup leaves the budget intact and a reviewed restore updates connected views', async ({
  page,
}) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
  await page.getByRole('button', { name: 'More', exact: true }).click()
  await page.getByRole('button', { name: 'Imports & data' }).click()

  const fileInput = page.getByLabel('Choose file')
  await fileInput.setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"not":"a budget"}'),
  })
  await expect(page.getByRole('status')).toContainText('unsupported or incomplete format')
  await expect(page.getByRole('group', { name: 'Review backup restore' })).toHaveCount(0)

  const backup = makeDemoData()
  const groceries = backup.categories.find((category) => category.name === 'Groceries')!
  const month = await page.evaluate(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  backup.transactions = [
    {
      id: 'restore-test-groceries',
      date: `${month}-07`,
      payee: 'Restore Test Market',
      amount: 87.25,
      type: 'expense',
      categoryId: groceries.id,
    },
  ]
  await fileInput.setInputFiles({
    name: 'pockit-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  })
  await expect(page.getByRole('group', { name: 'Review backup restore' })).toContainText(
    '1 transactions',
  )
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download current copy and restore' }).click()
  expect((await download).suggestedFilename()).toMatch(/^pockit-before-restore-/)
  await expect(page.getByRole('status')).toContainText('Backup restored')

  await page.getByRole('button', { name: 'Activity', exact: true }).click()
  await expect(
    page.locator('.transaction-row').filter({ hasText: 'Restore Test Market' }),
  ).toContainText('$87.25')
  await expect(page.locator('.transaction-row').filter({ hasText: 'Fresh Market' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Home', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Category Breakdown' })).toBeVisible()
  await expect(page.locator('.category-line').filter({ hasText: 'Groceries' })).toContainText(
    '$87.25',
  )
})
