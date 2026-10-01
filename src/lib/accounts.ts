import type { Account, MonthKey, PockitData, Transaction } from '../types'

export function accountTypeLabel(account: Account) {
  if (account.kind === 'investment' && /\btfsa\b/i.test(account.subtype || '')) return 'TFSA'
  return {
    chequing: 'Chequing',
    savings: 'Savings',
    credit: 'Credit card',
    investment: 'Investment',
    cash: 'Cash',
  }[account.kind]
}

/** Moving money between investment accounts is neither a new contribution nor a withdrawal. */
export function investmentTransferDirection(data: PockitData, transaction: Transaction) {
  if (transaction.type !== 'transfer' || transaction.accountId === transaction.toAccountId) return 0
  const from = data.accounts?.find((account) => account.id === transaction.accountId)
  const to = data.accounts?.find((account) => account.id === transaction.toAccountId)
  return Number(to?.kind === 'investment') - Number(from?.kind === 'investment')
}
export function isInvestmentTransfer(data: PockitData, transaction: Transaction) {
  return (
    transaction.type === 'transfer' &&
    !!data.accounts?.some(
      (account) =>
        account.kind === 'investment' &&
        (account.id === transaction.accountId || account.id === transaction.toAccountId),
    )
  )
}

export function investmentContributionsByCategory(data: PockitData, month: MonthKey) {
  const totals: Record<string, number> = {}
  for (const transaction of data.transactions) {
    if (
      !transaction.categoryId ||
      transaction.excludedFromBudget ||
      !transaction.date.startsWith(`${month}-`)
    )
      continue
    const amount = investmentTransferDirection(data, transaction) * transaction.amount
    if (amount) totals[transaction.categoryId] = (totals[transaction.categoryId] || 0) + amount
  }
  return totals
}

/** Only suggest a category; the user can still change or clear it in Activity. */
export function investmentTransferCategory(data: PockitData, fromId?: string, toId?: string) {
  const account =
    data.accounts?.find((item) => item.id === toId && item.kind === 'investment') ||
    data.accounts?.find((item) => item.id === fromId && item.kind === 'investment')
  if (!account) return undefined
  if (account.contributionCategoryId === '') return undefined
  const linked = data.categories.find(
    (category) => category.id === account.contributionCategoryId && !category.archived,
  )
  return (
    linked?.id ||
    data.categories.find(
      (category) => !category.archived && /invest|tfsa|rrsp/i.test(category.name),
    )?.id
  )
}
