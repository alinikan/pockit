import { describe, expect, it } from 'vitest'
import { makeDemoData } from './defaults'
import { categoryBudget, currentMonth, monthSummary, shiftMonth } from './finance'
import { syncGoalPlans } from './goalPlans'
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
    expect(result.expenseChange).toBe(-category.baseAmount)
    expect(result.roomAfter).toBe(before + category.baseAmount)
  })
  it.each(['weekly', 'biweekly', 'twice-monthly', 'monthly'] as const)(
    'applies monthly changes correctly to %s categories',
    (frequency) => {
      const data = makeDemoData()
      data.profile.payAmount = 10000
      const month = currentMonth()
      const id = data.categories[0].id
      data.categories[0] = { ...data.categories[0], frequency, baseAmount: 100 }
      const input = { extraDebt: 0, extraSaving: 0, expenseChange: 50, goalId: '', categoryId: id }
      const applied = applyScenario(data, month, input)
      for (const key of [month, shiftMonth(month, 1)])
        expect(
          categoryBudget(applied.categories[0], key, 20000) -
            categoryBudget(data.categories[0], key, 20000),
        ).toBeCloseTo(50)
      expect(categoryBudget(applied.categories[0], shiftMonth(month, -1), 20000)).toBe(
        categoryBudget(data.categories[0], shiftMonth(month, -1), 20000),
      )
    },
  )
  it('uses current recurring frequency rules instead of the original frequency', () => {
    const data = makeDemoData()
    data.profile.payAmount = 10000
    const month = currentMonth()
    data.categories[0].policyChanges = {
      [month]: {
        frequency: 'weekly',
        mode: 'fresh',
        targetType: 'fixed',
        targetValue: 100,
        funding: 'auto',
      },
    }
    const applied = applyScenario(data, month, {
      extraDebt: 0,
      extraSaving: 0,
      expenseChange: 100,
      goalId: '',
      categoryId: data.categories[0].id,
    })
    expect(
      monthSummary(applied, month).allocated - monthSummary(data, month).allocated,
    ).toBeCloseTo(100)
  })
  it('updates an overridden month while preserving earlier plans and applying the future change', () => {
    const data = makeDemoData()
    data.profile.payAmount = 10000
    const month = currentMonth()
    data.categories[0].overrides[month] = 1234
    const applied = applyScenario(data, month, {
      extraDebt: 0,
      extraSaving: 0,
      expenseChange: -50,
      goalId: '',
      categoryId: data.categories[0].id,
    })
    expect(applied.categories[0].overrides[month]).toBe(1184)
    expect(categoryBudget(applied.categories[0], shiftMonth(month, 1), 20000)).toBe(
      data.categories[0].baseAmount - 50,
    )
    expect(data.categories[0].overrides[month]).toBe(1234)
  })
  it('respects a frequency override for this month without changing its ongoing schedule', () => {
    const data = makeDemoData()
    data.profile.payAmount = 10000
    const month = currentMonth()
    data.categories[0].policyOverrides = {
      [month]: {
        frequency: 'weekly',
        mode: 'fresh',
        targetType: 'fixed',
        targetValue: 100,
        funding: 'auto',
      },
    }
    const applied = applyScenario(data, month, {
      extraDebt: 0,
      extraSaving: 0,
      expenseChange: 50,
      goalId: '',
      categoryId: data.categories[0].id,
    })
    expect(
      monthSummary(applied, month).allocated - monthSummary(data, month).allocated,
    ).toBeCloseTo(50)
    expect(
      monthSummary(applied, shiftMonth(month, 1)).allocated -
        monthSummary(data, shiftMonth(month, 1)).allocated,
    ).toBeCloseTo(50)
  })
  it('does not double-count extra savings when the starter budget follows goals', () => {
    const data = makeDemoData()
    data.profile.payAmount = 10000
    const month = currentMonth()
    const goal = data.goals.find((item) => item.kind === 'saving')!
    data.categories[0] = {
      ...data.categories[0],
      baseAmount: goal.monthly,
      linkedGoalKind: 'saving',
    }
    const input = { extraDebt: 0, extraSaving: 50, expenseChange: 0, goalId: goal.id }
    const applied = applyScenario(data, month, input)
    const viaApp = syncGoalPlans(data, applied)
    expect(monthSummary(viaApp, month).allocated - monthSummary(data, month).allocated).toBeCloseTo(
      50,
    )
    expect(applied.categories.some((item) => item.name.startsWith('Extra savings:'))).toBe(false)
    expect(viaApp.goals.find((item) => item.id === goal.id)?.monthly).toBe(goal.monthly + 50)
  })
  it('keeps linked savings monthly overrides in step with the preview', () => {
    const data = makeDemoData()
    data.profile.payAmount = 10000
    const month = currentMonth()
    const goal = data.goals.find((item) => item.kind === 'saving')!
    data.categories[0] = {
      ...data.categories[0],
      baseAmount: goal.monthly,
      linkedGoalKind: 'saving',
      overrides: { [month]: 500 },
    }
    const applied = applyScenario(data, month, {
      extraDebt: 0,
      extraSaving: 50,
      expenseChange: 0,
      goalId: goal.id,
    })
    expect(
      monthSummary(applied, month).allocated - monthSummary(data, month).allocated,
    ).toBeCloseTo(50)
  })
  it('rejects invalid optional amounts, missing targets, empty changes and archived categories', () => {
    const data = makeDemoData()
    data.profile.payAmount = 10000
    const month = currentMonth()
    const input = { extraDebt: 0, extraSaving: 0, expenseChange: 0, goalId: '' }
    for (const oneTimeExpense of [NaN, Infinity])
      expect(() => applyScenario(data, month, { ...input, oneTimeExpense })).toThrow(
        /valid amounts/,
      )
    expect(() => applyScenario(data, month, input)).toThrow(/recurring change/)
    expect(() => applyScenario(data, month, { ...input, extraSaving: 50 })).toThrow(
      /Choose a savings goal/,
    )
    data.categories[0].archived = true
    expect(() =>
      applyScenario(data, month, {
        ...input,
        expenseChange: 50,
        categoryId: data.categories[0].id,
      }),
    ).toThrow(/Choose a category/)
    data.goals = []
    expect(() => applyScenario(data, month, { ...input, extraDebt: 50 })).toThrow(/Add a debt/)
  })
})
