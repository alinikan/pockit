import type { Goal, PockitData } from '../types'

export interface UpdateFeedback {
  /** Only explicit, recorded money movements may celebrate a goal. */
  celebrateGoal?: boolean
}

export function reachedSavingsGoals(before: PockitData, after: PockitData): Goal[] {
  return after.goals.filter((goal) => {
    const previous = before.goals.find((item) => item.id === goal.id)
    return (
      goal.kind === 'saving' &&
      previous?.kind === 'saving' &&
      Number.isFinite(goal.target) &&
      Number.isFinite(goal.balance) &&
      Number.isFinite(previous.balance) &&
      goal.target > 0 &&
      previous.target === goal.target &&
      previous.balance < goal.target &&
      goal.balance >= goal.target &&
      goal.balance > previous.balance
    )
  })
}
