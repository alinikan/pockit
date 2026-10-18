import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
async function preview(page: Page) {
  await page.setViewportSize({ width: 402, height: 874 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
}
async function fits(page: Page, selector: string) {
  const boxes = await page.locator(selector).evaluateAll((nodes) =>
    nodes
      .filter((n) => n.getClientRects().length)
      .map((n) => {
        const r = n.getBoundingClientRect()
        return {
          name: n.textContent,
          left: r.left,
          right: r.right,
          height: r.height,
          viewport: document.documentElement.clientWidth,
          overflow: n.scrollWidth - n.clientWidth,
        }
      }),
  )
  for (const box of boxes) {
    expect(box.left, box.name || selector).toBeGreaterThanOrEqual(0)
    expect(box.right, box.name || selector).toBeLessThanOrEqual(box.viewport + 1)
    expect(box.overflow, box.name || selector).toBeLessThanOrEqual(1)
  }
}
test('Home gives money priority and its tool tiles fit narrow and wide screens', async ({
  page,
}) => {
  await preview(page)
  for (const width of [320, 375, 393, 402, 420, 440, 760, 1280, 1440]) {
    await page.setViewportSize({ width, height: 874 })
    const overview = await page.locator('.hero-grid').boundingBox()
    const tools = await page.locator('.money-tool-actions').boundingBox()
    expect(tools!.y).toBeGreaterThanOrEqual(overview!.y + overview!.height - 1)
    await fits(page, '.money-tool-actions > button, .money-tool-actions strong')
  }
  await page.setViewportSize({ width: 402, height: 874 })
  await page.getByRole('button', { name: 'Next 60 days', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveCSS('opacity', '1')
  await expect(dialog).toHaveCSS('transform', 'none')
  await expect(page.locator('body')).toHaveCSS('position', 'fixed')
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.locator('body')).not.toHaveCSS('position', 'fixed')
})
test('milestones are optional, accurate, private, and usable by keyboard without changing a goal', async ({
  page,
}) => {
  await preview(page)
  await page.locator('.bottom-nav').getByRole('button', { name: 'Goals', exact: true }).click()
  const goal = page.locator('.goal-card').filter({ hasText: 'Emergency fund' }).first()
  const explorer = goal.locator('.goal-milestones')
  await expect(explorer).not.toHaveAttribute('open', '')
  await explorer.locator('summary').focus()
  await page.keyboard.press('Enter')
  await expect(explorer).toHaveAttribute('open', '')
  await explorer.getByRole('button', { name: '50% milestone', exact: true }).click()
  await expect(explorer.locator('.milestone-detail')).toContainText('$3,000.00')
  await expect(explorer.locator('.milestone-detail')).toContainText('$650.00 more')
  await explorer.getByRole('button', { name: '100% milestone', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(explorer.locator('.milestone-detail')).toContainText('$6,000.00')
  await expect(goal.locator('.goal-amount')).toContainText('$2,350')
  for (const width of [320, 375, 402, 440, 1280]) {
    await page.setViewportSize({ width, height: 874 })
    await fits(
      page,
      '.goal-milestones, .milestone-stops button, .milestone-detail, .milestone-detail strong',
    )
    for (const button of await explorer.locator('.milestone-stops button').all())
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }
  await page.getByRole('button', { name: 'Hide money amounts' }).click()
  await expect(explorer).not.toContainText('$')
  await expect(explorer).toContainText('••••')
  await page.getByRole('button', { name: 'Show money amounts' }).click()
  await page.setViewportSize({ width: 402, height: 874 })
  await explorer.scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/studio-goal-dark.png', fullPage: false })
})
test('checkpoint controls remain readable in every palette and both appearances', async ({
  page,
}) => {
  await preview(page)
  for (const palette of ['Iris', 'Pacific', 'Afterglow', 'Pockit Garden', 'Slate']) {
    await page.locator('.bottom-nav').getByRole('button', { name: 'More', exact: true }).click()
    await page.getByRole('button', { name: 'Preferences', exact: true }).click()
    await page.getByRole('radio', { name: new RegExp(palette) }).click()
    await page.locator('.bottom-nav').getByRole('button', { name: 'Goals', exact: true }).click()
    const explorer = page.locator('.goal-milestones').first()
    await explorer.locator('summary').click()
    for (const mode of ['dark', 'light']) {
      const current = await page.locator('html').getAttribute('data-theme')
      if (current !== mode)
        await page.getByRole('button', { name: `Switch to ${mode} mode` }).click()
      await expect(page.locator('html')).toHaveAttribute('data-theme', mode)
      await fits(page, '.goal-milestones, .milestone-stops button, .milestone-detail')
      const results = await new AxeBuilder({ page })
        .include('.goal-milestones')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze()
      expect(
        results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      ).toEqual([])
    }
  }
})
test('production has no Motion Studio overlay and reduced motion leaves the goal artwork still', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await preview(page)
  await page.locator('.bottom-nav').getByRole('button', { name: 'Goals', exact: true }).click()
  const explorer = page.locator('.goal-milestones').first()
  await explorer.locator('summary').click()
  await explorer.getByRole('button', { name: '100% milestone', exact: true }).click()
  await expect(explorer.locator('img')).toHaveCSS('transform', 'none')
  await expect(page.getByLabel('Motion timeline')).toHaveCount(0)
})
