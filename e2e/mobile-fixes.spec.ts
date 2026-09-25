import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
})

test('install help fits the phone, glossary expands, and More has no floating add button', async ({
  page,
}) => {
  await page.locator('.bottom-nav').getByRole('button', { name: 'More' }).click()
  await expect(page.getByRole('button', { name: 'Quick add transaction' })).toHaveCount(0)
  await page.getByRole('button', { name: 'About Put Pockit on your Home Screen' }).click()
  const explanation = page.getByRole('dialog', {
    name: 'Put Pockit on your Home Screen, explained',
  })
  await expect(explanation).toBeVisible()
  const bounds = await explanation.boundingBox()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(403)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(403)
  await explanation
    .getByRole('button', { name: 'Close explanation for Put Pockit on your Home Screen' })
    .click()
  await expect(explanation).toHaveCount(0)
  const terms = page.locator('.glossary')
  await expect(terms).not.toHaveAttribute('open')
  await terms.locator('summary').click()
  await expect(terms).toHaveAttribute('open')
  expect(await terms.locator('.glossary-terms > div').count()).toBeGreaterThan(10)
})

test('quick add opens once, normal Activity navigation does not open it again', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Quick add transaction' }).click()
  const transaction = page.getByRole('dialog', { name: 'New transaction' })
  await expect(transaction).toBeVisible()
  expect(
    await transaction
      .getByLabel('Payee or description')
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
  ).toBeGreaterThanOrEqual(16)
  await transaction.getByRole('button', { name: /Close/ }).click()
  await page.locator('.bottom-nav').getByRole('button', { name: 'More' }).click()
  await page.locator('.bottom-nav').getByRole('button', { name: 'Activity' }).click()
  await expect(page.getByRole('dialog', { name: 'New transaction' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add transaction' })).toBeVisible()
})

test('calendar month controls and insight messages stay usable on a phone', async ({ page }) => {
  await page.locator('.bottom-nav').getByRole('button', { name: 'Calendar' }).click()
  const label = await page.locator('.calendar-month-nav strong').textContent()
  await page.getByRole('button', { name: 'Previous calendar month' }).click()
  await expect(page.locator('.calendar-month-nav strong')).not.toHaveText(label!)
  await page.getByRole('button', { name: 'Next calendar month' }).click()
  await expect(page.locator('.calendar-month-nav strong')).toHaveText(label!)
  await page.getByRole('button', { name: 'Ask Pockit' }).click()
  const insights = page.getByRole('dialog', { name: 'Pockit Insights' })
  const input = insights.getByRole('textbox', { name: 'Ask Pockit Insights' })
  expect(
    await input.evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
  ).toBeGreaterThanOrEqual(16)
  await insights.getByRole('button', { name: 'How am I doing this month?' }).click()
  await expect(insights.locator('.chat-bubble.user')).toHaveCount(1)
  await insights.getByRole('button', { name: 'Close coach' }).click()
  await page.locator('.bottom-nav').getByRole('button', { name: 'More' }).click()
  await page.getByRole('button', { name: 'Ask Pockit' }).click()
  await expect(insights.locator('.chat-bubble.user')).toHaveCount(1)
  await insights.getByRole('button', { name: 'Clear chat' }).click()
  await expect(insights.locator('.chat-bubble.user')).toHaveCount(0)
})

test('Compare explanation sits below its choice without sideways scrolling', async ({ page }) => {
  await page.locator('.bottom-nav').getByRole('button', { name: 'Compare' }).click()
  const choice = page.locator('.compare-same-days')
  await expect(choice).toBeVisible()
  const text = await choice.locator('span').boundingBox()
  const explanation = await choice.locator('small').boundingBox()
  expect(explanation!.y).toBeGreaterThan(text!.y)
  expect(explanation!.x).toBeGreaterThanOrEqual(text!.x)
  expect(explanation!.x + explanation!.width).toBeLessThanOrEqual(403)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(403)
})
