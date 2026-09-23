import { describe, expect, it } from 'vitest'
import { makeDemoData } from './defaults'
import {
  budgetComparison,
  categoryComparison,
  comparisonFindings,
  difference,
  monthSnapshot,
  parseMonthInput,
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
  it.each([
    ['', null],
    ['2026-00', null],
    ['2026-13', null],
    ['2026-1', null],
    ['26-01', null],
    ['0000-01', null],
    ['0999-12', null],
    ['2026-01-01', null],
    ['2024-02', '2024-02'],
    ['2026-12', '2026-12'],
  ])('validates month input %s', (input, expected) => {
    expect(parseMonthInput(input)).toBe(expected)
  })

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
    expect(difference(80, 80)).toEqual({ amount: 0, percent: 0 })
  })

  it('does not count neighboring months, income, or transfers as spending', () => {
    const data = fixture()
    expect(monthSnapshot(data, '2026-02')).toMatchObject({
      spent: 0,
      recordedIncome: 0,
      expenseCount: 0,
      categorySpend: {},
    })
    expect(monthSnapshot(data, '2025-12').recordedIncome).toBe(0)
    expect(monthSnapshot(data, '2026-01').expenseCount).toBe(3)
  })

  it('can include unspent categories without changing month totals', () => {
    const data = fixture()
    const snapshots = [monthSnapshot(data, '2025-12'), monthSnapshot(data, '2026-01')]
    const spentOnly = categoryComparison(data, snapshots)
    const all = categoryComparison(data, snapshots, true)
    expect(all.length).toBeGreaterThan(spentOnly.length)
    expect(all.find((row) => row.name === 'Utilities')?.values).toEqual([0, 0])
    for (const [index, snapshot] of snapshots.entries())
      expect(all.reduce((sum, row) => sum + row.values[index], 0)).toBe(snapshot.spent)
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
    data.transactions.push({
      id: 'extra',
      date: '2026-01-20',
      payee: 'More food',
      type: 'expense',
      amount: 20,
      categoryId: groceries.id,
    })
    expect(
      budgetComparison(data, '2026-01').find((item) => item.id === groceries.id)?.balance,
    ).toBe(-10)
  })

  it('uses linked transfers to fund manual rollover without counting them as expenses', () => {
    const data = fixture()
    const groceries = data.categories.find((category) => category.name === 'Groceries')!
    groceries.mode = 'rollover'
    groceries.funding = 'manual'
    groceries.starts = '2025-12'
    const december = monthSnapshot(data, '2025-12')
    const row = budgetComparison(data, '2026-01').find((item) => item.id === groceries.id)!
    expect(december.spent).toBe(80)
    expect(row.balance).toBe(710)
  })

  it('finds real increases, decreases, and over-budget categories', () => {
    const data = fixture()
    const before = monthSnapshot(data, '2025-12')
    const after = monthSnapshot(data, '2026-01')
    const findings = comparisonFindings(data, before, after)
    expect(findings.some((finding) => finding.title === 'Uncategorized moved up the most')).toBe(
      true,
    )
    expect(findings.some((finding) => finding.title.includes('need attention'))).toBe(true)
    expect(
      findings.find((finding) => finding.title === 'Uncategorized moved up the most')?.text,
    ).toContain('$40.00')
    expect(findings.some((finding) => finding.kind === 'good')).toBe(false)
    expect(
      comparisonFindings(data, monthSnapshot(data, '2025-11'), after).some((finding) =>
        finding.title.includes('moved up'),
      ),
    ).toBe(false)
  })

  it('formats insights in Canadian dollars', () => {
    const data = fixture()
    data.settings.currency = 'CAD'
    const findings = comparisonFindings(
      data,
      monthSnapshot(data, '2025-12'),
      monthSnapshot(data, '2026-01'),
    )
    expect(findings.find((finding) => finding.title.includes('moved up'))?.text).toContain('$40')
  })
})
