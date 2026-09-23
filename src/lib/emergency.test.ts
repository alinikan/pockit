import { describe, expect, it } from 'vitest'
import { makeDemoData } from './defaults'
import { emergencyMilestones } from './emergency'
import { currentMonth } from './finance'

describe('emergency milestones', () => {
  it('uses planned essentials and the current emergency goal balance', () => {
    const data = makeDemoData()
    const result = emergencyMilestones(data, currentMonth())
    expect(result.steps[0].amount).toBe(data.profile.payAmount)
    expect(result.steps.at(-1)!.amount).toBe(result.essential * 3)
    expect(result.saved).toBe(data.goals.find((goal) => goal.name === 'Emergency fund')!.balance)
  })
  it('omits zero thresholds for an unconfigured budget', () => {
    const data = makeDemoData()
    data.categories = []
    data.profile.payAmount = 0
    expect(emergencyMilestones(data, currentMonth()).steps).toEqual([])
  })
})
