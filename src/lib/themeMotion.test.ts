// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { animateThemeChange } from './themeMotion'

afterEach(() => {
  Object.defineProperty(document, 'startViewTransition', { configurable: true, value: undefined })
  document.documentElement.classList.remove('theme-revealing')
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('theme change motion', () => {
  it('applies immediately when View Transitions are unavailable', () => {
    const apply = vi.fn()
    animateThemeChange(apply)
    expect(apply).toHaveBeenCalledOnce()
    expect(document.documentElement.classList.contains('theme-revealing')).toBe(false)
  })
  it('reveals from the button and cleans up after the transition', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const apply = vi.fn()
    const start = vi.fn((callback: () => void) => {
      callback()
      return { finished: Promise.resolve() }
    })
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: start })
    const button = document.createElement('button')
    button.getBoundingClientRect = () => ({
      left: 20,
      top: 40,
      width: 40,
      height: 40,
      right: 60,
      bottom: 80,
      x: 20,
      y: 40,
      toJSON: () => {},
    })
    animateThemeChange(apply, button)
    expect(start).toHaveBeenCalledOnce()
    expect(apply).toHaveBeenCalledOnce()
    expect(document.documentElement.style.getPropertyValue('--theme-reveal-x')).toBe('40px')
    expect(document.documentElement.style.getPropertyValue('--theme-reveal-y')).toBe('60px')
    await Promise.resolve()
    expect(document.documentElement.classList.contains('theme-revealing')).toBe(false)
  })
  it('respects reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const start = vi.fn()
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: start })
    const apply = vi.fn()
    animateThemeChange(apply)
    expect(apply).toHaveBeenCalledOnce()
    expect(start).not.toHaveBeenCalled()
  })
  it('clears the reveal state if a browser never finishes its transition', () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: (apply: () => void) => {
        apply()
        return { finished: new Promise(() => {}) }
      },
    })
    animateThemeChange(() => {})
    expect(document.documentElement.classList.contains('theme-revealing')).toBe(true)
    vi.advanceTimersByTime(901)
    expect(document.documentElement.classList.contains('theme-revealing')).toBe(false)
  })
})
