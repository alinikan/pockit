// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeInitialData, newCategory } from '../lib/defaults'
import type { PockitData } from '../types'
import { ActivityScreen } from './Activity'
import { BudgetScreen } from './Budget'
import { CompareScreen } from './Compare'
import { HomeScreen } from './Home'

afterEach(cleanup)

function historicalImport(): PockitData {
  const data = makeInitialData()
  data.onboarded = true
  data.profile.waypointPlanStarts = '2026-09'
  data.profile.payAmount = 1000
  data.profile.plannedMonthlyIncome = 0
  data.profile.plannedIncomeStarts = '2026-09'
  const category = newCategory(
    'Groceries',
    'ShoppingBasket',
    'Food & Dining',
    '#aee789',
    390,
    '2026-09',
  )
  category.waypointKey = 'waypoint:category:groceries'
  data.categories = [category]
  data.transactions = [
    {
      id: 'purchase',
      date: '2026-08-11',
      payee: 'Market',
      amount: 80,
      type: 'expense',
      categoryId: category.id,
    },
    {
      id: 'reimbursement',
      date: '2026-08-12',
      payee: 'Market return',
      amount: 25,
      type: 'expense',
      refund: true,
      waypointTypeRaw: 'reimbursement',
      categoryId: category.id,
    },
    { id: 'pay', date: '2026-08-15', payee: 'Pay', amount: 500, type: 'income' },
  ]
  return data
}

describe('historical Waypoint months in the app', () => {
  it('shows recorded net and labels missing budget history on Home', () => {
    render(
      <HomeScreen
        data={historicalImport()}
        month="2026-08"
        setTab={() => {}}
        openCoach={() => {}}
        update={() => {}}
      />,
    )
    expect(screen.getByText('Recorded income less spending')).toBeTruthy()
    expect(screen.getByText('$445', { selector: '.hero-number' })).toBeTruthy()
    expect(screen.getByText('Not exported')).toBeTruthy()
    expect(screen.getByText(/no historical budget plan for it/i)).toBeTruthy()
    expect(screen.queryByText(/over budget/i)).toBeNull()
  })

  it('does not offer to cover a false overage in Budget', () => {
    render(<BudgetScreen data={historicalImport()} month="2026-08" update={() => {}} />)
    expect(
      screen.getByText(/did not include the amounts you planned for this earlier month/i),
    ).toBeTruthy()
    expect(screen.getByText('No plan')).toBeTruthy()
    expect(screen.queryByText('MONTHLY PLAN')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Categories needing attention' })).toBeNull()
  })

  it('does not present a fabricated plan gap in Compare', () => {
    render(<CompareScreen data={historicalImport()} month="2026-08" />)
    fireEvent.click(screen.getByRole('tab', { name: /Plan vs spent/ }))
    expect(screen.getByText(/no matching monthly budget amounts/i)).toBeTruthy()
    expect(screen.getByText(/amounts below are recorded spending only/i)).toBeTruthy()
    expect(screen.queryByText('THIS MONTH GAP')).toBeNull()
  })

  it('uses recorded cash flow for an earlier month in Compare overview', () => {
    render(<CompareScreen data={historicalImport()} month="2026-09" />)
    expect(
      screen.getByText('Recorded net cash flow*').closest('.compare-detail-row')?.textContent,
    ).toContain('$445.00')
  })

  it('labels a positive Waypoint reimbursement in Activity', () => {
    render(<ActivityScreen data={historicalImport()} month="2026-08" update={() => {}} />)
    const row = screen.getByRole('button', { name: /Market return/ })
    expect(row.textContent).toContain('Reimbursement · Groceries')
    expect(row.textContent).toContain('+$25.00')
  })
})
