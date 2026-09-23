import webPush from 'web-push'
import type { PockitData } from '../src/types'
import { billsForMonth } from '../src/lib/finance'
import { adminClient } from './supabase'

export function localDate(now: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now)
    const value = (type: string) => parts.find((part) => part.type === type)?.value || ''
    return `${value('year')}-${value('month')}-${value('day')}`
  } catch {
    return now.toISOString().slice(0, 10)
  }
}

export function dueBillCount(data: PockitData, today: string): number {
  const month = today.slice(0, 7) as `${number}-${number}`
  return billsForMonth(data.bills, month).filter(
    (bill) =>
      bill.date === today &&
      !bill.paid &&
      !data.transactions.some(
        (transaction) => transaction.billId === bill.id && transaction.date.slice(0, 7) === month,
      ),
  ).length
}

interface PushRow {
  endpoint: string
  user_id: string
  subscription: webPush.PushSubscription
  timezone: string
  last_sent_on: string | null
}
export async function sendBillReminders(now = new Date()) {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  if (!publicKey || !privateKey || !subject)
    return { sent: 0, failed: 0, skipped: 'Web Push is not configured.' }
  webPush.setVapidDetails(subject, publicKey, privateKey)
  const admin = adminClient()
  const { data: subscriptions, error } = await admin
    .from('pockit_push_subscriptions')
    .select('endpoint,user_id,subscription,timezone,last_sent_on')
    .eq('enabled', true)
    .limit(100)
  if (error) throw error
  let sent = 0,
    failed = 0
  for (const row of (subscriptions || []) as PushRow[]) {
    const today = localDate(now, row.timezone)
    if (row.last_sent_on === today) continue
    const { data: saved, error: loadError } = await admin
      .from('pockit_data')
      .select('data')
      .eq('user_id', row.user_id)
      .maybeSingle()
    if (loadError) {
      failed++
      continue
    }
    if (!saved || dueBillCount(saved.data as PockitData, today) === 0) continue
    const { data: claimed, error: claimError } = await admin
      .from('pockit_push_subscriptions')
      .update({ last_sent_on: today })
      .eq('endpoint', row.endpoint)
      .or(`last_sent_on.is.null,last_sent_on.neq.${today}`)
      .select('endpoint')
      .maybeSingle()
    if (claimError) {
      failed++
      continue
    }
    if (!claimed) continue
    try {
      await webPush.sendNotification(
        row.subscription,
        JSON.stringify({ body: 'You have a bill due today. Open Pockit for details.' }),
        { TTL: 3600 },
      )
      sent++
    } catch (error) {
      const code = (error as { statusCode?: number }).statusCode
      if (code === 404 || code === 410)
        await admin.from('pockit_push_subscriptions').delete().eq('endpoint', row.endpoint)
      else {
        await admin
          .from('pockit_push_subscriptions')
          .update({ last_sent_on: null })
          .eq('endpoint', row.endpoint)
          .eq('last_sent_on', today)
        failed++
      }
    }
  }
  return { sent, failed }
}
