import { parseBackup } from './backup'
import type { ChangeCollection, ChangeEntry, PockitData, Transaction } from '../types'
import { accountBalance } from './ledger'
import { changeTransaction } from './linked'
import { categoryAvailable, changedCategoryMonths } from './experience'
import { money, shiftMonth, todayISO } from './finance'
const collections: ChangeCollection[] = [
  'transactions',
  'categories',
  'goals',
  'bills',
  'accounts',
  'projects',
  'subscriptions',
]
export const equalRecord = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((value, i) => equalRecord(value, b[i]))
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const first = Object.entries(a).filter(([, v]) => v !== undefined),
      second = Object.entries(b).filter(([, v]) => v !== undefined)
    return (
      first.length === second.length &&
      first.every(([key, value]) => equalRecord(value, (b as Record<string, unknown>)[key]))
    )
  }
  return false
}
export function limitChangeHistory(entries: ChangeEntry[]) {
  let size = 0
  return entries.slice(0, 150).filter((entry) => {
    const bytes = new TextEncoder().encode(JSON.stringify(entry)).length
    if (size + bytes > 500000) return false
    size += bytes
    return true
  })
}
export function withChangeHistory(before: PockitData, after: PockitData): PockitData {
  if (before === after || before.changeLog !== after.changeLog) return after
  const changes: ChangeEntry['changes'] = []
  for (const collection of collections) {
    const old = new Map((before[collection] || []).map((item) => [item.id, item]))
    const next = new Map((after[collection] || []).map((item) => [item.id, item]))
    for (const id of new Set([...old.keys(), ...next.keys()]))
      if (!equalRecord(old.get(id), next.get(id)))
        changes.push({ collection, id, before: old.get(id) || null, after: next.get(id) || null })
  }
  if (!changes.length) return after
  const primary = changes[0]
  const value = (primary.after || primary.before) as { payee?: string; name?: string }
  const entry: ChangeEntry = {
    id: crypto.randomUUID(),
    time: new Date().toISOString(),
    label: `${!primary.before ? 'Added' : !primary.after ? 'Removed' : 'Updated'} ${value.payee || value.name || primary.collection}`,
    changes:
      changes.length > 200 || JSON.stringify(changes).length > 300000
        ? []
        : JSON.parse(JSON.stringify(changes)),
  }
  return { ...after, changeLog: limitChangeHistory([entry, ...(before.changeLog || [])]) }
}
export function canRestoreChange(data: PockitData, entry: ChangeEntry) {
  return (
    entry.changes.length > 0 &&
    entry.changes.every((change) =>
      equalRecord(
        (data[change.collection] || []).find((item) => item.id === change.id) || null,
        change.after,
      ),
    )
  )
}
export function restoreChange(data: PockitData, entry: ChangeEntry): PockitData {
  if (!canRestoreChange(data, entry))
    throw new Error(
      'A related record has changed since this edit. Review its current details instead of overwriting them.',
    )
  const next = { ...data } as PockitData
  for (const change of entry.changes) {
    const values = (next[change.collection] || []).filter((item) => item.id !== change.id)
    if (change.before) values.push(change.before as never)
    ;(next as unknown as Record<string, unknown>)[change.collection] = values
  }
  parseBackup(JSON.stringify(next))
  const undo: ChangeEntry = {
    id: crypto.randomUUID(),
    time: new Date().toISOString(),
    label: `Restored: ${entry.label}`,
    restoredFrom: entry.id,
    changes: entry.changes.map((change) => ({
      ...change,
      before: change.after,
      after: change.before,
    })),
  }
  return { ...next, changeLog: limitChangeHistory([undo, ...(data.changeLog || [])]) }
}
export function previewTransactionChange(
  data: PockitData,
  before: Transaction | null,
  after: Transaction | null,
) {
  const next = changeTransaction(data, before, after)
  const lines: string[] = []
  for (const account of data.accounts || []) {
    const delta =
      accountBalance(account, next.transactions, todayISO()) -
      accountBalance(account, data.transactions, todayISO())
    if (Math.abs(delta) > 0.005)
      lines.push(
        `${account.name}: ${money(accountBalance(account, data.transactions, todayISO()))} → ${money(accountBalance(account, next.transactions, todayISO()))}`,
      )
  }
  for (const goal of data.goals) {
    const updated = next.goals.find((item) => item.id === goal.id)!
    if (goal.balance !== updated.balance)
      lines.push(`${goal.name}: ${money(goal.balance)} → ${money(updated.balance)}`)
  }
  const categoryIds = new Set(
    [
      before?.categoryId,
      after?.categoryId,
      ...(before?.splits || []).map((s) => s.categoryId),
      ...(after?.splits || []).map((s) => s.categoryId),
    ].filter(Boolean) as string[],
  )
  for (const month of changedCategoryMonths(before, after))
    for (const id of categoryIds) {
      const old = categoryAvailable(data, id, month),
        value = categoryAvailable(next, id, month)
      if (old !== null && value !== null && Math.abs(old - value) > 0.005) {
        lines.push(
          `${data.categories.find((item) => item.id === id)?.name} · ${month}: ${money(old)} → ${money(value)} available`,
        )
        const following = shiftMonth(month, 1),
          oldNext = categoryAvailable(data, id, following),
          newNext = categoryAvailable(next, id, following)
        if (oldNext !== null && newNext !== null && oldNext !== newNext)
          lines.push(`Carryover into ${following}: ${money(oldNext)} → ${money(newNext)} available`)
      }
    }
  for (const bill of data.bills)
    if (!equalRecord(bill.paidMonths, next.bills.find((item) => item.id === bill.id)?.paidMonths))
      lines.push(`${bill.name}: Calendar payment status updates`)
  return lines
}
