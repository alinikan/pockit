import type { Bill, PockitData } from '../types'
import { billsForMonth, monthKey } from './finance'
import { accountBalance } from './ledger'
import { validISODate } from './numbers'
import { paydaysInMonth } from './paySchedule'

const utcDate = (value: string) => new Date(`${value}T12:00:00Z`)

export function nextPayday(data: PockitData, today: string): string | null {
  if (!validISODate(today)) return null
  const profile = data.profile
  if (profile.payFrequency !== 'twice-monthly' && !validISODate(profile.paydayAnchor || ''))
    return null
  const now = utcDate(today)
  for (let offset = 0; offset <= 2; offset++) {
    const candidateMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1, 12),
    )
    const dates = paydaysInMonth(
      profile,
      `${candidateMonth.getUTCFullYear()}-${String(candidateMonth.getUTCMonth() + 1).padStart(2, '0')}` as `${number}-${number}`,
    )
    const next = dates.find((date) => date > today)
    if (next) return next
  }
  return null
}

export interface PaychequeForecast {
  payday: string | null
  days: number | null
  estimatedCash: number | null
  bills: { bill: Bill; date: string }[]
  afterBills: number | null
  perDay: number | null
  source: string | null
  asOf: string | null
}

export function paychequeForecast(data: PockitData, today: string): PaychequeForecast {
  const payday = nextPayday(data, today)
  const days = payday
    ? Math.round((utcDate(payday).valueOf() - utcDate(today).valueOf()) / 86400000)
    : null
  const { cashAsOf, cashOnHand, cashUpdatedAt } = data.profile
  const primaryAccount =
    data.accounts?.find((account) => !account.archived && account.kind === 'chequing') ||
    data.accounts?.find((account) => !account.archived && account.kind === 'cash')
  const hasBaseline =
    validISODate(cashAsOf || '') &&
    cashAsOf! <= today &&
    Number.isFinite(cashOnHand) &&
    cashOnHand! >= 0
  const since = hasBaseline
    ? data.transactions.filter(
        (transaction) =>
          (transaction.date > cashAsOf! ||
            (transaction.date === cashAsOf &&
              !!cashUpdatedAt &&
              !!transaction.createdAt &&
              transaction.createdAt > cashUpdatedAt)) &&
          transaction.date <= today,
      )
    : []
  const estimatedCash =
    primaryAccount && primaryAccount.asOf <= today
      ? accountBalance(primaryAccount, data.transactions, today)
      : hasBaseline
        ? cashOnHand! +
          since.reduce(
            (sum, transaction) =>
              sum +
              (transaction.type === 'income'
                ? transaction.amount
                : transaction.type === 'expense'
                  ? transaction.refund
                    ? transaction.amount
                    : -transaction.amount
                  : 0),
            0,
          )
        : null
  const bills: PaychequeForecast['bills'] = []
  if (payday) {
    const start = utcDate(today)
    const end = utcDate(payday)
    for (
      let month = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1, 12));
      month <= end;
      month = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1, 12))
    ) {
      for (const entry of billsForMonth(data.bills, monthKey(month)))
        if (
          !entry.paid &&
          !entry.skipped &&
          entry.date >= today &&
          entry.date < payday &&
          !data.transactions.some(
            (transaction) =>
              transaction.billId === entry.id &&
              transaction.date.slice(0, 7) === entry.date.slice(0, 7),
          )
        )
          bills.push({ bill: data.bills.find((bill) => bill.id === entry.id)!, date: entry.date })
    }
  }
  const afterBills =
    estimatedCash === null || !payday
      ? null
      : estimatedCash - bills.reduce((sum, entry) => sum + entry.bill.amount, 0)
  return {
    payday,
    days,
    estimatedCash,
    bills,
    afterBills,
    perDay:
      afterBills === null || days === null ? null : Math.max(0, afterBills) / Math.max(days, 1),
    source:
      primaryAccount && primaryAccount.asOf <= today
        ? primaryAccount.name
        : hasBaseline
          ? 'Manual starting amount'
          : null,
    asOf:
      primaryAccount && primaryAccount.asOf <= today
        ? primaryAccount.asOf
        : hasBaseline
          ? cashAsOf!
          : null,
  }
}
