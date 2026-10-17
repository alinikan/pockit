import type { MonthKey, PockitData, Subscription, Transaction } from '../types'
import {
  billsForMonth,
  categoryActiveInMonth,
  categoryBudget,
  categoryPlanUsage,
  monthSummary,
  todayISO,
} from './finance'
import { paydaysInMonth } from './paySchedule'
import { expectedTransactions } from './recurringTransactions'
import { accountBalance, accountImpact } from './ledger'
import { accountReservations } from './goalFunding'
import { addDays, ageInDays, categoryAvailable, cents } from './experience'
import { validISODate } from './numbers'
export interface ForecastEvent {
  id: string
  date: string
  name: string
  amount: number
  type: 'scheduled' | 'entered' | 'estimate'
  accountId?: string
  toAccountId?: string
  transactionType: Transaction['type']
  refund?: boolean
}
export function subscriptionDates(subscription: Subscription, from: string, to: string) {
  if (!validISODate(subscription.renewalDate)) return []
  const [year, month, day] = subscription.renewalDate.split('-').map(Number)
  const result: string[] = []
  const interval = subscription.period === 'yearly' ? 12 : 1
  for (let index = 0; index < 2400; index++) {
    const date = new Date(Date.UTC(year, month - 1 + index * interval, 1, 12))
    date.setUTCDate(
      Math.min(
        day,
        new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate(),
      ),
    )
    const iso = date.toISOString().slice(0, 10)
    if (iso > to) break
    if (iso >= from) result.push(iso)
  }
  return result
}
export const annualSubscriptionCost = (subscription: Subscription) =>
  cents(subscription.amount * (subscription.period === 'monthly' ? 12 : 1))
export function cashForecast(
  data: PockitData,
  {
    start = todayISO(),
    days = 60,
    expectedPay = true,
    everyday = false,
    spendingAccountId,
    changes = {},
  }: {
    start?: string
    days?: number
    expectedPay?: boolean
    everyday?: boolean
    spendingAccountId?: string
    changes?: Record<string, { date: string; amount: number }>
  } = {},
) {
  if (!validISODate(start) || !Number.isInteger(days) || days < 1 || days > 366)
    throw new Error('Choose a valid start date and 1–366 days.')
  const end = addDays(start, days)
  const accounts = (data.accounts || []).filter((item) => !item.archived && item.asOf <= start)
  const primary =
    accounts.find((item) => item.id === spendingAccountId) ||
    accounts.find((item) => item.kind === 'chequing') ||
    accounts.find((item) => item.kind === 'cash')
  const events: ForecastEvent[] = []
  const notes: string[] = []
  const add = (event: ForecastEvent) => {
    const patch = changes[event.id]
    if (
      patch &&
      (!validISODate(patch.date) ||
        patch.date <= start ||
        !Number.isFinite(patch.amount) ||
        patch.amount < 0)
    )
      throw new Error('Use a future date and a valid positive amount for the preview.')
    const value = patch ? { ...event, ...patch } : event
    if (value.date >= start && value.date <= end) events.push(value)
  }
  for (const transaction of data.transactions.filter(
    (item) => item.date > start && item.date <= end,
  ))
    add({
      id: `transaction:${transaction.id}`,
      date: transaction.date,
      name: transaction.payee,
      amount: transaction.amount,
      type: 'entered',
      accountId: transaction.accountId,
      toAccountId: transaction.toAccountId,
      transactionType: transaction.type,
      refund: transaction.refund,
    })
  let month = start.slice(0, 7) as MonthKey
  while (month <= end.slice(0, 7)) {
    for (const entry of billsForMonth(data.bills, month)) {
      const bill = data.bills.find((item) => item.id === entry.id)!
      if (
        entry.paid ||
        entry.skipped ||
        data.transactions.some((item) => item.billId === bill.id && item.date.startsWith(month))
      )
        continue
      add({
        id: `bill:${bill.id}:${entry.date}`,
        date: entry.date,
        name: bill.name,
        amount: bill.amount,
        type: 'scheduled',
        accountId: bill.accountId,
        toAccountId: bill.toAccountId,
        transactionType: bill.paymentType || 'expense',
      })
    }
    for (const { source, date } of expectedTransactions(data, month)) {
      if (source.billId) continue
      add({
        id: `repeat:${source.id}:${date}`,
        date,
        name: source.payee,
        amount: source.amount,
        type: 'scheduled',
        accountId: source.accountId,
        toAccountId: source.toAccountId,
        transactionType: source.type,
        refund: source.refund,
      })
    }
    if (expectedPay && primary)
      for (const date of paydaysInMonth(data.profile, month))
        add({
          id: `pay:${date}`,
          date,
          name: 'Expected paycheque',
          amount: data.profile.payAmount,
          type: 'scheduled',
          accountId: primary.id,
          transactionType: 'income',
        })
    if (everyday && primary) {
      const summary = monthSummary(data, month),
        usage = categoryPlanUsage(data, month)
      const flexible = data.categories.filter(
        (category) =>
          categoryActiveInMonth(category, month) &&
          !category.archived &&
          category.group !== 'Savings & Goals' &&
          !data.bills.some((bill) => bill.categoryId === category.id) &&
          !data.subscriptions?.some(
            (item) =>
              item.billId &&
              data.bills.find((bill) => bill.id === item.billId)?.categoryId === category.id,
          ),
      )
      const remaining = flexible.reduce(
        (sum, category) =>
          sum +
          Math.max(0, categoryBudget(category, month, summary.income) - (usage[category.id] || 0)),
        0,
      )
      const first = month === start.slice(0, 7) ? addDays(start, 1) : `${month}-01`
      const [year, num] = month.split('-').map(Number),
        last = new Date(Date.UTC(year, num, 0)).toISOString().slice(0, 10)
      const count = Math.max(
        1,
        (Date.parse(`${last}T12:00Z`) - Date.parse(`${first}T12:00Z`)) / 86400000 + 1,
      )
      for (let date = first; date <= last && date <= end; date = addDays(date, 1))
        add({
          id: `everyday:${date}`,
          date,
          name: 'Optional everyday spending estimate',
          amount: cents(remaining / count),
          type: 'estimate',
          accountId: primary.id,
          transactionType: 'expense',
        })
    }
    const [y, n] = month.split('-').map(Number)
    month = new Date(Date.UTC(y, n, 1, 12)).toISOString().slice(0, 7) as MonthKey
  }
  for (const item of data.subscriptions || []) {
    if (item.billId && data.bills.some((bill) => bill.id === item.billId)) continue
    for (const date of subscriptionDates(item, addDays(start, 1), end))
      add({
        id: `subscription:${item.id}:${date}`,
        date,
        name: item.name,
        amount: item.amount,
        type: 'scheduled',
        accountId: item.accountId,
        transactionType: 'expense',
      })
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  const accountIds = new Set(accounts.map((item) => item.id))
  if (
    events.some(
      (item) =>
        !item.accountId ||
        !accountIds.has(item.accountId) ||
        (item.toAccountId && !accountIds.has(item.toAccountId)),
    )
  )
    notes.push(
      'Some scheduled items refer to a missing or unavailable account. Assign a current account before relying on its forecast.',
    )
  if (
    expectedPay &&
    (events.some((item) => item.transactionType === 'income' && !item.id.startsWith('pay:')) ||
      data.transactions.some((item) => item.date === start && item.type === 'income'))
  )
    notes.push(
      'Expected pay and other recorded or scheduled income are both included. Turn expected pay off if they describe the same income.',
    )
  if (
    accounts.some(
      (item) => (ageInDays(item.reconciledAt?.slice(0, 10) || item.asOf, start) || 0) > 7,
    )
  )
    notes.push('An account balance was last checked more than seven days ago.')
  if (data.transactions.some((item) => item.reviewed === false))
    notes.push('Some imported entries still need your review.')
  const points = Array.from({ length: days + 1 }, (_, index) => {
    const date = addDays(start, index)
    const balances = Object.fromEntries(
      accounts.map((account) => [
        account.id,
        cents(
          accountBalance(account, data.transactions, start) +
            events
              .filter((item) => item.date <= date)
              .reduce(
                (sum, item) =>
                  sum +
                  accountImpact(
                    {
                      id: item.id,
                      date: item.date,
                      payee: item.name,
                      type: item.transactionType,
                      amount: item.amount,
                      accountId: item.accountId,
                      toAccountId: item.toAccountId,
                      refund: item.refund,
                    },
                    account.id,
                  ),
                0,
              ),
        ),
      ]),
    )
    return { date, balances, events: events.filter((item) => item.date === date) }
  })
  return { accounts, events, points, notes, primaryId: primary?.id, start, end }
}
export function checkAffordability(
  data: PockitData,
  {
    amount,
    categoryId,
    accountId,
    date = todayISO(),
    days = 30,
    expectedPay = true,
    everyday = false,
  }: {
    amount: number
    categoryId: string
    accountId: string
    date?: string
    days?: number
    expectedPay?: boolean
    everyday?: boolean
  },
) {
  if (
    !Number.isFinite(amount) ||
    amount < 0.01 ||
    Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001 ||
    amount > 1000000 ||
    !validISODate(date) ||
    date < todayISO()
  )
    throw new Error('Enter an amount from $0.01 to $1,000,000 and today or a future date.')
  const forecast = cashForecast(data, { days, expectedPay, everyday })
  const account = forecast.accounts.find((item) => item.id === accountId && item.kind !== 'credit')
  if (!account) throw new Error('Choose a current asset account with a checked balance.')
  if (date > forecast.end) throw new Error('Choose a date inside the preview period.')
  const available = categoryAvailable(data, categoryId, date.slice(0, 7) as MonthKey)
  if (available === null) throw new Error('Choose a budget category.')
  const before = forecast.points.filter((point) => point.date >= date)
  const lowest = Math.min(...before.map((point) => point.balances[accountId]))
  const reserved = accountReservations(data, accountId)
  const after = cents(lowest - amount - reserved)
  return {
    available,
    categoryAfter: cents(available - amount),
    lowest,
    after,
    reserved,
    notes: forecast.notes,
    account,
    fits: available >= amount && after >= 0,
    forecast,
  }
}
