// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { GoalReached, SyncIndicator, type SyncStatus } from './SaveFeedback'
import { ValueChange } from './ValueChange'

afterEach(cleanup)
it.each<SyncStatus>(['saving', 'offline', 'error', 'conflict'])(
  'never reports cloud success for %s',
  (status) => {
    render(<SyncIndicator status={status} />)
    expect(screen.getByRole('status').textContent).not.toContain('Saved to cloud')
  },
)
it('updates a single accessible status when cloud acknowledgement arrives', () => {
  const view = render(<SyncIndicator status="saving" />)
  view.rerender(<SyncIndicator status="saved" />)
  expect(screen.getAllByRole('status')).toHaveLength(1)
  expect(screen.getByRole('status').textContent).toContain('Saved to cloud')
})
it('can dismiss a reached goal and never exposes money amounts', () => {
  const close = vi.fn()
  render(<GoalReached goal={{ name: 'Emergency fund' }} onClose={close} />)
  expect(screen.getByRole('status').textContent).toContain('Emergency fund')
  expect(screen.getByRole('status').textContent).not.toContain('$')
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss goal celebration' }))
  expect(close).toHaveBeenCalledTimes(1)
})
it('highlights a changed value without displaying intermediate money amounts', () => {
  const view = render(<ValueChange value={100}>$100.00</ValueChange>)
  expect(view.container.querySelector('.value-change')).toBeNull()
  view.rerender(<ValueChange value={80}>$80.00</ValueChange>)
  expect(view.container.textContent).toBe('$80.00')
  expect(view.container.querySelector('.value-change')).not.toBeNull()
})
