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
    const notice = await screen.findByRole('status')
    expect(notice.className).toContain('success')
    expect(notice.textContent).toMatch(/if this email is new to pockit/i)
    expect(screen.getByRole('button', { name: 'Sign in instead' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reset password' })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('handles an obfuscated existing account without claiming an email was sent', async () => {
    signUp.mockResolvedValue({
      data: { user: { identities: [] }, session: null },
      error: null,
    })
    render(<Auth onDemo={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Alex' } })
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'alex@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create my account' }))
    expect((await screen.findByRole('status')).textContent).toMatch(/already have an account/i)
    fireEvent.click(screen.getByRole('button', { name: 'Sign in instead' }))
    expect(screen.getByRole('heading', { name: 'Welcome back.' })).toBeTruthy()
    expect((screen.getByLabelText('Email address') as HTMLInputElement).value).toBe(
      'alex@example.com',
    )
    expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('offers reset for an explicit duplicate error without a second signup request', async () => {
    signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: 'user_already_exists', message: 'User already registered' },
    })
    render(<Auth onDemo={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Alex' } })
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'alex@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create my account' }))
    await screen.findByRole('status')
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }))
    expect(screen.getByRole('heading', { name: 'Reset your password.' })).toBeTruthy()
    expect((screen.getByLabelText('Email address') as HTMLInputElement).value).toBe(
      'alex@example.com',
    )
    expect(signUp).toHaveBeenCalledOnce()
  })

  it('keeps unrelated signup failures visible as errors', async () => {
    signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: new Error('Please try again later.'),
    })
    render(<Auth onDemo={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Alex' } })
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'alex@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create my account' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/try again later/i)
    expect(screen.queryByRole('button', { name: 'Sign in instead' })).toBeNull()
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
