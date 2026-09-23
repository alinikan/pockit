import { adminClient } from './supabase'
import { deletionEmail, sendEmail, signupEmail } from './email'
import { requiredEnv } from './http'

export type Notification = {
  id: string
  kind: 'signup' | 'account_deleted'
  user_id: string
  email: string
  event_at: string
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown delivery error'
}

export async function sendQueuedNotification(id: string): Promise<'sent' | 'busy'> {
  const admin = adminClient()
  const { data, error } = await admin.rpc('claim_pockit_notification', { p_id: id })
  if (error) throw error
  const item = (data as Notification[] | null)?.[0]
  if (!item) return 'busy'
  try {
    const recipient = item.kind === 'signup' ? requiredEnv('POCKIT_ADMIN_EMAIL') : item.email
    const message =
      item.kind === 'signup' ? signupEmail(item.email, item.event_at) : deletionEmail()
    await sendEmail(recipient, message)
    const { error: removeError } = await admin.from('pockit_notifications').delete().eq('id', id)
    if (removeError) throw removeError
    return 'sent'
  } catch (error) {
    const { error: releaseError } = await admin
      .from('pockit_notifications')
      .update({ locked_until: null, last_error: errorMessage(error).slice(0, 200) })
      .eq('id', id)
    if (releaseError) throw releaseError
    throw error
  }
}

export async function retryNotifications(): Promise<{ sent: number; failed: number }> {
  const admin = adminClient()
  const { data, error } = await admin
    .from('pockit_notifications')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(40)
  if (error) throw error
  let sent = 0
  let failed = 0
  for (const item of data || []) {
    try {
      if ((await sendQueuedNotification(item.id)) === 'sent') sent++
    } catch {
      failed++
    }
  }
  return { sent, failed }
}
