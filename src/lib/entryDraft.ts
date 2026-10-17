import type { Transaction } from '../types'
const key = (scope: string) => `pockit-entry-draft:${scope}`
export function readEntryDraft(scope: string): Transaction | null {
  try {
    const value = JSON.parse(localStorage.getItem(key(scope)) || 'null')
    return value &&
      typeof value.id === 'string' &&
      typeof value.payee === 'string' &&
      typeof value.date === 'string' &&
      Number.isFinite(value.amount) &&
      value.amount >= 0 &&
      ['expense', 'income', 'transfer'].includes(value.type)
      ? value
      : null
  } catch {
    return null
  }
}
export function writeEntryDraft(scope: string, value: Transaction) {
  try {
    localStorage.setItem(key(scope), JSON.stringify(value))
    return true
  } catch {
    return false
  }
}
export function clearEntryDraft(scope: string) {
  try {
    localStorage.removeItem(key(scope))
  } catch {
    /* The current entry can still be saved to the app. */
  }
}
