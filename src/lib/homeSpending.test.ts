import { describe, expect, it } from 'vitest'
import { categoryPlanProgress, homeSpendingVisual, type HomeSpendingRow } from './homeSpending'

const row = (id: string, used: number, plan: number, hasPlan = true): HomeSpendingRow => ({
  category: { id, name: id, color: '#5678ab', icon: 'House' },
  used,
  availableToSpend: plan,
  hasPlan,
})

describe('Home spending visuals', () => {
  it('fills a category meter against its own limit, not total expenses', () => {
    expect(categoryPlanProgress(row('Rent', 1500, 1500))).toBe(100)
    expect(categoryPlanProgress(row('Groceries', 405, 450))).toBe(90)
    expect(categoryPlanProgress(row('Dining', 180, 150))).toBe(120)
    expect(categoryPlanProgress(row('No plan', 20, 0, false))).toBeNull()
  })

  it('fills the ring from the visible category amounts and accounts for other spending', () => {
    const visual = homeSpendingVisual(
      [row('Rent', 1500, 1500), row('Groceries', 405, 450), row('Car', 350, 350)],
      2400,
      2,
    )
    expect(visual.showing.map((item) => item.category.id)).toEqual(['Rent', 'Groceries'])
    expect(visual.other).toBe(495)
    expect(visual.ringTotal).toBe(2400)
    expect(visual.segments.reduce((sum, segment) => sum + segment.share, 0)).toBeCloseTo(1)
    expect(visual.segments[0].share).toBeCloseTo(1500 / 2400)
    expect(visual.segments[1].start).toBeCloseTo(1500 / 2400)
  })

  it('keeps refunds visible as an offset instead of inventing a negative donut slice', () => {
    const visual = homeSpendingVisual([row('Rent', 150, 200), row('Return', -50, 100)], 100)
    expect(visual.ringTotal).toBe(150)
    expect(visual.refundOffset).toBe(50)
    expect(visual.segments).toHaveLength(1)
    expect(visual.segments[0].share).toBe(1)
  })

  it('leaves an empty ring when there are no positive expenses', () => {
    expect(homeSpendingVisual([row('Return', -20, 100)], -20).segments).toEqual([])
    expect(homeSpendingVisual([], 0).ringTotal).toBe(0)
  })
})
