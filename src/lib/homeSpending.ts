import type { Category } from '../types'

export interface HomeSpendingRow {
  category: Pick<Category, 'id' | 'name' | 'color' | 'icon'>
  used: number
  availableToSpend: number
  hasPlan: boolean
}

export interface SpendingSegment {
  id: string
  name: string
  color: string
  amount: number
  share: number
  start: number
}

/** Keep the ring and the plan meters on their own, explicitly labelled scales. */
export function homeSpendingVisual<T extends HomeSpendingRow>(
  rows: T[],
  netSpent: number,
  maxRows = 5,
) {
  const positiveRows = rows
    .filter((row) => Number.isFinite(row.used) && row.used > 0)
    .sort((a, b) => b.used - a.used)
  const showing = positiveRows.slice(0, maxRows)
  const positiveCategorized = positiveRows.reduce((sum, row) => sum + row.used, 0)
  const shownTotal = showing.reduce((sum, row) => sum + row.used, 0)
  // Includes smaller categories and positive spending without a budget category.
  const other =
    Math.max(0, positiveCategorized - shownTotal) + Math.max(0, netSpent - positiveCategorized)
  const ringTotal = shownTotal + other
  // A refund can make net spending smaller than the positive amounts in the ring.
  const refundOffset = Math.max(0, ringTotal - netSpent)
  let start = 0
  const segments: SpendingSegment[] = [
    ...showing.map((row) => ({
      id: row.category.id,
      name: row.category.name,
      color: row.category.color,
      amount: row.used,
    })),
    ...(other > 0.005
      ? [{ id: 'other', name: 'Other spending', color: 'var(--muted)', amount: other }]
      : []),
  ].map((segment) => {
    const share = ringTotal > 0 ? segment.amount / ringTotal : 0
    const result = { ...segment, share, start }
    start += share
    return result
  })
  return { showing, segments, ringTotal, other, refundOffset }
}

export function categoryPlanProgress(row: HomeSpendingRow): number | null {
  if (!row.hasPlan || row.availableToSpend <= 0) return null
  return Math.max(0, (row.used / row.availableToSpend) * 100)
}
