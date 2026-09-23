// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PasskeySettings } from './Passkeys'

const { list, registerPasskey, remove } = vi.hoisted(() => ({
  list: vi.fn(),
  registerPasskey: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('../lib/storage', () => ({
  supabase: { auth: { registerPasskey, passkey: { list, delete: remove } } },
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('passkey management', () => {
  it('registers a passkey and lets its owner remove it', async () => {
    vi.stubGlobal('isSecureContext', true)
    vi.stubGlobal('PublicKeyCredential', class {})
    list.mockResolvedValueOnce({ data: [], error: null })
    list.mockResolvedValueOnce({
      data: [{ id: 'key-1', friendly_name: 'iCloud Keychain', created_at: '2026-09-22T00:00:00Z' }],
      error: null,
    })
    registerPasskey.mockResolvedValue({ data: { id: 'key-1' }, error: null })
    remove.mockResolvedValue({ data: null, error: null })
    render(<PasskeySettings />)
    fireEvent.click(screen.getByRole('button', { name: /add a passkey/i }))
    await waitFor(() => expect(screen.getByText('iCloud Keychain')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /remove icloud keychain/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm remove/i }))
    await waitFor(() => expect(remove).toHaveBeenCalledWith({ passkeyId: 'key-1' }))
    expect(screen.queryByText('iCloud Keychain')).toBeNull()
  })
})
