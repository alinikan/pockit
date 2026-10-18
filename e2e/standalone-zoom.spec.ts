import { expect, test } from '@playwright/test'

test('Safari website keeps zoom available', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).not.toHaveClass(/standalone-app/)
  await expect(page.locator('meta[name="viewport"]')).not.toHaveAttribute(
    'content',
    /user-scalable=no/,
  )
  const blocked = await page.evaluate(() => {
    const gesture = new Event('gesturestart', { cancelable: true })
    document.dispatchEvent(gesture)
    return gesture.defaultPrevented
  })
  expect(blocked).toBe(false)
})

test('installed standalone mode limits pinch but preserves one-finger gestures', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window)
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5 })
    window.matchMedia = ((query: string) =>
      query === '(display-mode: standalone)'
        ? ({
            matches: true,
            media: query,
            addEventListener() {},
            removeEventListener() {},
          } as MediaQueryList)
        : original(query)) as typeof window.matchMedia
  })
  await page.goto('/')
  await expect(page.locator('html')).toHaveClass(/standalone-app/)
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /user-scalable=no/)
  const gestures = await page.evaluate(() => {
    const gesture = new Event('gesturestart', { cancelable: true })
    document.dispatchEvent(gesture)
    const pinch = new Event('touchmove', { cancelable: true })
    Object.defineProperty(pinch, 'touches', { value: [{}, {}] })
    document.dispatchEvent(pinch)
    const single = new Event('touchmove', { cancelable: true })
    Object.defineProperty(single, 'touches', { value: [{}] })
    document.dispatchEvent(single)
    return [gesture.defaultPrevented, pinch.defaultPrevented, single.defaultPrevented]
  })
  expect(gestures).toEqual([true, true, false])
})

test('a desktop installed window keeps normal zoom', async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window)
    window.matchMedia = ((query: string) =>
      query === '(display-mode: standalone)'
        ? ({ matches: true, addEventListener() {}, removeEventListener() {} } as MediaQueryList)
        : original(query)) as typeof window.matchMedia
  })
  await page.goto('/')
  await expect(page.locator('html')).not.toHaveClass(/standalone-app/)
  await expect(page.locator('meta[name="viewport"]')).not.toHaveAttribute(
    'content',
    /user-scalable=no/,
  )
})

test('iOS installed zoom protection stays active through every tab and a nested form', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { value: true })
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5 })
  })
  await page.setViewportSize({ width: 402, height: 874 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Pockit' }).click()
  for (const name of ['Home', 'Activity', 'Budget', 'Calendar', 'Goals', 'Compare', 'More']) {
    await page.locator('.bottom-nav').getByRole('button', { name, exact: true }).click()
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
      'content',
      /minimum-scale=1, maximum-scale=1/,
    )
    const prevented = await page.locator('.page-content').evaluate((element) => {
      const event = new Event('touchstart', { cancelable: true, bubbles: true })
      Object.defineProperty(event, 'touches', { value: [{}, {}] })
      element.dispatchEvent(event)
      return event.defaultPrevented
    })
    expect(prevented, name).toBe(true)
  }
  await page.locator('.bottom-nav').getByRole('button', { name: 'Activity', exact: true }).click()
  await page.getByRole('button', { name: 'Add transaction', exact: true }).click()
  const blocked = await page
    .getByRole('dialog')
    .getByRole('textbox', { name: 'Store or purchase (optional)' })
    .evaluate((element) => {
      element.addEventListener('gesturechange', (event) => event.stopPropagation(), { once: true })
      const gesture = new Event('gesturechange', { cancelable: true, bubbles: true })
      element.dispatchEvent(gesture)
      return gesture.defaultPrevented
    })
  expect(blocked).toBe(true)
})
