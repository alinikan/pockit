import type { MonthKey, PockitData } from '../types'
import {
  beforeWaypointPlan,
  categoryBudget,
  money,
  monthSummary,
  rolloverBalance,
  transactionsInMonth,
} from './finance'

export const UNCATEGORIZED = '__uncategorized__'
export const EXCLUDED = '__excluded_from_budget__'

export function transactionsBehind(
  data: PockitData,
  categoryId: string,
  month: MonthKey,
  throughDay?: number,
) {
  const known = new Set(data.categories.map((category) => category.id))
  return transactionsInMonth(data.transactions, month)
    .filter(
      (transaction) =>
        transaction.type === 'expense' &&
        (!throughDay || Number(transaction.date.slice(-2)) <= throughDay) &&
        (categoryId === EXCLUDED
          ? !!transaction.excludedFromBudget
          : categoryId === UNCATEGORIZED
            ? !transaction.splits?.length &&
              !transaction.excludedFromBudget &&
              (!transaction.categoryId || !known.has(transaction.categoryId))
            : !transaction.excludedFromBudget &&
              (transaction.splits?.some((split) => split.categoryId === categoryId) ||
                transaction.categoryId === categoryId)),
    )
    .sort((a, b) => b.amount - a.amount || b.date.localeCompare(a.date))
}

export const parseMonthInput = (value: string): MonthKey | null =>
  /^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(value) ? (value as MonthKey) : null

export interface MonthSnapshot {
  month: MonthKey
  spent: number
  recordedIncome: number
  expectedIncome: number
  expenseCount: number
  categorySpend: Record<string, number>
}

export function monthSnapshot(
  data: PockitData,
  month: MonthKey,
  throughDay?: number,
): MonthSnapshot {
  const known = new Set(data.categories.map((category) => category.id))
  const categorySpend: Record<string, number> = {}
  let spent = 0
  let recordedIncome = 0
  let expenseCount = 0
  for (const transaction of transactionsInMonth(data.transactions, month)) {
    if (throughDay && Number(transaction.date.slice(-2)) > throughDay) continue
    if (transaction.type === 'income') recordedIncome += transaction.amount
    if (transaction.type !== 'expense') continue
    const sign = transaction.refund ? -1 : 1
    spent += transaction.amount * sign
    expenseCount++
    if (transaction.excludedFromBudget) {
      categorySpend[EXCLUDED] = (categorySpend[EXCLUDED] || 0) + transaction.amount * sign
      continue
    }
    if (transaction.splits?.length) {
      for (const split of transaction.splits) {
        const key = known.has(split.categoryId) ? split.categoryId : UNCATEGORIZED
        categorySpend[key] = (categorySpend[key] || 0) + split.amount * sign
      }
    } else {
      const key =
        transaction.categoryId && known.has(transaction.categoryId)
          ? transaction.categoryId
          : UNCATEGORIZED
      categorySpend[key] = (categorySpend[key] || 0) + transaction.amount * sign
    }
  }
  return {
    month,
    spent,
    recordedIncome,
    expectedIncome: monthSummary(data, month).income,
    expenseCount,
    categorySpend,
  }
}

export function merchantDrivers(
  data: PockitData,
  categoryId: string,
  before: MonthKey,
  after: MonthKey,
  throughDay?: number,
) {
  const total = (month: MonthKey) => {
    const map = new Map<string, { payee: string; amount: number; count: number }>()
    for (const transaction of transactionsBehind(data, categoryId, month, throughDay)) {
      const key = transaction.payee.trim().toLowerCase()
      const amount =
        (transaction.splits?.find((split) => split.categoryId === categoryId)?.amount ||
          transaction.amount) * (transaction.refund ? -1 : 1)
      const previous = map.get(key)
      map.set(key, {
        payee: previous?.payee || transaction.payee,
        amount: (previous?.amount || 0) + amount,
        count: (previous?.count || 0) + 1,
      })
    }
    return map
  }
  const earlier = total(before)
  const later = total(after)
  return [...new Set([...earlier.keys(), ...later.keys()])]
    .map((key) => ({
      payee: later.get(key)?.payee || earlier.get(key)!.payee,
      before: earlier.get(key)?.amount || 0,
      after: later.get(key)?.amount || 0,
      change: (later.get(key)?.amount || 0) - (earlier.get(key)?.amount || 0),
      kind: !earlier.has(key)
        ? ('new' as const)
        : !later.has(key)
          ? ('absent' as const)
          : ('repeated' as const),
    }))
    .filter((driver) => Math.abs(driver.change) > 0.001)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
}

export function comparisonCoverage(before: MonthSnapshot, after: MonthSnapshot) {
  if (before.expenseCount < 3 || after.expenseCount < 3)
    return `Limited entries: ${before.expenseCount} in ${before.month} and ${after.expenseCount} in ${after.month}. Check that both months are complete.`
  const ratio =
    Math.min(before.expenseCount, after.expenseCount) /
    Math.max(before.expenseCount, after.expenseCount)
  return ratio < 0.5
    ? 'The number of recorded expenses differs a lot between these months. Check for missing entries before drawing conclusions.'
    : null
}

export const difference = (before: number, after: number) => ({
  amount: after - before,
  percent: before > 0 ? ((after - before) / before) * 100 : null,
})

export function categoryComparison(
  data: PockitData,
  snapshots: MonthSnapshot[],
  includeEmpty = false,
) {
  return [
    ...data.categories.map((category) => ({
      id: category.id,
      name: category.name,
      icon: category.icon,
      color: category.color,
      group: category.group,
      values: snapshots.map((snapshot) => snapshot.categorySpend[category.id] || 0),
    })),
    {
      id: UNCATEGORIZED,
      name: 'Uncategorized',
      icon: 'Shapes',
      color: '#91a29a',
      group: 'Other',
      values: snapshots.map((snapshot) => snapshot.categorySpend[UNCATEGORIZED] || 0),
    },
    {
      id: EXCLUDED,
      name: 'Excluded from budget',
      icon: 'Circle',
      color: '#aab6b0',
      group: 'Other',
      values: snapshots.map((snapshot) => snapshot.categorySpend[EXCLUDED] || 0),
    },
  ].filter((row) => includeEmpty || row.values.some((value) => Math.abs(value) > 0.001))
}

export function budgetComparison(data: PockitData, month: MonthKey) {
  const snapshot = monthSnapshot(data, month)
  const income = monthSummary(data, month).income
  const rows = data.categories.map((category) => {
    const planned = categoryBudget(category, month, income)
    const spent = snapshot.categorySpend[category.id] || 0
    const planUnavailable = month < category.starts
    return {
      id: category.id,
      name: category.name,
      icon: category.icon,
      color: category.color,
      mode: category.mode,
      planned,
      spent,
      planUnavailable,
      balance: planUnavailable
        ? 0
        : category.mode === 'rollover'
          ? rolloverBalance(category, data, month)
          : planned - spent,
    }
  })
  rows.push({
    id: UNCATEGORIZED,
    name: 'Uncategorized',
    icon: 'Shapes',
    color: '#91a29a',
    mode: 'fresh',
    planned: 0,
    spent: snapshot.categorySpend[UNCATEGORIZED] || 0,
    planUnavailable: false,
    balance: -(snapshot.categorySpend[UNCATEGORIZED] || 0),
  })
  rows.push({
    id: EXCLUDED,
    name: 'Excluded from budget',
    icon: 'Circle',
    color: '#aab6b0',
    mode: 'fresh',
    planned: 0,
    spent: snapshot.categorySpend[EXCLUDED] || 0,
    planUnavailable: false,
    balance: 0,
  })
  return rows.filter((row) => row.planned > 0 || Math.abs(row.spent) > 0.001)
}

export function comparisonFindings(data: PockitData, before: MonthSnapshot, after: MonthSnapshot) {
  const currency = data.settings.currency
  const rows = categoryComparison(data, [before, after]).map((row) => ({
    ...row,
    change: row.values[1] - row.values[0],
  }))
  const up = [...rows].sort((a, b) => b.change - a.change)[0]
  const down = [...rows].sort((a, b) => a.change - b.change)[0]
  const findings: { kind: 'attention' | 'good' | 'neutral'; title: string; text: string }[] = []
  if (before.expenseCount && after.expenseCount && up?.change > 0)
    findings.push({
      kind: 'attention',
      title: `${up.name} moved up the most`,
      text: `${money(up.change, currency)} more than the baseline month. Check its transactions in Activity before changing the plan.`,
    })
  if (before.expenseCount && after.expenseCount && down?.change < 0)
    findings.push({
      kind: 'good',
      title: `${down.name} moved down the most`,
      text: `${money(Math.abs(down.change), currency)} less than the baseline month. Check whether a bill has not been entered yet.`,
    })
  const historicalUnplanned =
    beforeWaypointPlan(data, after.month) &&
    !data.categories.some((category) => !category.archived && category.starts <= after.month)
  const over = historicalUnplanned
    ? []
    : budgetComparison(data, after.month).filter((row) => row.balance < 0)
  if (over.length)
    findings.push({
      kind: 'attention',
      title: `${over.length} ${over.length === 1 ? 'category needs' : 'categories need'} attention`,
      text: `${over
        .slice(0, 2)
        .map((row) => row.name)
        .join(
          ' and ',
        )}${over.length > 2 ? ' and more' : ''} went past the available budget in ${after.month}. Review them in Plan vs actual.`,
    })
  return findings
}
