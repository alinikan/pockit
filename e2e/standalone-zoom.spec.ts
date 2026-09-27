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
