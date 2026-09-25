import type { GoalKind, MonthKey, PockitData } from '../types'
import { categoryPeriodAmount, currentMonth } from './finance'

/** Keep setup-linked budget categories aligned with the goal payments they were created from. */
export function syncGoalPlans(
  before: PockitData,
  after: PockitData,
  month: MonthKey = currentMonth(),
) {
  const totals = (data: PockitData, kind: GoalKind) =>
    Math.round(
      data.goals.filter((goal) => goal.kind === kind).reduce((sum, goal) => sum + goal.monthly, 0) *
        100,
    ) / 100
  const changed = (['saving', 'debt'] as GoalKind[]).filter(
    (kind) => totals(before, kind) !== totals(after, kind),
  )
  if (!changed.length) return after
  return {
    ...after,
    categories: after.categories.map((category) => {
      const kind = category.linkedGoalKind
      if (!kind || !changed.includes(kind)) return category
      const amount = totals(after, kind)
      if (categoryPeriodAmount(category, month) === amount) return category
      return month > category.starts
        ? {
            ...category,
            changes: { ...category.changes, [month]: amount },
            targetValue: amount,
            needsAmount: amount === 0,
            suggested: false,
          }
        : {
            ...category,
            baseAmount: amount,
            targetValue: amount,
            needsAmount: amount === 0,
            suggested: false,
          }
    }),
  }
}
