import { expect, test } from '@playwright/test'

test('Actual Spending ring, category meter, and Breakdown use the same entries', async ({
  page,
}) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()

  const actual = page.locator('.actual-panel')
  const rent = actual.getByRole('button', { name: /View Rent transactions/ })
  await expect(actual.getByRole('heading', { name: 'Actual Spending' })).toBeVisible()
  await expect(actual.locator('.spending-ring-segment')).not.toHaveCount(0)
  await expect(actual.locator('.spending-donut svg')).toHaveAttribute('aria-label', /Rent \$1,500/)
  await expect(rent.locator('.spending-meter > span')).toHaveAttribute('style', /width: 100%/)
  await expect(rent).toContainText('100%')
  await expect(rent).toContainText('plan used')
  const breakdown = page.locator('.breakdown-panel')
  await expect(
    breakdown.locator('.category-line').filter({ hasText: 'Rent' }).first(),
  ).toContainText('$1,500.00 / $1,500.00')
  await rent.click()
  await expect(page.getByRole('dialog', { name: 'Rent transactions' })).toBeVisible()
  await page
    .getByRole('dialog', { name: 'Rent transactions' })
    .getByRole('button', { name: 'Close' })
    .click()

  await page.locator('.bottom-nav').getByRole('button', { name: 'Activity' }).click()
  await page.getByRole('button', { name: 'Add transaction' }).click()
  const form = page.getByRole('dialog', { name: 'New transaction' })
  await form.getByRole('textbox', { name: 'Payee or description' }).fill('Parking with rent')
  await form.getByRole('spinbutton', { name: 'Amount' }).fill('75')
  await form.getByLabel(/^Category/).selectOption({ label: 'Rent' })
  await form.getByRole('button', { name: 'Save transaction' }).click()
  await page.locator('.bottom-nav').getByRole('button', { name: 'Home' }).click()
  await expect(actual.locator('.spending-donut svg')).toHaveAttribute('aria-label', /Rent \$1,575/)
  await expect(rent).toContainText('105%')
  await expect(rent).toContainText('$75 over')
  await expect(
    breakdown.locator('.category-line').filter({ hasText: 'Rent' }).first(),
  ).toContainText('$75.00 over')
})

test('Home visuals and pay settings fit phone widths and explain planned versus recorded income', async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
  const actual = page.locator('.actual-panel')
  for (const width of [320, 375, 393, 402, 430, 760]) {
    await page.setViewportSize({ width, height: 852 })
    const boxes = await page.evaluate(() => {
      const content = document.querySelector('.page-content')!.getBoundingClientRect()
      const selectors = ['.actual-panel', '.spending-chart', '.spending-donut', '.spending-row']
      return selectors.flatMap((selector) =>
        [...document.querySelectorAll(selector)].map((element) => ({
          selector,
          left: element.getBoundingClientRect().left,
          right: element.getBoundingClientRect().right,
          contentLeft: content.left,
          contentRight: content.right,
        })),
      )
    })
    expect(
      boxes.filter((box) => box.left < box.contentLeft - 1 || box.right > box.contentRight + 1),
    ).toEqual([])
  }
  await page.setViewportSize({ width: 393, height: 852 })
  await expect(actual.locator('.spending-donut-center')).toContainText('net spent')
  await page.getByRole('button', { name: 'How this Home number is calculated' }).click()
  await expect(page.getByRole('dialog', { name: 'This month’s number' })).toContainText(
    'not your bank balance',
  )
  await page
    .getByRole('dialog', { name: 'This month’s number' })
    .getByRole('button', { name: 'Close' })
    .click()
  await page.locator('.bottom-nav').getByRole('button', { name: 'More' }).click()
  await page.getByRole('button', { name: 'Paycheques' }).click()
  await expect(page.getByLabel(/Usual take-home pay per payday/)).toBeVisible()
  await expect(page.locator('.settings-income-preview')).toContainText('Received and recorded')
})
