import type { MonthKey, PockitData, Transaction } from '../types'
import {
  categoryActiveInMonth,
  categoryBudget,
  categoryPolicy,
  categoryPlanUsage,
  currentMonth,
  monthSummary,
  monthlyPay,
  rolloverBalance,
  shiftMonth,
  spendingByCategory,
  todayISO,
} from './finance'
import { validISODate } from './numbers'

export const cents = (value: number) => Math.round(value * 100) / 100
export const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}
export const ageInDays = (date: string, now = todayISO()) =>
  validISODate(date)
    ? Math.floor((Date.parse(`${now}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`)) / 86400000)
    : null
export function parseQuickEntry(
  text: string,
  data: PockitData,
  now = todayISO(),
): Partial<Transaction> {
  if (!validISODate(now)) throw new Error('Choose a valid date first.')
  const cleaned = text.trim()
  const match = cleaned.match(
    /^(.*?)\s+\$?(\d+(?:\.\d{1,2})?)(?:\s+(today|yesterday|\d{4}-\d{2}-\d{2}))?$/i,
  )
  if (!match || !match[1].trim() || Number(match[2]) <= 0 || Number(match[2]) > 1000000)
    throw new Error(
      'Try “Coffee 6.50 yesterday” or “Groceries 42.10”. Include one amount, with up to two decimal places.',
    )
  const date =
    !match[3] || /today/i.test(match[3])
      ? now
      : /yesterday/i.test(match[3])
        ? addDays(now, -1)
        : match[3]
  if (!validISODate(date) || date > now) throw new Error('Use today or an earlier valid date.')
  const payee = match[1].trim()
  if (
    /(?:^|\s)\$?\d+(?:\.\d{1,2})?\s*$/.test(payee) &&
    !data.transactions.some((item) => item.payee.toLowerCase() === payee.toLowerCase()) &&
    !data.settings.entryTemplates?.some((item) => item.payee.toLowerCase() === payee.toLowerCase())
  )
    throw new Error(
      'This looks like more than one amount. Use the full transaction form to keep the values unambiguous.',
    )
  const rule = data.settings.merchantRules?.find((item) => item.payee === payee.toLowerCase())
  const recent = data.transactions
    .filter((item) => item.type === 'expense' && item.payee.toLowerCase() === payee.toLowerCase())
    .sort((a, b) => b.date.localeCompare(a.date))[0]
  const categoryId = rule?.categoryId || recent?.categoryId
  return {
    payee,
    amount: Number(match[2]),
    date,
    type: 'expense',
    accountId: data.accounts?.find((item) => item.id === recent?.accountId && !item.archived)?.id,
    categoryId: data.categories.some((item) => item.id === categoryId && !item.archived)
      ? categoryId
      : undefined,
  }
}
export function categoryAvailable(data: PockitData, categoryId: string, month: MonthKey) {
  const category = data.categories.find((item) => item.id === categoryId && !item.archived)
  if (!category) return null
  return categoryPolicy(category, month).mode === 'rollover'
    ? rolloverBalance(category, data, month)
    : cents(
        categoryBudget(category, month, monthSummary(data, month).income) -
          (categoryPlanUsage(data, month)[categoryId] || 0),
      )
}
export function monthCoverage(data: PockitData, month: MonthKey) {
  const entries = data.transactions.filter((item) => item.date.startsWith(month))
  const confirmed = data.settings.completeMonths?.includes(month) || false
  return {
    count: entries.length,
    confirmed,
    label: confirmed
      ? 'You marked this month complete'
      : entries.length
        ? 'Entries recorded · completeness not confirmed'
        : 'No entries recorded',
    canCompare: confirmed || entries.some((item) => item.type === 'expense'),
  }
}
export function spendingSuggestions(data: PockitData, month = currentMonth()) {
  const complete = [...new Set(data.settings.completeMonths || [])]
    .filter((key) => key < month)
    .sort()
    .slice(-6)
  if (complete.length < 3) return []
  return data.categories
    .filter(
      (category) =>
        !category.archived &&
        categoryActiveInMonth(category, month) &&
        categoryPolicy(category, month).mode === 'fresh' &&
        !category.linkedGoalKind,
    )
    .map((category) => {
      const values = complete
        .map((key) =>
          Math.max(
            0,
            spendingByCategory(
              data.transactions.filter((item) => !item.projectId),
              key,
            )[category.id] || 0,
          ),
        )
        .sort((a, b) => a - b)
      const median =
        values.length % 2
          ? values[Math.floor(values.length / 2)]
          : (values[values.length / 2 - 1] + values[values.length / 2]) / 2
      return {
        category,
        months: complete.length,
        median: cents(median),
        suggested: Math.ceil(median / 5) * 5,
        current: categoryBudget(category, month, monthSummary(data, month).income),
      }
    })
    .filter((item) => item.suggested > 0 && Math.abs(item.suggested - item.current) >= 10)
}
export function applySpendingSuggestion(
  data: PockitData,
  categoryId: string,
  amount: number,
  month: MonthKey,
) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Choose a positive amount.')
  const category = data.categories.find((item) => item.id === categoryId && !item.archived)
  if (!category || categoryPolicy(category, month).mode !== 'fresh' || category.linkedGoalKind)
    throw new Error('Edit this category directly in Budget.')
  const policy = categoryPolicy({ ...category, policyOverrides: {} }, month)
  return {
    ...data,
    categories: data.categories.map((item) =>
      item.id === categoryId
        ? {
            ...item,
            suggested: false,
            changes: { ...item.changes, [month]: amount / monthlyPay(1, policy.frequency) },
            overrides: { ...item.overrides, [month]: amount },
          }
        : item,
    ),
  }
}
export function projectTotals(data: PockitData, id: string) {
  const project = data.projects?.find((item) => item.id === id)
  if (!project) return null
  const entries = data.transactions.filter((item) => item.projectId === id)
  const spent = cents(
    entries.reduce(
      (sum, item) => sum + (item.type === 'expense' ? item.amount * (item.refund ? -1 : 1) : 0),
      0,
    ),
  )
  const upcoming = cents(
    project.costs.filter((item) => !item.paid).reduce((sum, item) => sum + item.amount, 0),
  )
  return {
    project,
    entries,
    spent,
    upcoming,
    remaining: cents(project.budget - spent),
    afterUpcoming: cents(project.budget - spent - upcoming),
    goal: data.goals.find((item) => item.id === project.goalId),
  }
}
export function changedCategoryMonths(before: Transaction | null, after: Transaction | null) {
  return [
    ...new Set([before?.date.slice(0, 7), after?.date.slice(0, 7)].filter(Boolean)),
  ] as MonthKey[]
}
export const previousCompleteMonths = (month: MonthKey, count = 3) =>
  Array.from({ length: count }, (_, i) => shiftMonth(month, -i - 1))
