import { describe, expect, it } from 'vitest'
import { makeInitialData } from './defaults'
import { monthSummary } from './finance'
import { paydaysInMonth, scheduledIncome } from './paySchedule'

describe('dated pay schedules', () => {
  const profile = () => makeInitialData().profile

  it('counts the three-cheque biweekly month and adjacent two-cheque months', () => {
    const pay = {
      ...profile(),
      payFrequency: 'biweekly' as const,
      paydayAnchor: '2026-01-02',
      payAmount: 1000,
    }
    expect(paydaysInMonth(pay, '2026-01')).toEqual(['2026-01-02', '2026-01-16', '2026-01-30'])
    expect(paydaysInMonth(pay, '2026-02')).toEqual(['2026-02-13', '2026-02-27'])
    expect(scheduledIncome(pay, '2026-01')).toBe(3000)
    expect(scheduledIncome(pay, '2026-02')).toBe(2000)
  })

  it('projects backward from a known payday and across leap years', () => {
    const pay = { ...profile(), payFrequency: 'biweekly' as const, paydayAnchor: '2028-03-10' }
    expect(paydaysInMonth(pay, '2028-02')).toEqual(['2028-02-11', '2028-02-25'])
    expect(paydaysInMonth(pay, '2028-03')).toEqual(['2028-03-10', '2028-03-24'])
  })

  it('distinguishes weekly five-cheque months from four-cheque months', () => {
    const pay = {
      ...profile(),
      payFrequency: 'weekly' as const,
      paydayAnchor: '2026-01-02',
      payAmount: 500,
    }
    expect(paydaysInMonth(pay, '2026-01')).toHaveLength(5)
    expect(paydaysInMonth(pay, '2026-02')).toHaveLength(4)
    expect(scheduledIncome(pay, '2026-01')).toBe(2500)
  })

  it('clamps month-end dates, including leap day, without losing two separate cheques', () => {
    const twice = {
      ...profile(),
      payFrequency: 'twice-monthly' as const,
      paydayDays: [28, 31] as [number, number],
    }
    expect(paydaysInMonth(twice, '2026-02')).toEqual(['2026-02-28', '2026-02-28'])
    expect(paydaysInMonth(twice, '2028-02')).toEqual(['2028-02-28', '2028-02-29'])
    const monthly = { ...profile(), payFrequency: 'monthly' as const, paydayAnchor: '2026-01-31' }
    expect(paydaysInMonth(monthly, '2026-02')).toEqual(['2026-02-28'])
  })

  it('does not fabricate exact dates without an anchor or from invalid input', () => {
    const pay = { ...profile(), payFrequency: 'biweekly' as const, paydayAnchor: '2026-02-30' }
    expect(paydaysInMonth(pay, '2026-03')).toEqual([])
    expect(scheduledIncome(pay, '2026-03')).toBeNull()
    expect(paydaysInMonth(pay, '2026-13' as '2026-13')).toEqual([])
  })

  it('drives every monthly summary while preserving an undated Waypoint estimate', () => {
    const data = makeInitialData()
    data.profile.payFrequency = 'biweekly'
    data.profile.payAmount = 1000
    data.profile.plannedMonthlyIncome = 2200
    data.profile.plannedIncomeStarts = '2026-01'
    expect(monthSummary(data, '2026-01').income).toBe(2200)
    data.profile.paydayAnchor = '2026-01-02'
    expect(monthSummary(data, '2026-01').income).toBe(3000)
    expect(monthSummary(data, '2026-02').income).toBe(2000)
  })
})
