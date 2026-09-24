// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { makeInitialData } from '../lib/defaults'
import { Onboarding } from './Onboarding'

afterEach(cleanup)

describe('onboarding', () => {
  it('keeps the completed plan separate from the check icon', () => {
    const data = makeInitialData()
    data.onboardingStep = 8
    data.profile.payAmount = 2000
    render(<Onboarding initial={data} onDone={vi.fn()} />)
    expect(screen.getByText('You’re all set.')).toBeTruthy()
    const preview = screen.getByLabelText('Starting monthly plan')
    expect(preview.className).toBe('onboarding-plan-preview')
    expect(preview.parentElement?.querySelector('.finish-icon')).toBeTruthy()
    expect(preview.textContent).toMatch(/Suggested category plan/)
  })
  it('saves the current step and goal details, then resumes them on sign-in', async () => {
    const saves: ReturnType<typeof makeInitialData>[] = []
    const onSave = vi.fn(async (draft: ReturnType<typeof makeInitialData>) => {
      saves.push(draft)
    })
    const initial = { ...makeInitialData('Sam'), onboardingStep: 5 }
    const first = render(<Onboarding initial={initial} onDone={vi.fn()} onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: /credit card/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByRole('heading', { name: /add a few numbers/i })
    fireEvent.change(screen.getByLabelText('Balance owed'), { target: { value: '1800' } })
    fireEvent.change(screen.getByLabelText('Monthly payment'), { target: { value: '150' } })
    fireEvent.change(screen.getByLabelText('Annual interest %'), {
      target: { value: '19.99' },
    })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByRole('heading', { name: /make your money easier/i })
    const saved = saves.at(-1)!
    expect(saved.onboardingStep).toBe(7)
    expect(saved.goals[0]).toMatchObject({
      name: 'Credit card',
      balance: 1800,
      monthly: 150,
      annualInterest: 19.99,
    })
    first.unmount()

    render(<Onboarding initial={saved} onDone={vi.fn()} onSave={onSave} />)
    expect(screen.getByRole('heading', { name: /make your money easier/i })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    await waitFor(() =>
      expect(screen.getByLabelText('Balance owed')).toHaveProperty('value', '1800'),
    )
    expect(screen.getByLabelText('Monthly payment')).toHaveProperty('value', '150')
  })

  it('stays on the current step if the cloud save fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Network unavailable'))
    render(<Onboarding initial={makeInitialData('Sam')} onDone={vi.fn()} onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByRole('alert')
    expect(screen.getByRole('heading', { name: /what brings you to pockit/i })).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toMatch(/could not be saved/i)
  })

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
