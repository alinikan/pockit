// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { dialogReturnTarget, installDialogFocusTracking } from './dialogFocus'

let stop: (() => void) | undefined
afterEach(() => {
  stop?.()
  document.body.replaceChildren()
})
it('remembers a Safari pointer opener without changing focus', () => {
  stop = installDialogFocusTracking()
  const button = document.createElement('button')
  const icon = document.createElement('span')
  button.append(icon)
  document.body.append(button)
  icon.dispatchEvent(new Event('pointerdown', { bubbles: true }))
  expect(document.activeElement).toBe(document.body)
  expect(dialogReturnTarget()).toBe(button)
  button.remove()
  expect(dialogReturnTarget()).toBeNull()
})
it('preserves the focused keyboard opener and removes its event listener on cleanup', () => {
  stop = installDialogFocusTracking()
  const button = document.createElement('button')
  document.body.append(button)
  button.focus()
  expect(dialogReturnTarget()).toBe(button)
  button.blur()
  stop()
  button.dispatchEvent(new Event('pointerdown', { bubbles: true }))
  expect(dialogReturnTarget()).toBeNull()
})
