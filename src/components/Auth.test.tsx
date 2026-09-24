// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Auth } from './Auth'

const { updateUser, signInWithPasskey, signUp, resetPasswordForEmail } = vi.hoisted(() => ({
  updateUser: vi.fn(),
  signInWithPasskey: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}))
vi.mock('../lib/storage', () => ({
  supabase: { auth: { updateUser, signInWithPasskey, signUp, resetPasswordForEmail } },
}))

afterEach(() => {
  cleanup()
  updateUser.mockReset()
  signInWithPasskey.mockReset()
  signUp.mockReset()
  resetPasswordForEmail.mockReset()
  vi.unstubAllGlobals()
})

describe('email notices', () => {
  it('shows confirmation as success rather than an error', async () => {
    signUp.mockResolvedValue({ data: { session: null }, error: null })
    render(<Auth onDemo={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Alex' } })
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'alex@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /create my account/i }))
    expect((await screen.findByRole('status')).className).toContain('success')
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('passkey sign-in', () => {
  it('lets a supported device start the passkey ceremony while keeping password sign-in', async () => {
    vi.stubGlobal('isSecureContext', true)
    vi.stubGlobal('PublicKeyCredential', class {})
    signInWithPasskey.mockResolvedValue({ data: { session: {}, user: {} }, error: null })
    render(<Auth onDemo={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /already have an account/i }))
    expect(screen.getByLabelText('Password')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /sign in with a passkey/i }))
    await waitFor(() => expect(signInWithPasskey).toHaveBeenCalledOnce())
  })
})

describe('password recovery', () => {
  it('requires matching passwords before updating the account', () => {
    render(<Auth onDemo={vi.fn()} recovery onRecovered={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpassword' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'differentpassword' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save new password/i }))
    expect(screen.getByRole('alert').textContent).toMatch(/do not match/i)
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('updates the password and completes recovery', async () => {
    const onRecovered = vi.fn()
    updateUser.mockResolvedValue({ error: null })
    render(<Auth onDemo={vi.fn()} recovery onRecovered={onRecovered} />)
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpassword' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'newpassword' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save new password/i }))
    await waitFor(() => expect(onRecovered).toHaveBeenCalledOnce())
    expect(updateUser).toHaveBeenCalledWith({ password: 'newpassword' })
  })
})
