import type { Category, MonthKey } from '../types'
import { categoryBudget } from './finance'

export interface BudgetChartSlice {
  category: Category
  amount: number
  percent: number
  startPercent: number
}

/** Shares are of the amount assigned to categories, not of the user's income. */
export function budgetChart(categories: Category[], month: MonthKey, income: number) {
  const amounts = categories
    .map((category) => ({ category, amount: categoryBudget(category, month, income) }))
    .filter(({ amount }) => Number.isFinite(amount) && amount > 0)
  const total = amounts.reduce((sum, item) => sum + item.amount, 0)
  let startPercent = 0
  const slices: BudgetChartSlice[] = amounts.map(({ category, amount }) => {
    const percent = (amount / total) * 100
    const slice = { category, amount, percent, startPercent }
    startPercent += percent
    return slice
  })
  return { total, slices }
}

export const budgetShareLabel = (percent: number) =>
  percent > 0 && percent < 0.1 ? '<0.1%' : `${percent.toFixed(1)}%`
