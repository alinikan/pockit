// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { PockitData } from '../types'
import { makeDemoData } from '../lib/defaults'
import { currentMonth } from '../lib/finance'
import { WhatIfLab } from './WhatIfLab'

afterEach(cleanup)
function setup(initial = makeDemoData()) {
  let data = initial
  const update = (recipe: (current: PockitData) => PockitData) => {
    data = recipe(data)
  }
  const view = render(<WhatIfLab data={data} month={currentMonth()} update={update} />)
  return {
    get data() {
      return data
    },
    rerender: () => view.rerender(<WhatIfLab data={data} month={currentMonth()} update={update} />),
    change: (recipe: (current: PockitData) => PockitData) => {
      data = recipe(data)
    },
  }
}
function choose(name: RegExp) {
  if (!screen.queryByRole('button', { name }))
    fireEvent.click(screen.getByRole('button', { name: 'Change idea' }))
  fireEvent.click(screen.getByRole('button', { name }))
}
describe('guided What-if Lab', () => {
  it('starts with questions, not a wall of inputs or a disabled unexplained review button', () => {
    setup()
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(6)
    expect(screen.queryByRole('spinbutton')).toBeNull()
    expect(screen.queryByRole('button', { name: /Review recurring changes/ })).toBeNull()
    expect(screen.getByText(/Start with a question above/)).toBeTruthy()
  })
  it('shows only the controls and outcomes for the chosen question', () => {
    const app = setup()
    const original = JSON.stringify(app.data)
    choose(/Save faster/)
    fireEvent.change(screen.getByLabelText('Extra to a savings goal each month'), {
      target: { value: '50' },
    })
    expect(screen.getByText(/Time to reach Emergency fund/)).toBeTruthy()
    expect(screen.queryByLabelText('Extra debt payment each month')).toBeNull()
    expect(JSON.stringify(app.data)).toBe(original)
    choose(/Handle a surprise cost/)
    expect(screen.queryByLabelText('Savings goal')).toBeNull()
    expect(screen.queryByText(/Time to reach Emergency fund/)).toBeNull()
  })
  it('marks one-time and interest scenarios as previews without an unusable apply button', () => {
    const app = setup()
    const before = JSON.stringify(app.data)
    choose(/Handle a surprise cost/)
    fireEvent.change(screen.getByLabelText('One-time surprise expense'), {
      target: { value: '900' },
    })
    expect(screen.getByText('Preview only')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Review recurring changes/ })).toBeNull()
    choose(/Test a higher debt rate/)
    fireEvent.change(screen.getByLabelText('Interest rate rise (percentage points)'), {
      target: { value: '2' },
    })
    expect(screen.getByText('Preview only')).toBeTruthy()
    expect(JSON.stringify(app.data)).toBe(before)
  })
  it('allows reviewing a shortfall and explains why saving it is blocked', () => {
    setup()
    choose(/Pay debt sooner/)
    fireEvent.change(screen.getByLabelText('Extra debt payment each month'), {
      target: { value: '999999' },
    })
    const review = screen.getByRole('button', {
      name: /Review recurring changes/,
    }) as HTMLButtonElement
    expect(review.disabled).toBe(false)
    fireEvent.click(review)
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('alert').textContent).toMatch(/exceeds/)
    expect(
      (within(dialog).getByRole('button', { name: 'Apply recurring plan' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
  })
  it('rejects negative, excessive, and non-finite extras', () => {
    setup()
    choose(/Save faster/)
    for (const value of ['-1', '1000001']) {
      fireEvent.change(screen.getByLabelText('Extra to a savings goal each month'), {
        target: { value },
      })
      expect(screen.getByRole('alert')).toBeTruthy()
      expect(screen.queryByRole('button', { name: /Review recurring changes/ })).toBeNull()
    }
  })
  it('turns a goal deadline into an editable extra monthly contribution', () => {
    setup()
    choose(/Save faster/)
    fireEvent.change(screen.getByLabelText('Reach this goal in (months)'), {
      target: { value: '6' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Try this monthly amount' }))
    expect(
      Number(
        (screen.getByLabelText('Extra to a savings goal each month') as HTMLInputElement).value,
      ),
    ).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Review recurring changes/ })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Reach this goal in (months)'), {
      target: { value: '2.5' },
    })
    fireEvent.click(screen.getByText('Have a target date in mind?'))
    expect(screen.getByRole('alert').textContent).toMatch(/whole number/)
  })
  it('explains missing goals, debt and pay configuration', () => {
    const data = makeDemoData()
    setup({ ...data, goals: [], profile: { ...data.profile, payAmount: 0 } })
    for (const name of [/Save faster/, /Pay debt sooner/, /Miss a paycheque/]) {
      choose(name)
      expect(screen.getByRole('status')).toBeTruthy()
      expect(screen.queryByRole('spinbutton')).toBeNull()
    }
  })
  it('applies once through review and protects subsequent edits from undo', () => {
    const app = setup()
    choose(/Pay debt sooner/)
    fireEvent.change(screen.getByLabelText('Extra debt payment each month'), {
      target: { value: '50' },
    })
    choose(/Review recurring changes/)
    fireEvent.click(screen.getByRole('button', { name: 'Apply recurring plan' }))
    app.rerender()
    expect(app.data.debtPlan?.extra).toBe(50)
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy()
    app.change((data) => ({
      ...data,
      goals: data.goals.map((goal) => ({ ...goal, balance: goal.balance + 1 })),
    }))
    app.rerender()
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
    expect(screen.getByRole('status').textContent).toMatch(/since changed/)
  })
})
