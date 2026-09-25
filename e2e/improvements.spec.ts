import { expect, test } from '@playwright/test'

test('phone guides, privacy control, and theme work without moving the page sideways', async ({
  page,
}) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
  await page.getByRole('button', { name: 'Open Home guide' }).click()
  const guide = page.getByRole('dialog', { name: 'Home guide' })
  await expect(guide.getByText('Your month at a glance')).toBeVisible()
  await guide.getByRole('button', { name: 'Next' }).click()
  await expect(guide.getByText('Until your next paycheque')).toBeVisible()
  await guide.getByRole('button', { name: 'Next' }).click()
  await expect(guide.getByText('A tiny weekly reset')).toBeVisible()
  await guide.getByRole('button', { name: 'Next' }).click()
  await expect(guide.getByText('Make Home your own')).toBeVisible()
  await guide.getByRole('button', { name: 'Got it' }).click()
  await page.getByRole('button', { name: 'Hide money amounts' }).click()
  await expect(page.locator('.app-shell')).toHaveClass(/private-amounts/)
  await expect(page.locator('.hero-number')).toHaveText('••••')
  await page.getByRole('button', { name: 'Show money amounts' }).click()
  await expect(page.locator('.app-shell')).not.toHaveClass(/private-amounts/)
  await expect(page.locator('.hero-number')).toContainText('$')
  await page.getByRole('button', { name: /Switch to (light|dark) mode/ }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  const widths = await page.evaluate(() => [
    document.documentElement.clientWidth,
    document.documentElement.scrollWidth,
  ])
  expect(widths[1]).toBeLessThanOrEqual(widths[0] + 1)
})

test('What-if changes remain a preview until applied and can be undone', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
  await page.getByRole('button', { name: 'Goals', exact: true }).click()
  const lab = page.getByRole('region', { name: 'What-if Lab' })
  await lab.getByRole('spinbutton', { name: 'Extra debt payment each month' }).fill('50')
  const preview = await lab.locator('.whatif-results').innerText()
  await expect(lab.getByRole('button', { name: /Review recurring changes/ })).toBeEnabled()
  await lab.getByRole('button', { name: /Review recurring changes/ }).click()
  await expect(page.getByRole('dialog', { name: 'Apply this plan?' })).toContainText(
    'Extra $50.00 each month to debt payoff',
  )
  await page.getByRole('button', { name: 'Apply recurring plan' }).click()
  await expect(lab.getByRole('status')).toContainText('Recurring plan applied')
  expect(await lab.locator('.whatif-results').innerText()).not.toBe(preview)
  await lab.getByRole('button', { name: 'Undo' }).click()
  await expect(lab.getByRole('status')).toHaveCount(0)
  expect(await lab.locator('.whatif-results').innerText()).toBe(preview)
})
