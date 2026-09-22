// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { PockitData } from '../types'
import { makeDemoData } from '../lib/defaults'
import { categoryBudget, currentMonth, shiftMonth } from '../lib/finance'
import { BudgetScreen } from './Budget'

afterEach(cleanup)

describe('budget editor', () => {
  it('applies an ongoing allocation from the selected month without changing history', () => {
    let data: PockitData = makeDemoData()
    const month = currentMonth()
    const old = shiftMonth(month, -1)
    const groceries = data.categories.find((c) => c.name === 'Groceries')!
    const before = categoryBudget(groceries, old, 5800)
    render(
      <BudgetScreen
        data={data}
        month={month}
        update={(recipe) => {
          data = recipe(data)
        }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Groceries Food & Dining/ }))
    fireEvent.change(screen.getByLabelText('Amount each period'), { target: { value: '600' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save category' }))
    const changed = data.categories.find((c) => c.id === groceries.id)!
    expect(categoryBudget(changed, old, 5800)).toBe(before)
    expect(categoryBudget(changed, month, 5800)).toBe(600)
    expect(categoryBudget(changed, shiftMonth(month, 1), 5800)).toBe(600)
  })
})
