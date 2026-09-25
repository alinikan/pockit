import type { MonthKey, PockitData } from '../types'
import { categoryActiveInMonth, categoryBudget, monthSummary } from './finance'

/** A transparent starting point based on the essentials the user has planned. */
export function emergencyMilestones(data: PockitData, month: MonthKey) {
  const income = monthSummary(data, month).income
  const essential = data.categories
    .filter(
      (category) =>
        categoryActiveInMonth(category, month) &&
        (['Bills & Utilities', 'Transportation'].includes(category.group) ||
          /grocer|healthcare|medical|childcare/i.test(category.name)),
    )
    .reduce((sum, category) => sum + categoryBudget(category, month, income), 0)
  const goal = data.goals.find(
    (item) => item.kind === 'saving' && /emergency|rainy day/i.test(item.name),
  )
  return {
    essential,
    saved: goal?.balance || 0,
    goalId: goal?.id || null,
    steps: [
      { label: 'One paycheque', amount: data.profile.payAmount },
      { label: 'One month of essentials', amount: essential },
      { label: 'Three months of essentials', amount: essential * 3 },
    ].filter((step) => step.amount > 0),
  }
}
