import type { MonthKey, PockitData } from '../types'
import {
  categoryBudget,
  money,
  monthSummary,
  rolloverBalance,
  transactionsInMonth,
} from './finance'

export const UNCATEGORIZED = '__uncategorized__'

export interface MonthSnapshot {
  month: MonthKey
  spent: number
  recordedIncome: number
  expectedIncome: number
  expenseCount: number
  categorySpend: Record<string, number>
}

export function monthSnapshot(data: PockitData, month: MonthKey): MonthSnapshot {
  const known = new Set(data.categories.map((category) => category.id))
  const categorySpend: Record<string, number> = {}
  let spent = 0
  let recordedIncome = 0
  let expenseCount = 0
  for (const transaction of transactionsInMonth(data.transactions, month)) {
    if (transaction.type === 'income') recordedIncome += transaction.amount
    if (transaction.type !== 'expense') continue
    spent += transaction.amount
    expenseCount++
    const key =
      transaction.categoryId && known.has(transaction.categoryId)
        ? transaction.categoryId
        : UNCATEGORIZED
    categorySpend[key] = (categorySpend[key] || 0) + transaction.amount
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
  ].filter((row) => includeEmpty || row.values.some((value) => value > 0))
}

export function budgetComparison(data: PockitData, month: MonthKey) {
  const snapshot = monthSnapshot(data, month)
  const income = monthSummary(data, month).income
  const rows = data.categories.map((category) => {
    const planned = categoryBudget(category, month, income)
    const spent = snapshot.categorySpend[category.id] || 0
    return {
      id: category.id,
      name: category.name,
      icon: category.icon,
      color: category.color,
      mode: category.mode,
      planned,
      spent,
      balance:
        category.mode === 'rollover' ? rolloverBalance(category, data, month) : planned - spent,
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
    balance: -(snapshot.categorySpend[UNCATEGORIZED] || 0),
  })
  return rows.filter((row) => row.planned > 0 || row.spent > 0)
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
  const over = budgetComparison(data, after.month).filter((row) => row.balance < 0)
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
