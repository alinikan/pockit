import type { ApiRequest, ApiResponse } from '../server/http'
import { header, json, requiredEnv, sameSecret } from '../server/http'
import { adminClient } from '../server/supabase'
import { sendQueuedNotification } from '../server/notifications'

type WebhookPayload = {
  type?: string
  schema?: string
  table?: string
  record?: { id?: unknown }
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') return json(response, 405, { error: 'Method not allowed.' })
  try {
    if (
      !sameSecret(header(request, 'x-pockit-webhook-secret'), requiredEnv('POCKIT_WEBHOOK_SECRET'))
    )
      return json(response, 401, { error: 'Unauthorized.' })
    const payload = request.body as WebhookPayload | null
    const id = payload?.record?.id
    if (
      payload?.type !== 'INSERT' ||
      payload.schema !== 'public' ||
      payload.table !== 'pockit_notifications' ||
      typeof id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)
    )
      return json(response, 400, { error: 'Invalid webhook payload.' })

    // Use the authenticated database row, not email addresses in the HTTP payload.
    const { data, error } = await adminClient()
      .from('pockit_notifications')
      .select('id')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (!data) return json(response, 200, { status: 'already-sent' })
    const status = await sendQueuedNotification(id)
    return json(response, 200, { status })
  } catch (error) {
    console.error('Notification webhook failed:', error)
    return json(response, 503, { error: 'Delivery will be retried.' })
  }
}
