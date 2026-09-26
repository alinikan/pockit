import { expect, test } from '@playwright/test'

test('Category Breakdown and its transaction view fit small iPhones', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
  for (const width of [320, 402]) {
    await page.setViewportSize({ width, height: 874 })
    const panel = page.locator('.breakdown-panel')
    await expect(panel.getByRole('heading', { name: 'Category Breakdown' })).toBeVisible()
    expect(await panel.locator('.category-line').count()).toBeGreaterThan(6)
    const eye = panel.getByRole('button', { name: 'View Groceries transactions' })
    const panelBox = (await panel.boundingBox())!
    const eyeBox = (await eye.boundingBox())!
    expect(eyeBox.x).toBeGreaterThanOrEqual(panelBox.x)
    expect(eyeBox.x + eyeBox.width).toBeLessThanOrEqual(panelBox.x + panelBox.width + 1)
    await eye.click()
    const detail = page.getByRole('dialog', { name: 'Groceries transactions' })
    await expect(detail).toBeVisible()
    await expect(detail.getByText('Fresh Market')).toBeVisible()
    await expect(detail.getByText('Costco')).toBeVisible()
    await expect(detail.getByText('Superstore')).toBeVisible()
    const detailBox = (await detail.boundingBox())!
    expect(detailBox.x).toBeGreaterThanOrEqual(0)
    expect(detailBox.x + detailBox.width).toBeLessThanOrEqual(width + 1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width + 1,
    )
    await detail.getByRole('button', { name: 'Close' }).click()
    if (width === 402) {
      await panel.getByRole('button', { name: 'View Savings transactions' }).click()
      const savings = page.getByRole('dialog', { name: 'Savings transactions' })
      await expect(savings.getByText('Savings transfer')).toBeVisible()
      await expect(savings.getByText(/Transfer · not spending/)).toBeVisible()
      await savings.getByRole('button', { name: 'Close' }).click()
    }
  }
})

test('a new expense updates its category total and eye view', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
  await page.locator('.bottom-nav').getByRole('button', { name: 'Activity' }).click()
  await page.getByRole('button', { name: 'Add transaction' }).click()
  const form = page.getByRole('dialog', { name: 'New transaction' })
  await form.getByRole('textbox', { name: 'Payee or description' }).fill('Pockit Category Test')
  await form.getByRole('spinbutton', { name: 'Amount' }).fill('100')
  await form.locator('select:has(option:text-is("Groceries"))').selectOption({ label: 'Groceries' })
  await form.getByRole('button', { name: 'Save transaction' }).click()
  await page.locator('.bottom-nav').getByRole('button', { name: 'Home' }).click()
  const panel = page.locator('.breakdown-panel')
  await panel.getByRole('button', { name: /Off Track/ }).click()
  await expect(panel.getByRole('button', { name: 'View Groceries transactions' })).toBeVisible()
  await panel.getByRole('button', { name: 'View Groceries transactions' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Groceries transactions' }).getByText('Pockit Category Test'),
  ).toBeVisible()
})
