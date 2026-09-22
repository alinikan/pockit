// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeInitialData } from '../lib/defaults'
import { Onboarding } from './Onboarding'

afterEach(cleanup)

describe('onboarding', () => {
  it('requires pay, housing and transport, then creates matching categories', () => {
    const done = vi.fn()
    render(<Onboarding initial={makeInitialData('Sam')} onDone={done} />)
    fireEvent.click(screen.getByRole('button', { name: /get out of debt/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByRole('alert').textContent).toMatch(/take-home pay/i)
    fireEvent.change(screen.getByPlaceholderText('2,500'), { target: { value: '1200' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByRole('alert').textContent).toMatch(/where you live/i)
    fireEvent.click(screen.getByRole('button', { name: /i rent/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByRole('alert').textContent).toMatch(/get around/i)
    fireEvent.click(screen.getByRole('button', { name: /^car$/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /gym/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /credit card/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByText('Credit card')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /open my pockit/i }))
    expect(done).toHaveBeenCalledOnce()
    const result = done.mock.calls[0][0]
    expect(result.onboarded).toBe(true)
    expect(result.goals).toHaveLength(1)
    expect(result.categories.map((c: { name: string }) => c.name)).toEqual(
      expect.arrayContaining(['Rent', 'Car Payment', 'Gym', 'Debt Payments']),
    )
  })
})
