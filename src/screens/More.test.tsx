// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { makeDemoData } from '../lib/defaults'
import { MoreScreen } from './More'

afterEach(cleanup)

describe('appearance settings', () => {
  it('offers five named colour choices and keeps the chosen light or dark mode', () => {
    let data = makeDemoData()
    const update = (recipe: (value: typeof data) => typeof data) => {
      data = recipe(data)
    }
    const view = render(
      <MoreScreen data={data} update={update} logout={vi.fn()} onDeleted={vi.fn()} demo />,
    )
    const themes = screen.getByRole('radiogroup', { name: 'Colour theme' })
    expect(within(themes).getAllByRole('radio')).toHaveLength(5)
    expect(within(themes).getByRole('radio', { name: /Pockit Garden/ })).toBeTruthy()
    fireEvent.click(within(themes).getByRole('radio', { name: /Coral Slate/ }))
    expect(data.settings).toMatchObject({ palette: 'waypoint', theme: 'dark' })
    view.rerender(
      <MoreScreen data={data} update={update} logout={vi.fn()} onDeleted={vi.fn()} demo />,
    )
    expect(
      within(screen.getByRole('radiogroup', { name: 'Colour theme' }))
        .getByRole('radio', { name: /Coral Slate/ })
        .getAttribute('aria-checked'),
    ).toBe('true')
    expect(screen.queryByText(/keeps you signed in when you close and reopen it/i)).toBeNull()
    expect(screen.queryByText(/website also works without installing it/i)).toBeNull()
    const glossary = screen.getByText('A few handy terms').closest('details')!
    expect(glossary.open).toBe(false)
    fireEvent.click(screen.getByText('A few handy terms'))
    expect(glossary.open).toBe(true)
    expect(glossary.querySelectorAll('.glossary-terms > div').length).toBeGreaterThan(10)
  })
})
describe('merchant rules', () => {
  it('adds, edits, and removes a rule without touching transactions', () => {
    let data = makeDemoData()
    const before = data.transactions.length
    const update = (recipe: (value: typeof data) => typeof data) => {
      data = recipe(data)
    }
    const view = () => (
      <MoreScreen data={data} update={update} logout={vi.fn()} onDeleted={vi.fn()} demo />
    )
    const { rerender } = render(view())
    fireEvent.click(screen.getByText('Merchant category rules'))
    fireEvent.change(screen.getByLabelText('Payee for new rule'), {
      target: { value: '  My Cafe  ' },
    })
    const groceries = data.categories.find((category) => category.name === 'Groceries')!
    fireEvent.change(screen.getByLabelText('Category for new rule'), {
      target: { value: groceries.id },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add rule' }))
    expect(data.settings.merchantRules).toContainEqual({
      payee: 'my cafe',
      categoryId: groceries.id,
    })
    rerender(view())
    const dining = data.categories.find((category) => category.name === 'Dining Out')!
    fireEvent.change(screen.getByLabelText('Category for my cafe'), {
      target: { value: dining.id },
    })
    expect(data.settings.merchantRules).toContainEqual({ payee: 'my cafe', categoryId: dining.id })
    rerender(view())
    fireEvent.click(screen.getByRole('button', { name: 'Remove rule for my cafe' }))
    expect(data.settings.merchantRules).toHaveLength(0)
    expect(data.transactions).toHaveLength(before)
  })
})
describe('iPhone navigation', () => {
  it('keeps at least four shortcuts and restores all pages on reset', () => {
    let data = makeDemoData()
    const update = (recipe: (value: typeof data) => typeof data) => {
      data = recipe(data)
    }
    const view = () => (
      <MoreScreen data={data} update={update} logout={vi.fn()} onDeleted={vi.fn()} demo />
    )
    const { rerender } = render(view())
    fireEvent.click(screen.getByText('iPhone bottom tabs'))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Compare' }))
    rerender(view())
    expect(data.settings.mobileTabs).not.toContain('Compare')
    fireEvent.click(screen.getByRole('button', { name: 'Move Goals tab up' }))
    rerender(view())
    expect(data.settings.mobileTabs?.indexOf('Goals')).toBeLessThan(
      data.settings.mobileTabs!.indexOf('Calendar'),
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'Activity' }))
    rerender(view())
    fireEvent.click(screen.getByRole('checkbox', { name: 'Budget' }))
    rerender(view())
    expect(data.settings.mobileTabs).toHaveLength(4)
    expect((screen.getByRole('checkbox', { name: 'Calendar' }) as HTMLInputElement).disabled).toBe(
      true,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Reset bottom tabs' }))
    rerender(view())
    expect(data.settings.mobileTabs).toBeUndefined()
    expect((screen.getByRole('checkbox', { name: 'Compare' }) as HTMLInputElement).checked).toBe(
      true,
    )
  })
})
