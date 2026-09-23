import type { ApiRequest, ApiResponse } from '../server/http'
import { bearerToken, json } from '../server/http'
import { adminClient } from '../server/supabase'
import { createClient } from '@supabase/supabase-js'
import { requiredEnv } from '../server/http'
import { sendQueuedNotification } from '../server/notifications'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') return json(response, 405, { error: 'Method not allowed.' })
  const token = bearerToken(request)
  if (!token) return json(response, 401, { error: 'Sign in again before deleting your account.' })

  try {
    const admin = adminClient()
    const { data: userResult, error: userError } = await admin.auth.getUser(token)
    const user = userResult.user
    if (userError || !user || !user.email)
      return json(response, 401, { error: 'Your session has expired. Sign in again.' })
    const password = (request.body as { password?: unknown } | null)?.password
    if (typeof password !== 'string' || !password)
      return json(response, 400, { error: 'Enter your current password.' })
    const verifier = createClient(
      requiredEnv('SUPABASE_URL'),
      requiredEnv('VITE_SUPABASE_PUBLISHABLE_KEY'),
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    const { data: verified, error: verifyError } = await verifier.auth.signInWithPassword({
      email: user.email,
      password,
    })
    if (verifyError || verified.user?.id !== user.id)
      return json(response, 403, { error: 'That password did not match.' })

    // Fail closed if the receipt queue is not installed: deletion must create a receipt.
    const { error: queueError } = await admin.from('pockit_notifications').select('id').limit(1)
    if (queueError) throw queueError

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
    if (deleteError) throw deleteError

    let emailPending = true
    try {
      const { data: receipt, error: receiptError } = await admin
        .from('pockit_notifications')
        .select('id')
        .eq('kind', 'account_deleted')
        .eq('user_id', user.id)
        .maybeSingle()
      if (receiptError) throw receiptError
      if (receipt) emailPending = (await sendQueuedNotification(receipt.id)) !== 'sent'
    } catch {
      // The account is already gone. A queued receipt can be retried later.
    }
    return json(response, 200, { deleted: true, emailPending })
  } catch (error) {
    console.error('Account deletion failed:', error)
    return json(response, 503, { error: 'Could not delete your account. Please try again.' })
  }
}
