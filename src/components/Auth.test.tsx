// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Auth } from './Auth'

const { updateUser } = vi.hoisted(() => ({ updateUser: vi.fn() }))
vi.mock('../lib/storage', () => ({ supabase: { auth: { updateUser } } }))

afterEach(() => {
  cleanup()
  updateUser.mockReset()
})

describe('password recovery', () => {
  it('requires matching passwords before updating the account', () => {
    render(<Auth onDemo={vi.fn()} recovery onRecovered={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpassword' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'differentpassword' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save new password/i }))
    expect(screen.getByRole('status').textContent).toMatch(/do not match/i)
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
