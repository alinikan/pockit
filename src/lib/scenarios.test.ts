import { describe, expect, it } from 'vitest'
import { makeDemoData } from './defaults'
import { currentMonth } from './finance'
import { calculateScenario } from './scenarios'

describe('What-if Lab', () => {
  it('keeps the real budget untouched and changes the debt and savings estimates', () => {
    const data = makeDemoData()
    const original = JSON.stringify(data)
    const goalId = data.goals.find((goal) => goal.kind === 'saving')!.id
    const result = calculateScenario(data, currentMonth(), {
      extraDebt: 100,
      extraSaving: 50,
      expenseChange: -30,
      goalId,
    })
    expect(result.roomAfter).toBeCloseTo(result.roomBefore - 120)
    expect(result.debtAfter.months).toBeLessThan(result.debtBefore.months!)
    expect(result.goalAfter!.months).toBeLessThan(result.goalBefore!.months!)
    expect(JSON.stringify(data)).toBe(original)
  })
  it('normalizes non-finite input and missing goals', () => {
    const data = makeDemoData()
    const result = calculateScenario(data, currentMonth(), {
      extraDebt: Infinity,
      extraSaving: NaN,
      expenseChange: Infinity,
      goalId: 'gone',
    })
    expect(result.roomAfter).toBe(result.roomBefore)
    expect(result.goalAfter).toBeNull()
  })
})
