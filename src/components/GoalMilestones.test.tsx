// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GoalMilestones } from './GoalMilestones'
import { setMoneyPrivacy } from '../lib/finance'
import type { Goal } from '../types'
const goal: Goal = {
  id: 'a',
  kind: 'saving',
  name: 'Trip',
  balance: 100,
  target: 1000,
  monthly: 100,
  annualInterest: 0,
  color: '#abc',
  icon: 'Flag',
  history: [],
}
afterEach(() => {
  cleanup()
  setMoneyPrivacy(false)
})
it('keeps the explorer optional and lets users inspect checkpoints without changing data', () => {
  const before = structuredClone(goal)
  const view = render(<GoalMilestones goal={goal} />)
  const details = view.container.querySelector('details')!
  expect(details.open).toBe(false)
  fireEvent.click(view.container.querySelector('summary')!)
  expect(details.open).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '50% milestone' }))
  expect(screen.getByRole('button', { name: '50% milestone' }).getAttribute('aria-pressed')).toBe(
    'true',
  )
  expect(view.container.querySelector('.milestone-detail')?.textContent).toContain('$500.00')
  expect(view.container.querySelector('.milestone-detail')?.textContent).toContain('about 4 months')
  expect(goal).toEqual(before)
})
it('updates checkpoint amounts when the real goal balance changes', () => {
  const view = render(<GoalMilestones goal={goal} />)
  view.rerender(<GoalMilestones goal={{ ...goal, balance: 600 }} />)
  expect(screen.getByText('Next milestone · 75%')).toBeTruthy()
  expect(view.container.querySelector('.milestone-detail')?.textContent).toContain('$150.00 more')
})
it('honours hidden amounts in the summary and expanded preview', () => {
  setMoneyPrivacy(true)
  const view = render(<GoalMilestones goal={goal} />)
  expect(view.container.textContent).not.toContain('$')
  expect(view.container.textContent).toContain('••••')
})
it('explains how to get an estimate when no monthly contribution exists', () => {
  const view = render(<GoalMilestones goal={{ ...goal, monthly: 0 }} />)
  expect(view.container.textContent).toContain('Set a monthly amount to estimate when.')
})
it('shows completion and omits inappropriate goal kinds', () => {
  const view = render(<GoalMilestones goal={{ ...goal, balance: 1000 }} />)
  expect(screen.getByText('Goal reached')).toBeTruthy()
  view.rerender(<GoalMilestones goal={{ ...goal, kind: 'debt' }} />)
  expect(view.container.children).toHaveLength(0)
})
