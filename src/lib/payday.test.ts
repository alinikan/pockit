import { describe, expect, it } from 'vitest'
import { makeDemoData } from './defaults'
import { nextPayday, paychequeForecast } from './payday'

describe('paycheque timing', () => {
  it('uses a weekly or biweekly anchor across month boundaries', () => {
    const data = makeDemoData()
    data.profile.paydayAnchor = '2026-09-18'
    data.profile.payFrequency = 'weekly'
    expect(nextPayday(data, '2026-09-23')).toBe('2026-09-25')
    data.profile.payFrequency = 'biweekly'
    expect(nextPayday(data, '2026-09-23')).toBe('2026-10-02')
  })
  it('uses a known future payday to infer earlier dates on the same schedule', () => {
    const data = makeDemoData()
    data.profile.payFrequency = 'biweekly'
    data.profile.paydayAnchor = '2026-10-02'
    expect(nextPayday(data, '2026-09-16')).toBe('2026-09-18')
  })
  it('handles twice-monthly and month-end paydays', () => {
    const data = makeDemoData()
    data.profile.payFrequency = 'twice-monthly'
    data.profile.paydayDays = [1, 31]
    expect(nextPayday(data, '2026-02-27')).toBe('2026-02-28')
    expect(nextPayday(data, '2026-02-28')).toBe('2026-03-01')
    data.profile.payFrequency = 'monthly'
    data.profile.paydayAnchor = '2026-01-31'
    expect(nextPayday(data, '2026-02-27')).toBe('2026-02-28')
  })
  it('requires a configured anchor for weekly pay and rejects invalid dates', () => {
    const data = makeDemoData()
    data.profile.payFrequency = 'weekly'
    expect(nextPayday(data, '2026-09-23')).toBeNull()
    expect(nextPayday(data, '2026-02-30')).toBeNull()
  })
  it('calculates an estimate from a dated starting amount and unpaid bills', () => {
    const data = makeDemoData()
    data.profile.payFrequency = 'weekly'
    data.profile.paydayAnchor = '2026-09-18'
    data.profile.cashOnHand = 500
    data.profile.cashAsOf = '2026-09-20'
    data.transactions.push({
      id: 'late-income',
      date: '2026-09-21',
      payee: 'Pay',
      amount: 200,
      type: 'income',
    })
    data.transactions.push({
      id: 'late-spend',
      date: '2026-09-22',
      payee: 'Food',
      amount: 50,
      type: 'expense',
    })
    const forecast = paychequeForecast(data, '2026-09-22')
    expect(forecast.payday).toBe('2026-09-25')
    expect(forecast.estimatedCash).toBe(650)
    expect(forecast.bills.map((entry) => entry.bill.name)).toEqual(['Internet'])
    expect(forecast.afterBills).toBe(570)
    expect(forecast.perDay).toBe(190)
  })
  it('does not invent a cash balance without a dated starting amount', () => {
    const data = makeDemoData()
    expect(paychequeForecast(data, '2026-09-22').afterBills).toBeNull()
  })
  it('counts an entry added after today’s starting amount, but not earlier entries', () => {
    const data = makeDemoData()
    data.profile.payFrequency = 'weekly'
    data.profile.paydayAnchor = '2026-09-25'
    data.profile.cashOnHand = 300
    data.profile.cashAsOf = '2026-09-22'
    data.profile.cashUpdatedAt = '2026-09-22T12:00:00.000Z'
    data.transactions.push({
      id: 'earlier',
      date: '2026-09-22',
      payee: 'Earlier',
      amount: 20,
      type: 'expense',
      createdAt: '2026-09-22T11:00:00.000Z',
    })
    data.transactions.push({
      id: 'later',
      date: '2026-09-22',
      payee: 'Later',
      amount: 15,
      type: 'expense',
      createdAt: '2026-09-22T13:00:00.000Z',
    })
    expect(paychequeForecast(data, '2026-09-22').estimatedCash).toBe(285)
  })
  it('adds a later refund to the manual cash estimate', () => {
    const data = makeDemoData()
    data.profile.cashOnHand = 300
    data.profile.cashAsOf = '2026-09-20'
    data.transactions.push({
      id: 'refund',
      date: '2026-09-22',
      payee: 'Return',
      amount: 25,
      type: 'expense',
      refund: true,
    })
    expect(paychequeForecast(data, '2026-09-22').estimatedCash).toBe(325)
  })
})
