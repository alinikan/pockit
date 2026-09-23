import { describe, expect, it } from 'vitest'
import { makeDemoData } from '../src/lib/defaults'
import { dueBillCount, localDate } from './push'

describe('private bill reminders', () => {
  it('uses a subscriber timezone and skips paid or linked bills', () => {
    const data = makeDemoData()
    expect(localDate(new Date('2026-09-24T01:00:00Z'), 'America/Vancouver')).toBe('2026-09-23')
    expect(dueBillCount(data, `${data.bills[1].paidMonths[0] || '2026-09'}-24`)).toBe(1)
    data.bills[1].paidMonths.push('2026-09')
    expect(dueBillCount(data, '2026-09-24')).toBe(0)
  })
  it('returns no reminder for another day, and ignores a linked Activity payment', () => {
    const data = makeDemoData()
    const bill = data.bills.find((item) => item.name === 'Internet')!
    expect(dueBillCount(data, '2026-09-23')).toBe(0)
    data.transactions.push({
      id: 'paid-online',
      date: '2026-09-24',
      payee: bill.name,
      amount: bill.amount,
      type: 'expense',
      billId: bill.id,
    })
    expect(dueBillCount(data, '2026-09-24')).toBe(0)
  })
  it('uses UTC when a stored timezone is invalid', () => {
    expect(localDate(new Date('2026-12-31T23:55:00Z'), 'Not/A-Timezone')).toBe('2026-12-31')
  })
})
