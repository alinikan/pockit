import { beforeEach, describe, expect, it, vi } from 'vitest'
import handler from './delete-account'
import type { ApiResponse } from '../server/http'

const { getUser, signInWithPassword, deleteUser, from, sendQueuedNotification } = vi.hoisted(
  () => ({
    getUser: vi.fn(),
    signInWithPassword: vi.fn(),
    deleteUser: vi.fn(),
    from: vi.fn(),
    sendQueuedNotification: vi.fn(),
  }),
)
vi.mock('../server/supabase', () => ({
  adminClient: () => ({ auth: { getUser, admin: { deleteUser } }, from }),
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { signInWithPassword } }),
}))
vi.mock('../server/notifications', () => ({ sendQueuedNotification }))

function mockResponse() {
  let status = 200
  let body: unknown
  const response: ApiResponse = {
    status(code) {
      status = code
      return this
    },
    json(value) {
      body = value
    },
    setHeader() {},
  }
  return { response, result: () => ({ status, body }) }
}

describe('account deletion endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('SUPABASE_URL', 'https://sample.supabase.co')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_sample')
    getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user@example.com' } },
      error: null,
    })
    signInWithPassword.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    deleteUser.mockResolvedValue({ error: null })
    sendQueuedNotification.mockResolvedValue('sent')
    from.mockReturnValue({
      select: () => ({
        limit: () => Promise.resolve({ error: null }),
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: { id: 'receipt-1' }, error: null }),
          }),
        }),
      }),
    })
  })

  it('rejects a bad password before deleting anyone', async () => {
    signInWithPassword.mockResolvedValue({ data: { user: null }, error: new Error('bad password') })
    const { response, result } = mockResponse()
    await handler(
      {
        method: 'POST',
        headers: { authorization: 'Bearer access-token' },
        body: { password: 'wrong' },
      },
      response,
    )
    expect(result().status).toBe(403)
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('deletes only the user identified by the validated token', async () => {
    const { response, result } = mockResponse()
    await handler(
      {
        method: 'POST',
        headers: { authorization: 'Bearer access-token' },
        body: { password: 'correct' },
      },
      response,
    )
    expect(deleteUser).toHaveBeenCalledWith('user-1')
    expect(sendQueuedNotification).toHaveBeenCalledWith('receipt-1')
    expect(result()).toEqual({ status: 200, body: { deleted: true, emailPending: false } })
  })
})
