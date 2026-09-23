import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendQueuedNotification } from './notifications'

const { rpc, remove, release, sendEmail } = vi.hoisted(() => ({
  rpc: vi.fn(),
  remove: vi.fn(),
  release: vi.fn(),
  sendEmail: vi.fn(),
}))
vi.mock('./supabase', () => ({
  adminClient: () => ({
    rpc,
    from: () => ({
      delete: () => ({ eq: remove }),
      update: () => ({ eq: release }),
    }),
  }),
}))
vi.mock('./email', () => ({
  sendEmail,
  signupEmail: () => ({ subject: 'signup' }),
  deletionEmail: () => ({ subject: 'deleted' }),
}))
vi.mock('./http', () => ({ requiredEnv: () => 'owner@example.com' }))

describe('notification outbox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    remove.mockResolvedValue({ error: null })
    release.mockResolvedValue({ error: null })
    sendEmail.mockResolvedValue(undefined)
  })

  it('sends a signup alert to the owner and clears the outbox row', async () => {
    rpc.mockResolvedValue({
      data: [
        { id: 'n1', kind: 'signup', email: 'user@example.com', event_at: '2026-09-22T00:00:00Z' },
      ],
      error: null,
    })
    expect(await sendQueuedNotification('n1')).toBe('sent')
    expect(sendEmail).toHaveBeenCalledWith('owner@example.com', { subject: 'signup' })
    expect(remove).toHaveBeenCalledWith('id', 'n1')
  })

  it('sends a deletion receipt to the former user', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          id: 'n2',
          kind: 'account_deleted',
          email: 'former@example.com',
          event_at: '2026-09-22T00:00:00Z',
        },
      ],
      error: null,
    })
    expect(await sendQueuedNotification('n2')).toBe('sent')
    expect(sendEmail).toHaveBeenCalledWith('former@example.com', { subject: 'deleted' })
  })

  it('releases failed mail for a later retry', async () => {
    rpc.mockResolvedValue({
      data: [
        { id: 'n3', kind: 'signup', email: 'user@example.com', event_at: '2026-09-22T00:00:00Z' },
      ],
      error: null,
    })
    sendEmail.mockRejectedValue(new Error('provider unavailable'))
    await expect(sendQueuedNotification('n3')).rejects.toThrow('provider unavailable')
    expect(release).toHaveBeenCalledWith('id', 'n3')
    expect(remove).not.toHaveBeenCalled()
  })

  it('skips a row another worker already claimed', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    expect(await sendQueuedNotification('n4')).toBe('busy')
    expect(sendEmail).not.toHaveBeenCalled()
  })
})
