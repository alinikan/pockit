import { describe, expect, it } from 'vitest'
import { makeDemoData } from './defaults'
import {
  budgetComparison,
  categoryComparison,
  difference,
  monthSnapshot,
  UNCATEGORIZED,
} from './compare'
import type { PockitData } from '../types'

function fixture(): PockitData {
  const data = makeDemoData()
  const groceries = data.categories.find((category) => category.name === 'Groceries')!
  data.transactions = [
    {
      id: 'a',
      date: '2025-12-31',
      payee: 'Food',
      type: 'expense',
      amount: 80,
      categoryId: groceries.id,
    },
    {
      id: 'b',
      date: '2025-12-31',
      payee: 'Savings move',
      type: 'transfer',
      amount: 900,
      categoryId: groceries.id,
    },
    {
      id: 'c',
      date: '2026-01-01',
      payee: 'Food',
      type: 'expense',
      amount: 110,
      categoryId: groceries.id,
    },
    { id: 'd', date: '2026-01-02', payee: 'Mystery', type: 'expense', amount: 25 },
    {
      id: 'e',
      date: '2026-01-03',
      payee: 'Old category',
      type: 'expense',
      amount: 15,
      categoryId: 'deleted',
    },
    { id: 'f', date: '2026-01-04', payee: 'Pay', type: 'income', amount: 2500 },
  ]
  return data
}

describe('month comparisons', () => {
  it('uses calendar month boundaries, excludes transfers, and reconciles uncategorized expenses', () => {
    const data = fixture()
    const december = monthSnapshot(data, '2025-12')
    const january = monthSnapshot(data, '2026-01')
    expect(december.spent).toBe(80)
    expect(december.expenseCount).toBe(1)
    expect(january.spent).toBe(150)
    expect(january.recordedIncome).toBe(2500)
    expect(january.categorySpend[UNCATEGORIZED]).toBe(40)
    const rows = categoryComparison(data, [december, january])
    expect(rows.find((row) => row.name === 'Groceries')?.values).toEqual([80, 110])
    expect(rows.find((row) => row.name === 'Uncategorized')?.values).toEqual([0, 40])
    expect(rows.reduce((sum, row) => sum + row.values[1], 0)).toBe(january.spent)
  })

  it('reports a new category without dividing by zero', () => {
    expect(difference(0, 40)).toEqual({ amount: 40, percent: null })
    expect(difference(80, 110).percent).toBeCloseTo(37.5)
    expect(difference(80, 40).amount).toBe(-40)
  })

  it('keeps expected pay separate from recorded income', () => {
    const data = fixture()
    const december = monthSnapshot(data, '2025-12')
    expect(december.recordedIncome).toBe(0)
    expect(december.expectedIncome).toBe(5800)
  })

  it('includes uncategorized spending in plan versus actual', () => {
    const data = fixture()
    const rows = budgetComparison(data, '2026-01')
    expect(rows.find((row) => row.id === UNCATEGORIZED)).toMatchObject({ planned: 0, spent: 40 })
    expect(rows.reduce((sum, row) => sum + row.spent, 0)).toBe(150)
  })

  it('uses accumulated rollover balance before flagging a category as over budget', () => {
    const data = fixture()
    const groceries = data.categories.find((category) => category.name === 'Groceries')!
    groceries.mode = 'rollover'
    groceries.starts = '2025-12'
    groceries.baseAmount = 100
    const row = budgetComparison(data, '2026-01').find((item) => item.id === groceries.id)!
    expect(row.planned).toBe(100)
    expect(row.spent).toBe(110)
    expect(row.balance).toBe(10)
  })
})
