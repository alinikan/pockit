// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { usePhoneViewport } from './usePhoneViewport'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('follows a phone keyboard and rotation, while leaving browser pinch zoom alone', () => {
  const viewport = new EventTarget() as VisualViewport
  Object.assign(viewport, { height: 800, offsetTop: 0, scale: 1 })
  vi.stubGlobal('visualViewport', viewport)
  vi.stubGlobal('innerWidth', 402)
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  const { result, unmount } = renderHook(() => usePhoneViewport())
  expect(result.current).toEqual({ height: 800, top: 0 })
  act(() => {
    Object.assign(viewport, { height: 380, offsetTop: 12 })
    viewport.dispatchEvent(new Event('resize'))
  })
  expect(result.current).toEqual({ height: 380, top: 12 })
  act(() => {
    vi.stubGlobal('innerWidth', 956)
    window.dispatchEvent(new Event('resize'))
  })
  expect(result.current).toEqual({ height: 380, top: 12 })
  act(() => {
    Object.assign(viewport, { scale: 2 })
    viewport.dispatchEvent(new Event('resize'))
  })
  expect(result.current).toBeNull()
  const remove = vi.spyOn(viewport, 'removeEventListener')
  unmount()
  expect(remove).toHaveBeenCalledTimes(2)
})

it('does not constrain a desktop overlay or require VisualViewport support', () => {
  vi.stubGlobal('visualViewport', undefined)
  const { result } = renderHook(() => usePhoneViewport())
  expect(result.current).toBeNull()
})
