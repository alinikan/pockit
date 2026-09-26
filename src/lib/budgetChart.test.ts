import { describe, expect, it } from 'vitest'
import { newCategory } from './defaults'
import { budgetChart, budgetShareLabel } from './budgetChart'

describe('Budget Breakdown chart', () => {
  it('uses the total assigned to categories as the percentage denominator', () => {
    const rent = newCategory('Rent', 'House', 'Bills', '#4587fb', 300, '2026-09')
    const food = newCategory('Groceries', 'ShoppingBasket', 'Food', '#1ab581', 100, '2026-09')
    const chart = budgetChart([rent, food], '2026-09', 1000)
    expect(chart.total).toBe(400)
    expect(chart.slices.map(({ percent, startPercent }) => [percent, startPercent])).toEqual([
      [75, 0],
      [25, 75],
    ])
    expect(chart.slices.reduce((sum, slice) => sum + slice.percent, 0)).toBeCloseTo(100)
    expect(budgetChart([rent, food], '2026-09', 200).slices[0].percent).toBe(75)
  })

  it('updates with the selected month and omits zero, future, or archived plans', () => {
    const rent = newCategory('Rent', 'House', 'Bills', '#4587fb', 300, '2026-09')
    const future = newCategory('Future', 'CalendarDays', 'Bills', '#f00', 200, '2026-11')
    const zero = newCategory('Zero', 'Circle', 'Bills', '#0f0', 0, '2026-09')
    rent.overrides['2026-10'] = 150
    expect(budgetChart([rent, future, zero], '2026-09', 1000).total).toBe(300)
    expect(budgetChart([rent, future, zero], '2026-10', 1000).total).toBe(150)
    rent.archived = true
    rent.ends = '2026-09'
    expect(budgetChart([rent, future, zero], '2026-10', 1000).slices).toEqual([])
  })

  it('handles an empty plan and labels very small shares without showing zero percent', () => {
    expect(budgetChart([], '2026-09', 0)).toEqual({ total: 0, slices: [] })
    expect(budgetShareLabel(0.05)).toBe('<0.1%')
    expect(budgetShareLabel(30)).toBe('30.0%')
  })
})
