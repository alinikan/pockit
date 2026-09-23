// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { disablePushForCurrentAccount, unsubscribeBrowserPush } from './push'

afterEach(() => {
  Reflect.deleteProperty(navigator, 'serviceWorker')
})

describe('browser reminder cleanup', () => {
  it('does not hold sign-out open when no service worker is registered', async () => {
    const getRegistration = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration },
    })
    await expect(disablePushForCurrentAccount()).resolves.toBeUndefined()
    await expect(unsubscribeBrowserPush()).resolves.toBeUndefined()
    expect(getRegistration).toHaveBeenCalledTimes(2)
  })
  it('does nothing in a browser without service worker support', async () => {
    await expect(disablePushForCurrentAccount()).resolves.toBeUndefined()
    await expect(unsubscribeBrowserPush()).resolves.toBeUndefined()
  })
})
