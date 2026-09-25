import { describe, expect, it } from 'vitest'
import { buildOnboardedData, makeInitialData } from './defaults'
import { categoryBudget, currentMonth, shiftMonth } from './finance'
import { syncGoalPlans } from './goalPlans'

const starting = () => {
  const base = makeInitialData()
  return buildOnboardedData({
    ...base,
    profile: { ...base.profile, payAmount: 3000 },
    goals: [
      {
        id: 'trip',
        kind: 'saving',
        name: 'Trip',
        balance: 0,
        target: 1000,
        monthly: 100,
        annualInterest: 0,
        color: '#fff',
        icon: 'Plane',
        history: [],
      },
      {
        id: 'card',
        kind: 'debt',
        name: 'Card',
        balance: 800,
        target: 0,
        monthly: 80,
        annualInterest: 18,
        color: '#fff',
        icon: 'CreditCard',
        history: [],
      },
    ],
  })
}

describe('goal payments and the starter plan', () => {
  it('changes the linked budget amount from this month onward when a goal payment changes', () => {
    const before = starting()
    const savings = before.categories.find((category) => category.name === 'Savings')!
    expect(savings.linkedGoalKind).toBe('saving')
    const next = shiftMonth(currentMonth(), 5)
    const after = syncGoalPlans(
      before,
      {
        ...before,
        goals: before.goals.map((goal) => (goal.id === 'trip' ? { ...goal, monthly: 175 } : goal)),
      },
      next,
    )
    const linked = after.categories.find((category) => category.id === savings.id)!
    expect(categoryBudget(linked, shiftMonth(next, -1), 3000)).toBe(100)
    expect(categoryBudget(linked, next, 3000)).toBe(175)
    expect(categoryBudget(linked, shiftMonth(next, 1), 3000)).toBe(175)
    expect(after.categories.find((category) => category.name === 'Debt Payments')?.baseAmount).toBe(
      80,
    )
  })
  it('sums multiple goals, marks zero payments as needing an amount, and respects a detached category', () => {
    const before = starting()
    const withSecond = syncGoalPlans(
      before,
      {
        ...before,
        goals: [...before.goals, { ...before.goals[0], id: 'home', name: 'Home', monthly: 50 }],
      },
      currentMonth(),
    )
    expect(withSecond.categories.find((category) => category.name === 'Savings')?.baseAmount).toBe(
      150,
    )
    const zero = syncGoalPlans(
      withSecond,
      {
        ...withSecond,
        goals: withSecond.goals.map((goal) =>
          goal.kind === 'saving' ? { ...goal, monthly: 0 } : goal,
        ),
      },
      shiftMonth(currentMonth(), 1),
    )
    expect(zero.categories.find((category) => category.name === 'Savings')).toMatchObject({
      needsAmount: true,
      linkedGoalKind: 'saving',
    })
    const detached = {
      ...zero,
      categories: zero.categories.map((category) =>
        category.name === 'Savings'
          ? { ...category, linkedGoalKind: undefined, baseAmount: 65 }
          : category,
      ),
    }
    const changed = syncGoalPlans(
      detached,
      {
        ...detached,
        goals: detached.goals.map((goal) =>
          goal.id === 'trip' ? { ...goal, monthly: 300 } : goal,
        ),
      },
      shiftMonth(currentMonth(), 2),
    )
    expect(changed.categories.find((category) => category.name === 'Savings')?.baseAmount).toBe(65)
  })
})
