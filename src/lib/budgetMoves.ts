import type { MonthKey, PockitData } from '../types'
import {
  categoryBudget,
  categoryPolicy,
  monthSummary,
  rolloverBalance,
  spendingByCategory,
} from './finance'

export function coverOverspend(
  data: PockitData,
  month: MonthKey,
  targetId: string,
  sourceId: string,
  amount: number,
) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter a positive amount to move.')
  const rounded = Math.round(amount * 100) / 100
  const target = data.categories.find((category) => category.id === targetId && !category.archived)
  if (!target || sourceId === targetId) throw new Error('Choose a valid category.')
  const summary = monthSummary(data, month)
  const spending = spendingByCategory(data.transactions, month)
  const targetAvailable =
    categoryPolicy(target, month).mode === 'rollover'
      ? rolloverBalance(target, data, month)
      : categoryBudget(target, month, summary.income) - (spending[targetId] || 0)
  if (rounded > -targetAvailable + 0.001)
    throw new Error('Move no more than the amount needed to cover the overage.')
  let source = null
  if (sourceId === 'unallocated') {
    if (summary.unallocated + 0.001 < rounded)
      throw new Error('There is not enough unallocated money.')
  } else {
    source = data.categories.find((category) => category.id === sourceId && !category.archived)
    if (!source) throw new Error('Choose a valid source category.')
    const available =
      categoryPolicy(source, month).mode === 'rollover'
        ? rolloverBalance(source, data, month)
        : categoryBudget(source, month, summary.income) - (spending[sourceId] || 0)
    if (available + 0.001 < rounded)
      throw new Error('That category does not have enough available.')
  }
  return {
    ...data,
    categories: data.categories.map((category) => {
      if (category.id === targetId)
        return {
          ...category,
          overrides: {
            ...category.overrides,
            [month]:
              Math.round((categoryBudget(category, month, summary.income) + rounded) * 100) / 100,
          },
        }
      if (category.id === sourceId)
        return {
          ...category,
          overrides: {
            ...category.overrides,
            [month]:
              Math.round((categoryBudget(category, month, summary.income) - rounded) * 100) / 100,
          },
        }
      return category
    }),
  }
}
