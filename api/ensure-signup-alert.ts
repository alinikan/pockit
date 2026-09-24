import type { ApiRequest, ApiResponse } from '../server/http'
import { header, json } from '../server/http'
import { adminClient } from '../server/supabase'
import { sendQueuedNotification } from '../server/notifications'

/** A confirmed user can queue only their own minimal owner alert. This backs up
 * the auth trigger and webhook without trusting an email supplied by the browser. */
export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') return json(response, 405, { error: 'Method not allowed.' })
  const bearer = header(request, 'authorization')
  if (!bearer?.startsWith('Bearer ')) return json(response, 401, { error: 'Unauthorized.' })
  try {
    const admin = adminClient()
    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(bearer.slice(7))
    if (userError || !user?.id || !user.email || !user.email_confirmed_at)
      return json(response, 401, { error: 'Confirmed account required.' })
    const { data: delivered, error: receiptError } = await admin
      .from('pockit_notification_receipts')
      .select('user_id')
      .eq('kind', 'signup')
      .eq('user_id', user.id)
      .maybeSingle()
    if (receiptError) throw receiptError
    if (delivered) return json(response, 200, { status: 'sent' })
    const { error: queueError } = await admin
      .from('pockit_notifications')
      .upsert(
        { kind: 'signup', user_id: user.id, email: user.email, event_at: user.email_confirmed_at },
        { onConflict: 'kind,user_id', ignoreDuplicates: true },
      )
    if (queueError) throw queueError
    const { data: queued, error: readError } = await admin
      .from('pockit_notifications')
      .select('id')
      .eq('kind', 'signup')
      .eq('user_id', user.id)
      .maybeSingle()
    if (readError) throw readError
    if (queued) await sendQueuedNotification(queued.id)
    return json(response, 200, { status: queued ? 'attempted' : 'sent' })
  } catch (error) {
    console.error('Signup alert fallback failed:', error)
    return json(response, 503, { error: 'Signup alert is queued for retry if configured.' })
  }
}
