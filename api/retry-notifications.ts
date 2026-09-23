import type { ApiRequest, ApiResponse } from '../server/http'
import { header, json, requiredEnv, sameSecret } from '../server/http'
import { retryNotifications } from '../server/notifications'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'GET') return json(response, 405, { error: 'Method not allowed.' })
  try {
    if (!sameSecret(header(request, 'authorization'), `Bearer ${requiredEnv('CRON_SECRET')}`))
      return json(response, 401, { error: 'Unauthorized.' })
    const result = await retryNotifications()
    return json(response, result.failed ? 503 : 200, result)
  } catch (error) {
    console.error('Notification retry failed:', error)
    return json(response, 503, { error: 'Retry failed.' })
  }
}
