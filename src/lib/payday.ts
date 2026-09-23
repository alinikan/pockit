import type { Bill, PockitData } from '../types'
import { billsForMonth, monthKey } from './finance'
import { validISODate } from './numbers'

const iso = (date: Date) => date.toISOString().slice(0, 10)
const utcDate = (value: string) => new Date(`${value}T12:00:00Z`)
const dayInMonth = (year: number, month: number, day: number) =>
  new Date(
    Date.UTC(year, month, Math.min(day, new Date(Date.UTC(year, month + 1, 0)).getUTCDate()), 12),
  )

export function nextPayday(data: PockitData, today: string): string | null {
  if (!validISODate(today)) return null
  const profile = data.profile
  const now = utcDate(today)
  if (profile.payFrequency === 'twice-monthly') {
    const days = profile.paydayDays || [1, 15]
    const valid = [...new Set(days.filter((day) => Number.isInteger(day) && day >= 1 && day <= 31))]
    if (!valid.length) return null
    const candidates: string[] = []
    for (let offset = 0; offset <= 2; offset++) {
      const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1, 12))
      for (const day of valid)
        candidates.push(iso(dayInMonth(month.getUTCFullYear(), month.getUTCMonth(), day)))
    }
    return candidates.filter((date) => date > today).sort()[0] || null
  }
  if (!validISODate(profile.paydayAnchor || '')) return null
  const anchor = utcDate(profile.paydayAnchor!)
  if (profile.payFrequency === 'monthly') {
    for (let offset = 0; offset <= 12; offset++) {
      const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1, 12))
      const date = iso(dayInMonth(month.getUTCFullYear(), month.getUTCMonth(), anchor.getUTCDate()))
      if (date > today) return date
    }
    return null
  }
  const interval = profile.payFrequency === 'weekly' ? 7 : 14
  const elapsed = Math.floor((now.valueOf() - anchor.valueOf()) / 86400000)
  const steps = Math.max(0, Math.floor(elapsed / interval) + 1)
  anchor.setUTCDate(anchor.getUTCDate() + steps * interval)
  return iso(anchor)
}

export interface PaychequeForecast {
  payday: string | null
  days: number | null
  estimatedCash: number | null
  bills: { bill: Bill; date: string }[]
  afterBills: number | null
  perDay: number | null
}

export function paychequeForecast(data: PockitData, today: string): PaychequeForecast {
  const payday = nextPayday(data, today)
  const days = payday
    ? Math.round((utcDate(payday).valueOf() - utcDate(today).valueOf()) / 86400000)
    : null
  const { cashAsOf, cashOnHand, cashUpdatedAt } = data.profile
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
  const estimatedCash = hasBaseline
    ? cashOnHand! +
      since.reduce(
        (sum, transaction) =>
          sum +
          (transaction.type === 'income'
            ? transaction.amount
            : transaction.type === 'expense'
              ? -transaction.amount
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
          entry.date > today &&
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
  }
}
