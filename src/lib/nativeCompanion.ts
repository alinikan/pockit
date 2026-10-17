import type { PockitData } from '../types'
import { billsForMonth, currentMonth, monthSummary, todayISO } from './finance'
export function widgetSummary(data: PockitData | null, preview = false) {
  if (!data?.onboarded || !data.settings.nativeWidgets || preview)
    return { version: 1, enabled: false }
  const month = currentMonth(),
    summary = monthSummary(data, month)
  const next = billsForMonth(data.bills, month)
    .filter((item) => !item.paid && !item.skipped && item.date >= todayISO())
    .sort((a, b) => a.date.localeCompare(b.date))[0]
  return {
    version: 1,
    enabled: true,
    month,
    updatedAt: new Date().toISOString(),
    spent: summary.spent,
    hideAmounts: !!data.settings.hideAmounts,
    nextBill: next ? { name: next.name.slice(0, 100), date: next.date, amount: next.amount } : null,
  }
}
export function sendWidgetSummary(data: PockitData | null, preview = false) {
  const handler = (
    window as unknown as {
      webkit?: { messageHandlers?: { pockitWidget?: { postMessage: (value: unknown) => void } } }
    }
  ).webkit?.messageHandlers?.pockitWidget
  if (handler) {
    try {
      handler.postMessage({
        ...widgetSummary(data, preview),
        theme: data?.settings.theme || 'dark',
      })
    } catch {
      /* An unavailable widget bridge must not interrupt the budget. */
    }
  }
}
