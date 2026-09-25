import type { MonthKey, PockitData, Transaction } from '../types'

export interface ExpectedTransaction {
  source: Transaction
  date: string
}

/** Calendar projections only. They never enter the ledger until the user records them. */
export function expectedTransactions(data: PockitData, month: MonthKey): ExpectedTransaction[] {
  const [year, number] = month.split('-').map(Number)
  const start = Date.UTC(year, number - 1, 1)
  const end = Date.UTC(year, number, 1)
  const recorded = new Set(
    data.transactions
      .filter((transaction) => transaction.recurrenceId)
      .map((transaction) => `${transaction.recurrenceId}:${transaction.date}`),
  )
  const output: ExpectedTransaction[] = []
  for (const source of data.transactions) {
    if (!source.recurrence) continue
    const [startYear, startMonth, startDay] = source.date.split('-').map(Number)
    const anchor = Date.UTC(startYear, startMonth - 1, startDay)
    if (!Number.isFinite(anchor) || anchor >= end) continue
    const endLimit = source.recurrenceEnd || '9999-12-31'
    const add = (date: Date) => {
      const iso = date.toISOString().slice(0, 10)
      if (iso <= source.date || iso > endLimit || recorded.has(`${source.id}:${iso}`)) return
      output.push({ source, date: iso })
    }
    if (source.recurrence === 'weekly' || source.recurrence === 'biweekly') {
      const interval = source.recurrence === 'weekly' ? 7 : 14
      const first = Math.max(1, Math.ceil((start - anchor) / 86400000 / interval))
      for (let index = first; index < first + 6; index++) {
        const date = new Date(anchor + index * interval * 86400000)
        if (date.getTime() >= end) break
        add(date)
      }
    } else {
      const interval =
        source.recurrence === 'monthly' ? 1 : source.recurrence === 'quarterly' ? 3 : 12
      const monthDistance = (year - startYear) * 12 + number - startMonth
      if (monthDistance < interval || monthDistance % interval !== 0) continue
      const lastDay = new Date(Date.UTC(year, number, 0)).getUTCDate()
      add(new Date(Date.UTC(year, number - 1, Math.min(startDay, lastDay))))
    }
  }
  return output.sort((first, second) => first.date.localeCompare(second.date))
}
