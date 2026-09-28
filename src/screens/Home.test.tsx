// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { makeDemoData } from '../lib/defaults'
import type { PockitData } from '../types'
import { currentMonth, monthSummary, money } from '../lib/finance'
import { HomeScreen } from './Home'

afterEach(cleanup)

describe('Home customization', () => {
  it('hides, reorders, and resets sections without changing money data', () => {
    let data: PockitData = makeDemoData()
    const before = JSON.stringify(data.transactions)
    const update = (recipe: (value: PockitData) => PockitData) => {
      data = recipe(data)
    }
    const view = () => (
      <HomeScreen
        data={data}
        month={currentMonth()}
        setTab={() => {}}
        onAddIncome={() => {}}
        update={update}
      />
    )
    const { rerender, container } = render(view())
    fireEvent.click(screen.getByRole('button', { name: 'Customize Home' }))
    const modal = screen.getByRole('dialog', { name: 'Customize Home' })
    fireEvent.click(within(modal).getByRole('checkbox', { name: /Weekly check-in/ }))
    rerender(view())
    expect(screen.queryByLabelText('Pockit Pulse')).toBeNull()
    fireEvent.keyDown(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Drag Income and expenses to reorder',
      }),
      { key: 'ArrowUp' },
    )
    rerender(view())
    expect(data.settings.homeOrder?.indexOf('trends')).toBe(4)
    const cards = [...container.querySelectorAll('.screen-stack > [style*="order:"]')]
    expect(cards.length).toBeGreaterThan(4)
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Reset layout' }),
    )
    rerender(view())
    expect(screen.getByLabelText('Pockit Pulse')).toBeTruthy()
    expect(data.settings.homeOrder).toBeUndefined()
    expect(JSON.stringify(data.transactions)).toBe(before)
  })

  it('moves a section by dragging its handle and keeps the coach promotion off Home', () => {
    let data = makeDemoData()
    const view = () => (
      <HomeScreen
        data={data}
        month={currentMonth()}
        setTab={() => {}}
        onAddIncome={() => {}}
        update={(recipe) => {
          data = recipe(data)
        }}
      />
    )
    const { rerender, container } = render(view())
    expect(screen.queryByText('A second set of eyes for your money.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Customize Home' }))
    const grip = screen.getByRole('button', { name: 'Drag Income and expenses to reorder' })
    const target = container.querySelector('[data-home-section="overview"]')!
    const original = document.elementFromPoint
    document.elementFromPoint = vi.fn(() => target)
    grip.setPointerCapture = vi.fn()
    fireEvent.pointerDown(grip, { pointerId: 1, pointerType: 'touch', clientX: 10, clientY: 10 })
    fireEvent.pointerMove(grip, { pointerId: 1, pointerType: 'touch', clientX: 10, clientY: 10 })
    fireEvent.pointerUp(grip, { pointerId: 1, pointerType: 'touch' })
    rerender(view())
    expect(data.settings.homeOrder?.[0]).toBe('trends')
    document.elementFromPoint = original
  })
})

describe('Home money picture', () => {
  it('uses category limits for bars and category amounts for the ring', () => {
    const data = makeDemoData()
    const month = currentMonth()
    const view = () => (
      <HomeScreen
        data={data}
        month={month}
        setTab={() => {}}
        onAddIncome={() => {}}
        update={() => {}}
      />
    )
    const { container, rerender } = render(view())
    const panel = container.querySelector('.actual-panel') as HTMLElement
    const rent = within(panel).getByRole('button', { name: /View Rent transactions/ })
    expect(rent.querySelector('.spending-meter > span')?.getAttribute('style')).toContain('100%')
    expect(rent.textContent).toContain('100%')
    expect(rent.textContent).toContain('plan used')
    const ring = panel.querySelector('svg[aria-label^="Spending by category"]')!
    expect(ring.querySelectorAll('.spending-ring-segment').length).toBeGreaterThan(1)
    expect(ring.getAttribute('aria-label')).toContain('Rent $1,500')
    fireEvent.click(rent)
    expect(screen.getByRole('dialog', { name: 'Rent transactions' })).toBeTruthy()
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Rent transactions' })).getByRole('button', {
        name: 'Close',
      }),
    )
    data.transactions.push({
      id: 'extra-rent',
      date: `${month}-18`,
      payee: 'Extra rent',
      amount: 100,
      type: 'expense',
      categoryId: data.categories.find((category) => category.name === 'Rent')!.id,
    })
    rerender(view())
    const updated = within(panel).getByRole('button', { name: /View Rent transactions/ })
    expect(updated.textContent).toContain('107%')
    expect(updated.textContent).toContain('$100 over')
    expect(
      within(container.querySelector('.breakdown-panel') as HTMLElement).getByText('$100.00 over'),
    ).toBeTruthy()
  })

  it('keeps the monthly plan stable when an actual paycheque differs', () => {
    const data = makeDemoData()
    const month = currentMonth()
    const before = monthSummary(data, month)
    const view = () => (
      <HomeScreen
        data={data}
        month={month}
        setTab={() => {}}
        onAddIncome={() => {}}
        update={() => {}}
      />
    )
    const { container, rerender } = render(view())
    expect(container.querySelector('.hero-number')?.textContent).toBe(
      money(before.remaining, data.settings.currency, true),
    )
    data.transactions.push({
      id: 'extra-pay',
      date: `${month}-19`,
      payee: 'Overtime pay',
      amount: 300,
      type: 'income',
    })
    rerender(view())
    expect(container.querySelector('.hero-number')?.textContent).toBe(
      money(before.remaining, data.settings.currency, true),
    )
    expect(screen.getByText(/Received so far:/).textContent).toContain(
      money(before.actualIncome + 300, data.settings.currency, true),
    )
    fireEvent.click(screen.getByRole('button', { name: 'How this Home number is calculated' }))
    expect(screen.getByRole('dialog', { name: 'This month’s number' })).toBeTruthy()
  })

  it('does not call a refunded purchase a month with no activity', () => {
    const data = makeDemoData()
    const month = currentMonth()
    const rent = data.categories.find((category) => category.name === 'Rent')!
    data.transactions = [
      {
        id: 'charge',
        date: `${month}-08`,
        payee: 'Charge',
        amount: 50,
        type: 'expense',
        categoryId: rent.id,
      },
      {
        id: 'refund',
        date: `${month}-09`,
        payee: 'Refund',
        amount: 50,
        type: 'expense',
        refund: true,
        categoryId: rent.id,
      },
    ]
    const { container } = render(
      <HomeScreen
        data={data}
        month={month}
        setTab={() => {}}
        onAddIncome={() => {}}
        update={() => {}}
      />,
    )
    const panel = container.querySelector('.actual-panel') as HTMLElement
    expect(within(panel).getByText('No net spending')).toBeTruthy()
    expect(panel.querySelectorAll('.spending-ring-segment')).toHaveLength(0)
    expect(panel.querySelector('.spending-donut svg')?.getAttribute('aria-label')).toContain(
      'after refunds',
    )
  })
})

describe('Category Breakdown', () => {
  it('shows all categories and the exact entries behind one total', () => {
    const data = makeDemoData()
    const month = currentMonth()
    const view = () => (
      <HomeScreen
        data={data}
        month={month}
        setTab={() => {}}
        onAddIncome={() => {}}
        update={() => {}}
      />
    )
    const { container, rerender } = render(view())
    const panel = container.querySelector('.breakdown-panel')!
    expect(screen.getByRole('heading', { name: 'Category Breakdown' })).toBeTruthy()
    expect(panel.querySelectorAll('.category-line').length).toBeGreaterThan(6)
    fireEvent.click(
      within(panel as HTMLElement).getByRole('button', { name: 'View Groceries transactions' }),
    )
    const modal = screen.getByRole('dialog', { name: 'Groceries transactions' })
    const entries = within(modal).getByLabelText('Category transactions')
    expect(within(entries).getByText('Fresh Market')).toBeTruthy()
    expect(within(entries).getByText('Costco')).toBeTruthy()
    expect(within(entries).getByText('Superstore')).toBeTruthy()
    expect(within(entries).queryByText('Rent')).toBeNull()
    data.transactions.push({
      id: 'new-grocery',
      date: `${month}-20`,
      payee: 'Corner Store',
      amount: 7.5,
      type: 'expense',
      categoryId: data.categories.find((item) => item.name === 'Groceries')!.id,
    })
    rerender(view())
    expect(
      within(screen.getByRole('dialog', { name: 'Groceries transactions' })).getByText(
        'Corner Store',
      ),
    ).toBeTruthy()
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Groceries transactions' })).getByRole('button', {
        name: 'Close',
      }),
    )
    fireEvent.click(
      within(panel as HTMLElement).getByRole('button', { name: 'View Savings transactions' }),
    )
    const savings = screen.getByRole('dialog', { name: 'Savings transactions' })
    expect(within(savings).getByText('Savings transfer')).toBeTruthy()
    expect(within(savings).getByText(/Transfer · not spending/)).toBeTruthy()
  })

  it('filters off-track categories and explains a category with no entries', () => {
    const data = makeDemoData()
    const groceries = data.categories.find((item) => item.name === 'Groceries')!
    groceries.baseAmount = 100
    groceries.targetValue = 100
    const { container } = render(
      <HomeScreen
        data={data}
        month={currentMonth()}
        setTab={() => {}}
        onAddIncome={() => {}}
        update={() => {}}
      />,
    )
    const panel = container.querySelector('.breakdown-panel') as HTMLElement
    const filters = within(panel).getByRole('group', { name: 'Filter categories' })
    fireEvent.click(within(filters).getByRole('button', { name: /Off Track/ }))
    expect(within(panel).getByRole('button', { name: 'View Groceries transactions' })).toBeTruthy()
    expect(within(panel).queryByRole('button', { name: 'View Rent transactions' })).toBeNull()
    fireEvent.click(within(filters).getByRole('button', { name: /All/ }))
    fireEvent.click(within(panel).getByRole('button', { name: 'View Shopping transactions' }))
    expect(
      within(screen.getByRole('dialog', { name: 'Shopping transactions' })).getByText(
        'No entries yet',
      ),
    ).toBeTruthy()
  })
})
