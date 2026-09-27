// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeDemoData } from '../lib/defaults'
import { currentMonth } from '../lib/finance'
import { goalChartData } from '../lib/goalChart'
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
    const chart = screen.getByRole('button', { name: /Inspect Emergency fund projection/i })
    expect(chart.querySelector('linearGradient')).toBeTruthy()
    expect(chart.querySelector('polygon')).toBeTruthy()
    expect(chart.querySelector('line[stroke-dasharray="3 4"]')).toBeTruthy()
    fireEvent.keyDown(chart, { key: 'ArrowRight' })
    expect(screen.getByText(/Month 1 ·/)).toBeTruthy()
    Object.defineProperty(chart, 'getBoundingClientRect', {
      value: () => ({ left: 0, width: 320 }),
    })
    fireEvent(chart, new MouseEvent('pointerdown', { bubbles: true, clientX: 160 }))
    const goal = makeDemoData().goals.find((item) => item.name === 'Emergency fund')!
    expect(
      screen.getByText(new RegExp(`Month ${Math.round(goalChartData(goal).months / 2)} ·`)),
    ).toBeTruthy()
    fireEvent(chart, new MouseEvent('pointerup', { bubbles: true, clientX: 160 }))
    expect(chart.parentElement?.querySelector('.goal-chart-readout')?.textContent).toContain(
      'Today',
    )
  })
})
