import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const wcag = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

async function scan(page: Page) {
  const report = await new AxeBuilder({ page }).withTags(wcag).analyze()
  expect(
    report.violations,
    JSON.stringify(
      report.violations.map((violation) => ({
        id: violation.id,
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          summary: node.failureSummary,
        })),
      })),
      null,
      2,
    ),
  ).toEqual([])
}

test('welcome and sign-in controls have no detected WCAG A/AA issues', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await page.goto('/')
  await scan(page)
})

test('Activity list, filters, and transaction editor have no detected WCAG A/AA issues', async ({
  page,
}) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
  await page.locator('.bottom-nav').getByRole('button', { name: 'Activity' }).click()
  await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible()
  await scan(page)
  await page.getByRole('button', { name: 'Filter & sort' }).click()
  await scan(page)
  await page.getByRole('button', { name: 'Add transaction', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'New transaction' })).toBeVisible()
  await scan(page)
})

test('Compare controls have no detected WCAG A/AA issues', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
  await page.locator('.bottom-nav').getByRole('button', { name: 'Compare' }).click()
  await expect(page.getByRole('heading', { name: 'Choose your months' })).toBeVisible()
  await scan(page)
})
