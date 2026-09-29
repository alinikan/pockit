import { expect, test } from '@playwright/test'

test('installed app opens every tab from its cache when origin requests fail', async ({
  page,
  context,
}) => {
  test.skip(
    !process.env.POCKIT_PREVIEW,
    'The service worker is only registered in a production build.',
  )
  await page.setViewportSize({ width: 402, height: 874 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await context.route('http://127.0.0.1:4179/**', (route) => route.abort('internetdisconnected'))
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
  for (const name of ['Activity', 'Budget', 'Calendar', 'Goals', 'Compare', 'More', 'Home']) {
    await page.locator('.bottom-nav').getByRole('button', { name }).click()
    await expect(page.locator('.bottom-nav').getByRole('button', { name })).toHaveClass(/active/)
    await expect(page.getByRole('main')).toBeVisible()
  }
  await page.reload()
  await expect(page.getByRole('button', { name: 'Preview Pockit' })).toBeVisible()
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
  await expect(page.locator('.bottom-nav').getByRole('button', { name: 'Home' })).toBeVisible()
})
