// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeDemoData } from '../lib/defaults'
import { currentMonth } from '../lib/finance'
import type { PockitData } from '../types'
import { GoalsScreen } from './Goals'

afterEach(cleanup)

function setup() {
  let data: PockitData = makeDemoData()
  const update = (recipe: (value: PockitData) => PockitData) => {
    data = recipe(data)
  }
  const view = render(<GoalsScreen data={data} month={currentMonth()} update={update} />)
  return {
    get data() {
      return data
    },
    rerender: () =>
      view.rerender(<GoalsScreen data={data} month={currentMonth()} update={update} />),
  }
}

describe('goal input', () => {
  it('rejects empty, negative, and non-finite progress amounts', () => {
    const app = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Add progress' }))
    const amount = screen.getByLabelText('Amount') as HTMLInputElement
    const save = screen.getByRole('button', { name: 'Save progress' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.change(amount, { target: { value: '-50' } })
    expect(save.disabled).toBe(true)
    fireEvent.change(amount, { target: { value: '1e309' } })
    expect(save.disabled).toBe(true)
    expect(app.data.goals.find((goal) => goal.kind === 'saving')?.balance).toBe(2350)
  })

  it('records a valid contribution and keeps it in goal history', () => {
    const app = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Add progress' }))
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '25.50' } })
    fireEvent.change(screen.getByLabelText('Note (optional)'), {
      target: { value: 'Birthday money' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save progress' }))
    app.rerender()
    const goal = app.data.goals.find((item) => item.kind === 'saving')!
    expect(goal.balance).toBe(2375.5)
    expect(goal.history[0]).toMatchObject({ amount: 25.5, note: 'Birthday money' })
    expect(screen.getByText(/Birthday money/)).toBeTruthy()
  })

  it('rejects a debt payment larger than the recorded balance', () => {
    const app = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Record payment' }))
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '5000' } })
    expect(
      (screen.getByRole('button', { name: 'Save progress' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(screen.getByRole('alert').textContent).toMatch(/cannot exceed/)
    expect(app.data.goals.find((item) => item.kind === 'debt')?.balance).toBe(1850)
  })

  it('records goal progress and its linked Activity transaction together', () => {
    const app = setup()
    const before = app.data.transactions.length
    fireEvent.click(screen.getByRole('button', { name: 'Add progress' }))
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '75' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save progress' }))
    const goal = app.data.goals.find((item) => item.kind === 'saving')!
    const transaction = app.data.transactions.at(-1)!
    expect(app.data.transactions).toHaveLength(before + 1)
    expect(transaction).toMatchObject({ amount: 75, type: 'transfer', goalId: goal.id })
    expect(goal.history[0].transactionId).toBe(transaction.id)
  })
  it('lets a person inspect a projected balance by dragging the chart control', () => {
    setup()
    const slider = screen.getByRole('slider', {
      name: /Inspect Emergency fund projection/i,
    }) as HTMLInputElement
    expect(slider.value).toBe('0')
    fireEvent.change(slider, { target: { value: '2' } })
    expect(screen.getByText(/Month 2:/)).toBeTruthy()
  })
})
