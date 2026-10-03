import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function previewGoals(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
  await page.getByRole('button', { name: 'Goals', exact: true }).click()
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    (await page.viewportSize())!.width + 1,
  )
}

test('goal actions and focused scenarios stay readable at phone and desktop widths', async ({
  page,
}) => {
  await previewGoals(page)
  const lab = page.getByRole('region', { name: 'What-if Lab' })
  for (const width of [320, 402, 440, 1280]) {
    await page.setViewportSize({ width, height: 874 })
    const actions = page.locator('.goal-money-actions').first()
    for (const button of await actions.getByRole('button').all()) {
      const box = (await button.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(width)
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(
        await button.evaluate((element) => element.scrollWidth > element.clientWidth + 1),
      ).toBe(false)
    }
    if (await lab.getByRole('button', { name: 'Change idea' }).count())
      await lab.getByRole('button', { name: 'Change idea' }).click()
    await lab.getByRole('button', { name: /Save faster/ }).click()
    await lab.getByRole('spinbutton', { name: 'Extra to a savings goal each month' }).fill('50')
    await expect(lab.getByText(/Time to reach Emergency fund/)).toBeVisible()
    await noOverflow(page)
  }
  await page.setViewportSize({ width: 402, height: 874 })
  await lab.screenshot({ path: '/tmp/pockit-lab-after.png' })
  await page.locator('.goal-card').first().screenshot({ path: '/tmp/pockit-goal-after.png' })
  const accessibility = await new AxeBuilder({ page }).include('.whatif-panel').analyze()
  expect(accessibility.violations).toEqual([])
})

test('a goal contribution explains the transfer and keeps account fields inside the phone dialog', async ({
  page,
}) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await previewGoals(page)
  await page.locator('.bottom-nav').getByRole('button', { name: 'More' }).click()
  await page.getByRole('button', { name: 'Accounts', exact: true }).click()
  for (const [name, kind, balance] of [
    ['Chequing', 'chequing', '1000'],
    ['Wealthsimple TFSA', 'tfsa', '500'],
  ]) {
    await page.getByRole('textbox', { name: 'Account name', exact: true }).fill(name)
    await page.getByRole('combobox', { name: 'Type', exact: true }).selectOption(kind)
    await page.getByRole('spinbutton', { name: 'Balance today in CAD' }).fill(balance)
    await page.getByRole('button', { name: 'Add account', exact: true }).click()
  }
  await page.locator('.bottom-nav').getByRole('button', { name: 'Goals' }).click()
  await page
    .locator('.goal-card')
    .first()
    .getByRole('button', { name: /Save money/ })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Save money toward your goal' })
  await expect(dialog.getByText(/money leaves From and arrives in To/)).toBeVisible()
  await dialog.getByLabel('Amount', { exact: true }).fill('50')
  await dialog.getByLabel('From account', { exact: true }).selectOption({ label: 'Chequing' })
  await dialog
    .getByLabel('To account', { exact: true })
    .selectOption({ label: 'Wealthsimple TFSA' })
  for (const width of [320, 402, 440]) {
    await page.setViewportSize({ width, height: 874 })
    await noOverflow(page)
    for (const field of await dialog.getByRole('combobox').all()) {
      const box = (await field.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(width)
    }
    expect(await dialog.evaluate((element) => element.scrollWidth > element.clientWidth + 1)).toBe(
      false,
    )
  }
  await page.setViewportSize({ width: 402, height: 874 })
  await dialog.screenshot({ path: '/tmp/pockit-contribution-after.png' })
  await dialog.getByRole('button', { name: 'Save contribution' }).click()
  await expect(
    page.locator('.goal-card').first().getByText('$2,400', { exact: true }),
  ).toBeVisible()
  await page.locator('.bottom-nav').getByRole('button', { name: 'Activity' }).click()
  await expect(page.getByText('Savings for Emergency fund', { exact: true })).toHaveCount(1)
})

test('preview-only ideas do not have dead review buttons; unaffordable plans explain the problem', async ({
  page,
}) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await previewGoals(page)
  const lab = page.getByRole('region', { name: 'What-if Lab' })
  await expect(lab.getByRole('spinbutton')).toHaveCount(0)
  await lab.getByRole('button', { name: /Handle a surprise cost/ }).click()
  await lab.getByRole('spinbutton', { name: 'One-time surprise expense' }).fill('900')
  await expect(lab.getByText('Preview only', { exact: true })).toBeVisible()
  await expect(lab.getByRole('button', { name: /Review recurring changes/ })).toHaveCount(0)
  await lab.getByRole('button', { name: 'Change idea' }).click()
  await lab.getByRole('button', { name: /Pay debt sooner/ }).click()
  await lab.getByRole('spinbutton', { name: 'Extra debt payment each month' }).fill('999999')
  await lab.getByRole('button', { name: /Review recurring changes/ }).click()
  const review = page.getByRole('dialog', { name: 'Apply this plan?' })
  await expect(review.getByRole('alert')).toContainText('exceeds')
  await expect(review.getByRole('button', { name: 'Apply recurring plan' })).toBeDisabled()
  await review.getByRole('button', { name: 'Keep exploring' }).click()
  await lab.getByRole('spinbutton', { name: 'Extra debt payment each month' }).fill('50')
  await lab.getByRole('button', { name: /Review recurring changes/ }).click()
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Apply recurring plan' }),
  ).toBeEnabled()
})
