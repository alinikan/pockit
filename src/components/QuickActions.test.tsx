// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QuickActions } from './QuickActions'

afterEach(cleanup)

describe('quick actions', () => {
  it('filters, selects with keyboard, and handles no matches', () => {
    const openHome = vi.fn()
    const add = vi.fn()
    const close = vi.fn()
    render(
      <QuickActions
        onClose={close}
        actions={[
          { label: 'Home', description: 'Overview', group: 'Pages', icon: 'House', run: openHome },
          {
            label: 'Add transaction',
            description: 'Record spending',
            group: 'Actions',
            icon: 'Plus',
            run: add,
          },
        ]}
      />,
    )
    const search = screen.getByRole('combobox', { name: 'Search pages and actions' })
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(add).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
    fireEvent.change(search, { target: { value: 'unavailable page' } })
    expect(screen.getByText(/No match/)).toBeTruthy()
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(openHome).not.toHaveBeenCalled()
  })
})
