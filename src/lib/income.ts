import type { IncomeCategory, PockitData, Transaction } from '../types'
import { todayISO } from './finance'

export const incomeCategories: { value: IncomeCategory; label: string }[] = [
  { value: 'paycheque', label: 'Paycheque' },
  { value: 'self-employment', label: 'Freelance & business' },
  { value: 'benefits', label: 'Government benefits' },
  { value: 'pension', label: 'Pension' },
  { value: 'investment', label: 'Interest & investment income' },
  { value: 'gift', label: 'Gift received' },
  { value: 'other', label: 'Other income' },
]

export const incomeCategoryLabel = (category?: IncomeCategory) =>
  incomeCategories.find((item) => item.value === category)?.label || 'Other income'

/** A new deposit needs a decision; existing records retain their original handling. */
export function needsIncomeBalanceChoice(data: PockitData, entry: Transaction) {
  if (entry.type !== 'income' || !entry.accountId || entry.balancePosting) return false
  const before = data.transactions.find((item) => item.id === entry.id)
  return before?.type !== 'income' || before.accountId !== entry.accountId
}

/** Keep the income's reporting date separate from an explicitly requested balance update. */
export function prepareIncomeEntry(
  entry: Transaction,
  before: Transaction | null,
  date = todayISO(),
  time = new Date().toISOString(),
): Transaction {
  if (entry.type !== 'income')
    return { ...entry, incomeCategory: undefined, balancePosting: undefined }
  const samePosting =
    before?.type === 'income' &&
    before.accountId === entry.accountId &&
    before.balancePosting?.mode === entry.balancePosting?.mode
  return {
    ...entry,
    categoryId: undefined,
    splits: undefined,
    toAccountId: undefined,
    incomeCategory: entry.incomeCategory || 'other',
    balancePosting: !entry.accountId
      ? undefined
      : entry.balancePosting
        ? samePosting
          ? before!.balancePosting
          : { mode: entry.balancePosting.mode, date, time }
        : undefined,
  }
}
