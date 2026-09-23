import type { Account, PockitData, Transaction } from '../types'
import { validISODate } from './numbers'

export function accountImpact(transaction: Transaction, accountId: string): number {
  if (transaction.type === 'transfer') {
    return (
      (transaction.toAccountId === accountId ? transaction.amount : 0) -
      (transaction.accountId === accountId ? transaction.amount : 0)
    )
  }
  if (transaction.accountId !== accountId) return 0
  if (transaction.type === 'income' || transaction.refund) return transaction.amount
  return -transaction.amount
}

export function accountBalance(account: Account, transactions: Transaction[], through?: string) {
  return (
    Math.round(
      (account.openingBalance +
        transactions
          .filter(
            (transaction) =>
              (transaction.date > account.asOf ||
                (transaction.date === account.asOf &&
                  !!account.asOfTime &&
                  !!transaction.createdAt &&
                  transaction.createdAt > account.asOfTime)) &&
              (!through || transaction.date <= through),
          )
          .reduce((sum, transaction) => sum + accountImpact(transaction, account.id), 0)) *
        100,
    ) / 100
  )
}

export function reconcileAccount(
  data: PockitData,
  accountId: string,
  balance: number,
  date: string,
  time: string,
): PockitData {
  if (!Number.isFinite(balance) || !validISODate(date) || !Number.isFinite(Date.parse(time)))
    throw new Error('Enter a valid balance and date.')
  const account = data.accounts?.find((item) => item.id === accountId)
  if (!account) throw new Error('Choose an account to reconcile.')
  const before = accountBalance(account, data.transactions, date)
  return {
    ...data,
    accounts: data.accounts?.map((item) =>
      item.id === accountId
        ? {
            ...item,
            openingBalance: balance,
            asOf: date,
            asOfTime: time,
            reconciledAt: time,
            reconciliations: [
              ...(item.reconciliations || []),
              { date, balance, adjustment: Math.round((balance - before) * 100) / 100 },
            ],
          }
        : item,
    ),
  }
}

export const unreviewedTransactions = (data: PockitData) =>
  data.transactions.filter((transaction) => transaction.reviewed === false)
