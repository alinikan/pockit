import { describe, expect, it } from 'vitest'
import { makeInitialData } from './defaults'
import { expectedTransactions } from './recurringTransactions'
import { monthSummary } from './finance'
import type { Transaction, TransactionRepeat } from '../types'

const item = (date: string, recurrence: TransactionRepeat): Transaction => ({
  id: 'repeat-source',
  date,
  payee: 'Test payment',
  amount: 25,
  type: 'expense',
  recurrence,
})

describe('recurring calendar activity', () => {
  it('shows weekly and biweekly dates without adding forecast amounts to spending', () => {
    const data = makeInitialData()
    data.transactions = [item('2026-09-04', 'weekly')]
    expect(expectedTransactions(data, '2026-09').map((entry) => entry.date)).toEqual([
      '2026-09-11',
      '2026-09-18',
      '2026-09-25',
    ])
    expect(monthSummary(data, '2026-09').spent).toBe(25)
    data.transactions[0].recurrence = 'biweekly'
    expect(expectedTransactions(data, '2026-10').map((entry) => entry.date)).toEqual([
      '2026-10-02',
      '2026-10-16',
      '2026-10-30',
    ])
  })

  it('anchors month-end repeats instead of drifting after a short month', () => {
    const data = makeInitialData()
    data.transactions = [item('2026-01-31', 'monthly')]
    expect(expectedTransactions(data, '2026-02').map((entry) => entry.date)).toEqual(['2026-02-28'])
    expect(expectedTransactions(data, '2026-03').map((entry) => entry.date)).toEqual(['2026-03-31'])
    data.transactions[0].recurrence = 'quarterly'
    expect(expectedTransactions(data, '2026-04').map((entry) => entry.date)).toEqual(['2026-04-30'])
    expect(expectedTransactions(data, '2026-03')).toEqual([])
    data.transactions[0].recurrence = 'yearly'
    expect(expectedTransactions(data, '2027-01').map((entry) => entry.date)).toEqual(['2027-01-31'])
  })

  it('respects the end date and hides occurrences that were recorded', () => {
    const data = makeInitialData()
    data.transactions = [
      { ...item('2026-09-04', 'weekly'), recurrenceEnd: '2026-09-18' },
      {
        ...item('2026-09-11', 'weekly'),
        id: 'actual',
        recurrence: undefined,
        recurrenceId: 'repeat-source',
      },
    ]
    expect(expectedTransactions(data, '2026-09').map((entry) => entry.date)).toEqual(['2026-09-18'])
    expect(expectedTransactions(data, '2026-10')).toEqual([])
  })
})
