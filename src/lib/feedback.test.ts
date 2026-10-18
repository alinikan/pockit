import { describe, expect, it } from 'vitest'
import { makeDemoData } from './defaults'
import { reachedSavingsGoals } from './feedback'
import { validateExperienceData } from './experienceValidation'

describe('recorded savings milestones', () => {
  const before = () => {
    const data = makeDemoData()
    data.goals = [
      {
        id: 'goal',
        name: 'Emergency fund',
        kind: 'saving',
        balance: 90,
        target: 100,
        monthly: 10,
        annualInterest: 0,
        color: '#fff',
        icon: 'Flag',
        history: [],
      },
    ]
    return data
  }
  it.each([100, 105])('recognizes a contribution reaching %s', (balance) => {
    const data = before(),
      next = structuredClone(data)
    next.goals[0].balance = balance
    expect(reachedSavingsGoals(data, next).map((goal) => goal.id)).toEqual(['goal'])
  })
  it.each([
    'target edit',
    'new goal',
    'debt',
    'withdrawal',
    'already reached',
    'not reached',
    'zero target',
  ])('does not celebrate %s', (scenario) => {
    const data = before(),
      next = structuredClone(data)
    next.goals[0].balance = 100
    if (scenario === 'target edit') next.goals[0].target = 95
    if (scenario === 'new goal') data.goals = []
    if (scenario === 'debt') data.goals[0].kind = next.goals[0].kind = 'debt'
    if (scenario === 'withdrawal') {
      data.goals[0].balance = 110
      next.goals[0].balance = 105
    }
    if (scenario === 'already reached') data.goals[0].balance = 100
    if (scenario === 'not reached') next.goals[0].balance = 99.99
    if (scenario === 'zero target') data.goals[0].target = next.goals[0].target = 0
    expect(reachedSavingsGoals(data, next)).toEqual([])
  })
  it.each([Infinity, NaN, -1])('rejects invalid balances (%s)', (balance) => {
    const data = before(),
      next = structuredClone(data)
    next.goals[0].balance = balance
    expect(reachedSavingsGoals(data, next)).toEqual([])
  })
  it('accepts the optional celebration preference and rejects corrupted backup values', () => {
    const data = before()
    data.settings.goalCelebrations = false
    expect(() => validateExperienceData(data)).not.toThrow()
    Object.assign(data.settings, { goalCelebrations: 'false' })
    expect(() => validateExperienceData(data)).toThrow('celebration')
  })
})
