// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installStandaloneZoomPolicy } from './standaloneZoom'

afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.classList.remove('standalone-app')
})

describe('installed app zoom policy', () => {
  it('limits pinch only in standalone mode and restores normal website zoom', () => {
    let standalone = false
    let onChange: (() => void) | undefined
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        get matches() {
          return standalone
        },
        addEventListener: (_: string, listener: () => void) => {
          onChange = listener
        },
        removeEventListener: vi.fn(),
      })),
    )
    vi.stubGlobal('navigator', { ...navigator, maxTouchPoints: 5 })
    document.head.innerHTML =
      '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
    const stop = installStandaloneZoomPolicy()
    const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')!
    expect(viewport.content).not.toContain('user-scalable=no')
    const browserGesture = new Event('gesturestart', { cancelable: true })
    document.dispatchEvent(browserGesture)
    expect(browserGesture.defaultPrevented).toBe(false)

    standalone = true
    onChange?.()
    expect(document.documentElement.classList.contains('standalone-app')).toBe(true)
    expect(viewport.content).toContain('user-scalable=no')
    const appGesture = new Event('gesturestart', { cancelable: true })
    document.dispatchEvent(appGesture)
    expect(appGesture.defaultPrevented).toBe(true)
    const pinch = new Event('touchmove', { cancelable: true })
    Object.defineProperty(pinch, 'touches', { value: [{}, {}] })
    document.dispatchEvent(pinch)
    expect(pinch.defaultPrevented).toBe(true)
    const singleFinger = new Event('touchmove', { cancelable: true })
    Object.defineProperty(singleFinger, 'touches', { value: [{}] })
    document.dispatchEvent(singleFinger)
    expect(singleFinger.defaultPrevented).toBe(false)

    stop()
    expect(viewport.content).not.toContain('user-scalable=no')
  })
})
