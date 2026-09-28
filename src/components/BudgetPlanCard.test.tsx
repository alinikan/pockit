// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { BudgetPlanCard } from './BudgetPlanCard'

afterEach(cleanup)

describe('monthly plan card', () => {
  it('keeps recorded pay distinct from planned income and explains it on demand', () => {
    render(
      <BudgetPlanCard
        expectedIncome={5800}
        recordedIncome={3150}
        allocated={4375}
        currency="CAD"
      />,
    )
    expect(screen.getByText('EXPECTED INCOME')).toBeTruthy()
    expect(screen.getByText('$1,425 left to plan')).toBeTruthy()
    expect(screen.getByText('$3,150')).toBeTruthy()
    const explanation = screen.getByText(/If a paycheque is higher or lower than expected/)
    expect(explanation.closest('details')?.open).toBe(false)
    fireEvent.click(screen.getByText('$3,150'))
    expect(explanation.closest('details')?.open).toBe(true)
  })

  it('calls out over planning and zero income without a misleading percentage', () => {
    const view = render(
      <BudgetPlanCard expectedIncome={5000} recordedIncome={0} allocated={5500} currency="CAD" />,
    )
    expect(screen.getByText('$500 over plan').classList.contains('negative')).toBe(true)
    expect(screen.getByText('110%').classList.contains('negative')).toBe(true)
    view.rerender(
      <BudgetPlanCard expectedIncome={0} recordedIncome={0} allocated={0} currency="CAD" />,
    )
    expect(screen.getByText('—')).toBeTruthy()
    expect(screen.getByText('$0 left to plan')).toBeTruthy()
  })
})
