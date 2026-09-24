import type { PockitData } from '../types'
import { validISODate } from './numbers'

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const validMonth = (value: unknown) =>
  typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
const nonnegative = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
const uniqueIds = (items: unknown[]) => {
  const ids = items.map((item) => (record(item) ? item.id : undefined))
  return ids.every((id) => typeof id === 'string' && id.trim()) && new Set(ids).size === ids.length
}

export function parseBackup(text: string): PockitData {
  if (text.length > 5_000_000) throw new Error('Choose a backup smaller than 5 MB.')
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('This is not a valid JSON backup.')
  }
  if (!record(value)) throw new Error('This is not a Pockit backup.')
  const data = value as Partial<PockitData>
  if (
    data.version !== 1 ||
    !data.profile ||
    !data.settings ||
    !Array.isArray(data.categories) ||
    !Array.isArray(data.transactions) ||
    !Array.isArray(data.goals) ||
    !Array.isArray(data.bills)
  )
    throw new Error('This backup has an unsupported or incomplete format.')
  if (!record(data.profile) || !record(data.settings))
    throw new Error('This backup has an invalid profile or settings.')
  if (data.settings.currency !== 'CAD')
    throw new Error(
      'This backup is not marked as CAD. Pockit cannot safely convert another currency.',
    )
  if (
    !['dark', 'light'].includes(String(data.settings.theme)) ||
    typeof data.settings.smart !== 'boolean' ||
    !nonnegative(data.profile.payAmount) ||
    (data.profile.plannedMonthlyIncome !== undefined &&
      !nonnegative(data.profile.plannedMonthlyIncome)) ||
    !['weekly', 'biweekly', 'twice-monthly', 'monthly'].includes(
      String(data.profile.payFrequency),
    ) ||
    !Array.isArray(data.profile.extras) ||
    data.profile.extras.some((item) => typeof item !== 'string')
  )
    throw new Error('This backup has an invalid profile or settings.')
  if (
    !uniqueIds(data.transactions) ||
    data.transactions.some(
      (transaction) =>
        !record(transaction) ||
        !validISODate(String(transaction.date)) ||
        !nonnegative(transaction.amount) ||
        transaction.amount === 0 ||
        !['income', 'expense', 'transfer'].includes(String(transaction.type)) ||
        (transaction.splits !== undefined &&
          (transaction.type !== 'expense' ||
            !Array.isArray(transaction.splits) ||
            transaction.splits.some(
              (split) =>
                !record(split) ||
                typeof split.categoryId !== 'string' ||
                !nonnegative(split.amount),
            ) ||
            Math.abs(
              transaction.splits.reduce(
                (sum, split) =>
                  sum + (record(split) && typeof split.amount === 'number' ? split.amount : 0),
                0,
              ) - Number(transaction.amount),
            ) > 0.001)),
    )
  )
    throw new Error('This backup contains an invalid transaction.')
  if (
    !uniqueIds(data.categories) ||
    data.categories.some(
      (category) =>
        !record(category) ||
        typeof category.name !== 'string' ||
        !nonnegative(category.baseAmount) ||
        !validMonth(category.starts) ||
        !['fresh', 'rollover'].includes(String(category.mode)) ||
        !['weekly', 'biweekly', 'twice-monthly', 'monthly'].includes(String(category.frequency)) ||
        !record(category.changes) ||
        !record(category.overrides),
    )
  )
    throw new Error('This backup contains an invalid category.')
  if (
    !uniqueIds(data.goals) ||
    data.goals.some(
      (goal) =>
        !record(goal) ||
        typeof goal.name !== 'string' ||
        !['saving', 'debt'].includes(String(goal.kind)) ||
        !nonnegative(goal.balance) ||
        !nonnegative(goal.target) ||
        !nonnegative(goal.monthly) ||
        !nonnegative(goal.annualInterest) ||
        !Array.isArray(goal.history),
    )
  )
    throw new Error('This backup contains an invalid goal.')
  if (
    !uniqueIds(data.bills) ||
    data.bills.some(
      (bill) =>
        !record(bill) ||
        typeof bill.name !== 'string' ||
        !nonnegative(bill.amount) ||
        !Number.isInteger(bill.day) ||
        Number(bill.day) < 1 ||
        Number(bill.day) > 31 ||
        !Array.isArray(bill.paidMonths) ||
        bill.paidMonths.some((month) => !validMonth(month)) ||
        (bill.starts !== undefined && !validMonth(bill.starts)) ||
        (bill.frequency !== undefined &&
          !['monthly', 'quarterly', 'yearly'].includes(String(bill.frequency))),
    )
  )
    throw new Error('This backup contains an invalid bill.')
  if (
    data.accounts &&
    (!Array.isArray(data.accounts) ||
      !uniqueIds(data.accounts) ||
      data.accounts.some(
        (account) =>
          !record(account) ||
          typeof account.name !== 'string' ||
          !validISODate(String(account.asOf)) ||
          !Number.isFinite(account.openingBalance) ||
          !['chequing', 'savings', 'credit', 'investment', 'cash'].includes(String(account.kind)),
      ))
  )
    throw new Error('This backup contains an invalid account.')
  return data as PockitData
}
