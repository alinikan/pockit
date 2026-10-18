import { describe, expect, it } from 'vitest'
import type { Goal } from '../types'
import { goalMilestones } from './goalMilestones'
import { projectGoal } from './finance'
const goal: Goal = {
  id: 'saving',
  name: 'Emergency fund',
  kind: 'saving',
  target: 1000,
  balance: 100,
  monthly: 100,
  annualInterest: 0,
  color: '#aab',
  icon: 'Flag',
  history: [],
}
describe('savings checkpoints', () => {
  it('uses CAD cents and the same monthly projections as the goal chart', () => {
    const points = goalMilestones(goal)
    expect(points.map((p) => p.amount)).toEqual([250, 500, 750, 1000])
    expect(points.map((p) => p.remaining)).toEqual([150, 400, 650, 900])
    expect(points.map((p) => p.months)).toEqual([2, 4, 7, 9])
    for (const p of points) expect(p.months).toBe(projectGoal({ ...goal, target: p.amount }).months)
  })
  it('marks reached milestones and handles savings beyond the target', () => {
    expect(goalMilestones({ ...goal, balance: 500 }).map((p) => p.reached)).toEqual([
      true,
      true,
      false,
      false,
    ])
    expect(
      goalMilestones({ ...goal, balance: 1500 }).every(
        (p) => p.reached && p.remaining === 0 && p.months === 0,
      ),
    ).toBe(true)
  })
  it('does not invent an arrival time when there is no achievable plan', () => {
    expect(goalMilestones({ ...goal, monthly: 0 }).every((p) => p.months === null)).toBe(true)
    expect(goalMilestones({ ...goal, monthly: 0.001 }).at(-1)?.months).toBeNull()
    expect(goalMilestones({ ...goal, monthly: NaN }).at(-1)?.months).toBeNull()
    expect(goalMilestones({ ...goal, annualInterest: Infinity }).at(-1)?.months).toBeNull()
  })
  it('includes compound interest using the existing projection engine', () => {
    const plan = { ...goal, balance: 500, monthly: 0, annualInterest: 12 }
    expect(goalMilestones(plan).at(-1)?.months).toBe(projectGoal(plan).months)
    expect(goalMilestones(plan).at(-1)?.months).toBeGreaterThan(0)
  })
  it('merges tiny goals into distinct positive cent checkpoints', () => {
    expect(goalMilestones({ ...goal, target: 0.01, balance: 0 })).toEqual([
      { percent: 100, amount: 0.01, remaining: 0.01, reached: false, months: 1 },
    ])
    const points = goalMilestones({ ...goal, target: 0.02, balance: 0 })
    expect(points.map((p) => p.amount)).toEqual([0.01, 0.02])
    expect(points.at(-1)?.percent).toBe(100)
  })
  it.each([0, -1, NaN, Infinity, 0.001])('omits invalid targets: %s', (target) => {
    expect(goalMilestones({ ...goal, target })).toEqual([])
  })
  it('omits debt goals and invalid balances, and uses zero for negative balances', () => {
    expect(goalMilestones({ ...goal, kind: 'debt' })).toEqual([])
    expect(goalMilestones({ ...goal, balance: NaN })).toEqual([])
    expect(goalMilestones({ ...goal, balance: -100 })[0].remaining).toBe(250)
  })
  it('does not mutate the saved goal or its history', () => {
    const source = structuredClone(goal)
    const before = structuredClone(source)
    goalMilestones(source)
    expect(source).toEqual(before)
  })
})
