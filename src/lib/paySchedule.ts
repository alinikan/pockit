import type { MonthKey, PockitData } from '../types'
import { validISODate } from './numbers'

type PayProfile = Pick<
  PockitData['profile'],
  'payAmount' | 'payFrequency' | 'paydayAnchor' | 'paydayDays'
>
const dayMs = 86400000
const iso = (date: Date) => date.toISOString().slice(0, 10)
const utc = (date: string) => Date.parse(`${date}T12:00:00Z`)
const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0, 12)).getUTCDate()

/** The scheduled dates for a month. Dates before the entered anchor are included: it is
 * one known payday in a repeating schedule, rather than the schedule's start date. */
export function paydaysInMonth(profile: PayProfile, month: MonthKey): string[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return []
  const [year, number] = month.split('-').map(Number)
  const lastDay = daysInMonth(year, number)
  const date = (day: number) => `${month}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
  if (profile.payFrequency === 'twice-monthly') {
    const days = profile.paydayDays || [1, 15]
    if (days.some((day) => !Number.isInteger(day) || day < 1 || day > 31)) return []
    return days.map(date).sort()
  }
  if (!validISODate(profile.paydayAnchor || '')) return []
  const anchor = profile.paydayAnchor!
  if (profile.payFrequency === 'monthly') return [date(Number(anchor.slice(-2)))]
  const interval = profile.payFrequency === 'weekly' ? 7 : 14
  const start = utc(`${month}-01`)
  const end = utc(date(lastDay))
  const first = Math.ceil((start - utc(anchor)) / (interval * dayMs))
  const dates: string[] = []
  for (let step = first; utc(anchor) + step * interval * dayMs <= end; step++)
    dates.push(iso(new Date(utc(anchor) + step * interval * dayMs)))
  return dates
}

export function scheduledIncome(profile: PayProfile, month: MonthKey): number | null {
  if (profile.payFrequency !== 'twice-monthly' && !validISODate(profile.paydayAnchor || ''))
    return null
  const dates = paydaysInMonth(profile, month)
  if (!dates.length || !Number.isFinite(profile.payAmount)) return null
  return dates.length * Math.max(0, profile.payAmount)
}
