// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { makeDemoData } from '../lib/defaults'
import { currentMonth, monthSummary, money } from '../lib/finance'
import { MoreScreen } from './More'

afterEach(cleanup)

describe('More menu', () => {
  it('shows only menu choices, then only the selected settings', () => {
    const logout = vi.fn()
    render(
      <MoreScreen
        data={makeDemoData()}
        update={vi.fn()}
        logout={logout}
        onDeleted={vi.fn()}
        demo
      />,
    )
    const menu = screen.getByRole('region', { name: 'More menu' })
    expect(within(menu).getAllByRole('button')).toHaveLength(10)
    expect(within(menu).queryByRole('button', { name: 'Compare months' })).toBeNull()
    expect(screen.queryByText('Your profile')).toBeNull()
    fireEvent.click(within(menu).getByRole('button', { name: 'Profile' }))
    expect(screen.getByRole('heading', { name: 'Your profile' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Your paycheque rhythm' })).toBeNull()
    expect(
      screen
        .getByLabelText(/Usual take-home pay per payday/)
        .closest('[data-more-section]')
        ?.hasAttribute('hidden'),
    ).toBe(true)
    expect(screen.queryByRole('region', { name: 'More menu' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Back to More' }))
    fireEvent.click(screen.getByRole('button', { name: 'Help & terms' }))
    expect((document.querySelector('[data-more-section="help"]') as HTMLDetailsElement).open).toBe(
      true,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Back to More' }))
    fireEvent.click(screen.getByRole('button', { name: 'Exit preview' }))
    expect(logout).toHaveBeenCalledOnce()
  })

  it('keeps imports and security in their own views for a signed-in account', () => {
    render(
      <MoreScreen
        data={makeDemoData()}
        update={vi.fn()}
        logout={vi.fn()}
        onDeleted={vi.fn()}
        demo={false}
      />,
    )
    const menu = screen.getByRole('region', { name: 'More menu' })
    expect(within(menu).getAllByRole('button')).toHaveLength(11)
    fireEvent.click(within(menu).getByRole('button', { name: 'Imports & data' }))
    expect(screen.getByRole('heading', { name: 'Your data' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Preferences' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Back to More' }))
    fireEvent.click(screen.getByRole('button', { name: 'Security' }))
    expect(screen.getByRole('heading', { name: 'Account security' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Delete account' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Your data' })).toBeNull()
  })
})

describe('income plan settings', () => {
  it('separates usual take-home pay from paycheques actually recorded', () => {
    let data = makeDemoData()
    const month = currentMonth()
    const before = monthSummary(data, month)
    const view = () => (
      <MoreScreen
        data={data}
        update={(recipe) => {
          data = recipe(data)
        }}
        logout={vi.fn()}
        onDeleted={vi.fn()}
        demo
      />
    )
    const { rerender } = render(view())
    fireEvent.click(screen.getByRole('button', { name: 'Paycheques' }))
    const preview = screen.getByLabelText('Planned and recorded income')
    expect(screen.getByLabelText(/Usual take-home pay per payday/)).toBeTruthy()
    expect(preview.textContent).toContain(money(before.income, data.settings.currency, true))
    data.transactions.push({
      id: 'overtime',
      date: `${month}-20`,
      payee: 'Overtime pay',
      amount: 175,
      type: 'income',
    })
    rerender(view())
    expect(preview.textContent).toContain(
      money(before.actualIncome + 175, data.settings.currency, true),
    )
    expect(monthSummary(data, month).income).toBe(before.income)
    fireEvent.change(screen.getByLabelText(/Usual take-home pay per payday/), {
      target: { value: '4000' },
    })
    rerender(view())
    expect(monthSummary(data, month).actualIncome).toBe(before.actualIncome + 175)
    expect(screen.getByText(/Dated weekly or biweekly paydays count/)).toBeTruthy()
  })

  it('makes an imported monthly plan’s priority and removal clear', () => {
    let data = makeDemoData()
    data.profile.payFrequency = 'biweekly'
    data.profile.paydayAnchor = undefined
    data.profile.plannedMonthlyIncome = 5000
    data.profile.plannedIncomeStarts = currentMonth()
    const view = () => (
      <MoreScreen
        data={data}
        update={(recipe) => {
          data = recipe(data)
        }}
        logout={vi.fn()}
        onDeleted={vi.fn()}
        demo
      />
    )
    const { rerender } = render(view())
    fireEvent.click(screen.getByRole('button', { name: 'Paycheques' }))
    expect(monthSummary(data, currentMonth()).income).toBe(5000)
    expect(
      screen.getByText(/imported monthly plan is used for months without dated paydays/),
    ).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/Usual take-home pay per payday/), {
      target: { value: '1200' },
    })
    rerender(view())
    expect(monthSummary(data, currentMonth()).income).toBe(5000)
    fireEvent.click(screen.getByRole('button', { name: 'Use my pay details instead' }))
    rerender(view())
    expect(data.profile.plannedMonthlyIncome).toBeUndefined()
    expect(monthSummary(data, currentMonth()).income).not.toBe(5000)
  })
})

describe('appearance settings', () => {
  it('offers five named colour choices and keeps the chosen light or dark mode', () => {
    let data = makeDemoData()
    const update = (recipe: (value: typeof data) => typeof data) => {
      data = recipe(data)
    }
    const view = render(
      <MoreScreen data={data} update={update} logout={vi.fn()} onDeleted={vi.fn()} demo />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Preferences' }))
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
    fireEvent.click(screen.getByRole('button', { name: 'Back to More' }))
    fireEvent.click(screen.getByRole('button', { name: 'Help & terms' }))
    const glossary = screen.getByText('A few handy terms').closest('details')!
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
    fireEvent.click(screen.getByRole('button', { name: 'Preferences' }))
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
    fireEvent.click(screen.getByRole('button', { name: 'Preferences' }))
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
