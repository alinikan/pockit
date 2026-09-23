import type { ApiRequest, ApiResponse } from '../server/http'
import { header, json, requiredEnv, sameSecret } from '../server/http'
import { sendBillReminders } from '../server/push'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'GET') return json(response, 405, { error: 'Method not allowed.' })
  try {
    if (!sameSecret(header(request, 'authorization'), `Bearer ${requiredEnv('CRON_SECRET')}`))
      return json(response, 401, { error: 'Unauthorized.' })
    const result = await sendBillReminders()
    return json(response, result.failed ? 503 : 200, result)
  } catch (error) {
    console.error('Bill reminder check failed:', error)
    return json(response, 503, { error: 'Bill reminder check failed.' })
  }
}
