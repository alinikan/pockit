// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { makeDemoData } from '../lib/defaults'
import { currentMonth } from '../lib/finance'
import type { PockitData } from '../types'
import { CompareScreen } from './Compare'

afterEach(cleanup)

function comparisonData(): PockitData {
  const data = makeDemoData()
  data.categories = data.categories.filter((category) =>
    ['Rent', 'Groceries', 'Savings', 'Utilities'].includes(category.name),
  )
  const category = (name: string) => data.categories.find((item) => item.name === name)!
  for (const item of data.categories) item.starts = '2025-12'
  category('Rent').baseAmount = 500
  category('Groceries').baseAmount = 150
  category('Savings').baseAmount = 100
  category('Savings').mode = 'rollover'
  data.transactions = [
    {
      id: 'rent-old',
      date: '2025-12-01',
      payee: 'Rent',
      type: 'expense',
      amount: 500,
      categoryId: category('Rent').id,
    },
    {
      id: 'food-old',
      date: '2025-12-03',
      payee: 'Food',
      type: 'expense',
      amount: 100,
      categoryId: category('Groceries').id,
    },
    {
      id: 'rent',
      date: '2026-01-01',
      payee: 'Rent',
      type: 'expense',
      amount: 500,
      categoryId: category('Rent').id,
    },
    {
      id: 'food',
      date: '2026-01-02',
      payee: 'Food',
      type: 'expense',
      amount: 180,
      categoryId: category('Groceries').id,
    },
    { id: 'other', date: '2026-01-03', payee: 'Mystery', type: 'expense', amount: 20 },
    {
      id: 'save',
      date: '2026-01-04',
      payee: 'Savings expense',
      type: 'expense',
      amount: 120,
      categoryId: category('Savings').id,
    },
    { id: 'pay', date: '2026-01-05', payee: 'Pay', type: 'income', amount: 1000 },
    {
      id: 'move',
      date: '2026-01-06',
      payee: 'Transfer',
      type: 'transfer',
      amount: 500,
      categoryId: category('Savings').id,
    },
  ]
  return data
}

describe('Compare screen', () => {
  it('lets someone choose extra months and switch comparison views', () => {
    render(<CompareScreen data={makeDemoData()} month={currentMonth()} />)
    expect(screen.getByText('Expenses, side by side')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Add month' }))
    expect(screen.getByLabelText('MONTH 3')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /Categories/ }))
    expect(screen.getByText('Category by category')).toBeTruthy()
    expect(screen.getByRole('table')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Include $0 categories'))
    expect((screen.getByLabelText('Include $0 categories') as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByRole('tab', { name: /Trend/ }))
    expect(screen.getByText('The longer view', { selector: 'h3' })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /Plan vs spent/ }))
    expect(screen.getByText('Plan vs spent', { selector: 'h3' })).toBeTruthy()
  })

  it('prevents duplicate comparison months', () => {
    render(<CompareScreen data={makeDemoData()} month={currentMonth()} />)
    const baseline = screen.getByLabelText('BASELINE') as HTMLInputElement
    const second = screen.getByLabelText('MONTH 2') as HTMLInputElement
    const original = second.value
    fireEvent.change(second, { target: { value: '' } })
    expect(screen.getByRole('alert').textContent).toContain('valid month')
    fireEvent.change(second, { target: { value: baseline.value } })
    expect(second.value).toBe(original)
    expect(screen.getByRole('alert').textContent).toContain('different month')
    fireEvent.change(baseline, { target: { value: '2024-12' } })
    expect((screen.getByLabelText('BASELINE') as HTMLInputElement).value).toBe('2024-12')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText(/December 2024/, { selector: '.compare-column-index' })).toBeTruthy()
  })

  it('adds earlier months across a year boundary and caps the comparison at four', () => {
    render(<CompareScreen data={comparisonData()} month="2026-01" />)
    expect((screen.getByLabelText('BASELINE') as HTMLInputElement).value).toBe('2025-12')
    fireEvent.click(screen.getByRole('button', { name: 'Add month' }))
    expect((screen.getByLabelText('BASELINE') as HTMLInputElement).value).toBe('2025-11')
    fireEvent.click(screen.getByRole('button', { name: 'Add month' }))
    expect(screen.getAllByLabelText(/BASELINE|MONTH \d/)).toHaveLength(4)
    expect(screen.queryByRole('button', { name: 'Add month' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Remove October 2025' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove November 2025' }))
    expect(screen.getAllByLabelText(/BASELINE|MONTH \d/)).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /^Remove / })).toBeNull()
  })

  it('keeps the baseline when adding a month at the earliest supported date', () => {
    render(<CompareScreen data={comparisonData()} month="1000-02" />)
    fireEvent.click(screen.getByRole('button', { name: 'Add month' }))
    expect((screen.getByLabelText('BASELINE') as HTMLInputElement).value).toBe('1000-01')
    expect((screen.getByLabelText('MONTH 3') as HTMLInputElement).value).toBe('1000-03')
  })

  it('shows category spending, group subtotals, and all-expense totals', () => {
    render(<CompareScreen data={comparisonData()} month="2026-01" />)
    fireEvent.click(screen.getByRole('tab', { name: /Categories/ }))
    const table = screen.getByRole('table')
    expect(
      within(table).getByRole('row', { name: /Total expenses.*\$600\.00.*\$820\.00/ }),
    ).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Group'), { target: { value: 'Food & Dining' } })
    expect(
      within(table).getByRole('row', { name: /Food & Dining total.*\$100\.00.*\$180\.00/ }),
    ).toBeTruthy()
    expect(
      within(table).getByRole('row', { name: /All expenses.*\$600\.00.*\$820\.00/ }),
    ).toBeTruthy()
    expect(within(table).queryByRole('row', { name: /Rent.*\$500\.00/ })).toBeNull()
    fireEvent.change(screen.getByLabelText('BASELINE'), { target: { value: '2024-12' } })
    expect((screen.getByLabelText('Group') as HTMLSelectElement).value).toBe('Food & Dining')
    expect(
      within(table).getByRole('row', { name: /Food & Dining total.*\$0\.00.*\$180\.00/ }),
    ).toBeTruthy()
  })

  it('sorts category rows and includes unspent categories only when asked', () => {
    render(<CompareScreen data={comparisonData()} month="2026-01" />)
    fireEvent.click(screen.getByRole('tab', { name: /Categories/ }))
    const firstName = () => screen.getByRole('table').querySelector('tbody tr th')?.textContent
    expect(firstName()).toContain('Rent')
    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'change' } })
    expect(firstName()).toContain('Savings')
    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'name' } })
    expect(firstName()).toContain('Groceries')
    expect(within(screen.getByRole('table')).queryByRole('row', { name: /Utilities/ })).toBeNull()
    fireEvent.click(screen.getByLabelText('Include $0 categories'))
    expect(
      within(screen.getByRole('table')).getByRole('row', { name: /Utilities.*\$0\.00/ }),
    ).toBeTruthy()
  })

  it('changes trend length and shows the correct total and average across empty months', () => {
    render(<CompareScreen data={comparisonData()} month="2026-01" />)
    fireEvent.click(screen.getByRole('tab', { name: /Trend/ }))
    const chart = screen.getByRole('group', { name: /Spending over 6 months ending January 2026/ })
    expect(chart.querySelectorAll('.compare-trend-item')).toHaveLength(6)
    fireEvent.click(within(chart).getByRole('button', { name: 'Inspect January 2026 spending' }))
    expect(screen.getByText(/\$820\.00 across 4 expenses/)).toBeTruthy()
    expect(screen.getByText('$1,420.00')).toBeTruthy()
    expect(screen.getByText('$236.67')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '3m' }))
    expect(chart.querySelectorAll('.compare-trend-item')).toHaveLength(3)
    expect(screen.getByText('$473.33')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '12m' }))
    expect(chart.querySelectorAll('.compare-trend-item')).toHaveLength(12)
  })

  it('explains fresh, rollover, and unallocated spending separately', () => {
    render(<CompareScreen data={comparisonData()} month="2026-01" />)
    fireEvent.click(screen.getByRole('tab', { name: /Plan vs spent/ }))
    expect(screen.getByText('$30.00 over the planned amount')).toBeTruthy()
    expect(screen.getByText('$80.00 available after carryover')).toBeTruthy()
    expect(screen.getByText('Spent without a monthly plan')).toBeTruthy()
    expect(screen.getByText('$820.00')).toBeTruthy()
  })

  it('treats empty history as missing entries and marks the current month incomplete', () => {
    const data = comparisonData()
    data.transactions = []
    render(<CompareScreen data={data} month={currentMonth()} />)
    expect(screen.getByText('Add expenses in both months to compare.')).toBeTruthy()
    expect(screen.getByText(/Current or future months may be incomplete/)).toBeTruthy()
    expect(screen.queryByText(/Spending fell by/)).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: /Categories/ }))
    expect(screen.getByText('No spending in this group for these months.')).toBeTruthy()
  })

  it('shows user-entered category text as text, without creating HTML elements', () => {
    const data = comparisonData()
    data.categories.find((category) => category.name === 'Groceries')!.name =
      '<img src=x onerror=alert(1)>'
    const { container } = render(<CompareScreen data={data} month="2026-01" />)
    fireEvent.click(screen.getByRole('tab', { name: /Categories/ }))
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeTruthy()
    expect(container.querySelector('img[src="x"]')).toBeNull()
  })
})
