import type { Goal } from '../types'
import { projectGoal } from './finance'

/** Checkpoints use the same projection as the chart; they never change the goal. */
export function goalMilestones(goal: Goal) {
  if (
    goal.kind !== 'saving' ||
    !Number.isFinite(goal.target) ||
    goal.target < 0.01 ||
    !Number.isFinite(goal.balance)
  )
    return []
  const balance = Math.max(0, goal.balance)
  // Round to real CAD cents and merge checkpoints that land on the same cent.
  const checkpoints = new Map<number, number>()
  for (const percent of [25, 50, 75, 100]) {
    const cents = Math.round(goal.target * percent)
    if (cents > 0) checkpoints.set(cents, percent)
  }
  return Array.from(checkpoints, ([cents, percent]) => {
    const amount = cents / 100
    const remaining = Math.max(0, Math.round((amount - balance) * 100) / 100)
    const validPlan = Number.isFinite(goal.monthly) && Number.isFinite(goal.annualInterest)
    return {
      percent,
      amount,
      remaining,
      reached: remaining === 0,
      months:
        remaining === 0
          ? 0
          : validPlan
            ? projectGoal({ ...goal, balance, target: amount }).months
            : null,
    }
  })
}
