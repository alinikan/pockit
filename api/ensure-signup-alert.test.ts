import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiResponse } from '../server/http'
import handler from './ensure-signup-alert'

const { getUser, receiptRead, queueRead, upsert, sendQueuedNotification } = vi.hoisted(() => ({
  getUser: vi.fn(),
  receiptRead: vi.fn(),
  queueRead: vi.fn(),
  upsert: vi.fn(),
  sendQueuedNotification: vi.fn(),
}))
vi.mock('../server/supabase', () => ({
  adminClient: () => ({
    auth: { getUser },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: table === 'pockit_notification_receipts' ? receiptRead : queueRead,
          }),
        }),
      }),
      upsert,
    }),
  }),
}))
vi.mock('../server/notifications', () => ({ sendQueuedNotification }))

function response() {
  const result = { code: 0, body: null as unknown }
  const reply: ApiResponse = {
    status(code) {
      result.code = code
      return reply
    },
    json(value) {
      result.body = value
    },
    setHeader() {},
  }
  return { result, reply }
}

describe('verified signup alert fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUser.mockResolvedValue({
      data: {
        user: { id: 'u1', email: 'friend@example.com', email_confirmed_at: '2026-09-22T12:00:00Z' },
      },
      error: null,
    })
    receiptRead.mockResolvedValue({ data: null, error: null })
    queueRead.mockResolvedValue({ data: { id: 'n1' }, error: null })
    upsert.mockResolvedValue({ error: null })
    sendQueuedNotification.mockResolvedValue('sent')
  })

  it('rejects unauthenticated and unconfirmed requests', async () => {
    const noToken = response()
    await handler({ method: 'POST', headers: {} }, noToken.reply)
    expect(noToken.result.code).toBe(401)
    getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'friend@example.com', email_confirmed_at: null } },
      error: null,
    })
    const unconfirmed = response()
    await handler({ method: 'POST', headers: { authorization: 'Bearer token' } }, unconfirmed.reply)
    expect(unconfirmed.result.code).toBe(401)
    expect(upsert).not.toHaveBeenCalled()
  })

  it('queues only the Supabase-verified email and attempts delivery', async () => {
    const { result, reply } = response()
    await handler(
      {
        method: 'POST',
        headers: { authorization: 'Bearer token' },
        body: { email: 'attacker@example.com' },
      },
      reply,
    )
    expect(result.code).toBe(200)
    expect(getUser).toHaveBeenCalledWith('token')
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'friend@example.com', user_id: 'u1' }),
      expect.any(Object),
    )
    expect(sendQueuedNotification).toHaveBeenCalledWith('n1')
  })

  it('does not queue or email an account with a delivery receipt', async () => {
    receiptRead.mockResolvedValue({ data: { user_id: 'u1' }, error: null })
    const { result, reply } = response()
    await handler({ method: 'POST', headers: { authorization: 'Bearer token' } }, reply)
    expect(result.code).toBe(200)
    expect(upsert).not.toHaveBeenCalled()
    expect(sendQueuedNotification).not.toHaveBeenCalled()
  })

  it('keeps a failed delivery in the outbox for the daily retry', async () => {
    sendQueuedNotification.mockRejectedValue(new Error('provider unavailable'))
    const { result, reply } = response()
    await handler({ method: 'POST', headers: { authorization: 'Bearer token' } }, reply)
    expect(result.code).toBe(503)
    expect(upsert).toHaveBeenCalledOnce()
    expect(sendQueuedNotification).toHaveBeenCalledWith('n1')
  })
})
