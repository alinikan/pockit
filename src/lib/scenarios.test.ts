import { describe, expect, it } from 'vitest'
import { makeDemoData } from './defaults'
import { currentMonth, monthSummary, shiftMonth } from './finance'
import { applyScenario, calculateScenario, requiredMonthlySaving } from './scenarios'

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
  it('adds visible recurring budget allocations with applied debt and savings changes', () => {
    const source = makeDemoData()
    const data = { ...source, profile: { ...source.profile, payAmount: 6000 } }
    const month = currentMonth()
    const goalId = data.goals.find((goal) => goal.kind === 'saving')!.id
    const input = { extraDebt: 80, extraSaving: 40, expenseChange: 0, goalId }
    const applied = applyScenario(data, month, input)
    expect(
      monthSummary(applied, month).allocated - monthSummary(data, month).allocated,
    ).toBeCloseTo(120)
    expect(
      monthSummary(applied, shiftMonth(month, 1)).allocated -
        monthSummary(data, shiftMonth(month, 1)).allocated,
    ).toBeCloseTo(120)
    expect(applied.debtPlan?.extra).toBe(80)
    expect(applied.goals.find((goal) => goal.id === goalId)!.monthly).toBe(
      data.goals.find((goal) => goal.id === goalId)!.monthly + 40,
    )
  })
  it('rejects one-time events and non-finite amounts as recurring changes', () => {
    const data = makeDemoData()
    const input = { extraDebt: 0, extraSaving: 0, expenseChange: 0, goalId: '' }
    expect(() => applyScenario(data, currentMonth(), { ...input, missedPay: true })).toThrow()
    expect(() => applyScenario(data, currentMonth(), { ...input, extraDebt: Infinity })).toThrow()
  })
  it('calculates a deadline contribution and handles an already funded goal', () => {
    expect(requiredMonthlySaving(0, 1200, 0, 12)).toBe(100)
    expect(requiredMonthlySaving(1300, 1200, 0, 12)).toBe(0)
    expect(requiredMonthlySaving(0, 1200, 0, 0)).toBeNull()
  })
  it('cannot claim more savings from a category than its current allocation', () => {
    const data = makeDemoData()
    const month = currentMonth()
    const category = data.categories.find((item) => item.name === 'Groceries')!
    const before = monthSummary(data, month).unallocated
    const result = calculateScenario(data, month, {
      extraDebt: 0,
      extraSaving: 0,
      expenseChange: -10000,
      goalId: '',
      categoryId: category.id,
    })
    expect(result.expenseChange).toBe(-480)
    expect(result.roomAfter).toBe(before + 480)
  })
})
