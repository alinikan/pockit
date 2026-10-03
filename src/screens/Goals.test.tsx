// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeDemoData } from '../lib/defaults'
import { changeTransaction } from '../lib/linked'
import { accountBalance } from '../lib/ledger'
import { currentMonth, todayISO } from '../lib/finance'
import { goalChartData } from '../lib/goalChart'
import type { PockitData } from '../types'
import { GoalsScreen } from './Goals'

afterEach(cleanup)

function setup(initial = makeDemoData()) {
  let data: PockitData = initial
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
    fireEvent.click(screen.getByRole('button', { name: /Save money/ }))
    const amount = screen.getByLabelText('Amount') as HTMLInputElement
    const save = screen.getByRole('button', { name: 'Save contribution' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.change(amount, { target: { value: '-50' } })
    expect(save.disabled).toBe(true)
    fireEvent.change(amount, { target: { value: '0.001' } })
    expect(save.disabled).toBe(true)
    fireEvent.change(amount, { target: { value: '1e309' } })
    expect(save.disabled).toBe(true)
    expect(app.data.goals.find((goal) => goal.kind === 'saving')?.balance).toBe(2350)
  })

  it('records a valid contribution and keeps it in goal history', () => {
    const app = setup()
    fireEvent.click(screen.getByRole('button', { name: /Save money/ }))
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '25.50' } })
    fireEvent.change(screen.getByLabelText('Note (optional)'), {
      target: { value: 'Birthday money' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save contribution' }))
    app.rerender()
    const goal = app.data.goals.find((item) => item.kind === 'saving')!
    expect(goal.balance).toBe(2375.5)
    expect(goal.history[0]).toMatchObject({ amount: 25.5, note: 'Birthday money' })
    expect(screen.getByText(/Birthday money/)).toBeTruthy()
  })

  it('rejects a debt payment larger than the recorded balance', () => {
    const app = setup()
    fireEvent.click(screen.getByRole('button', { name: /Record payment/ }))
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '5000' } })
    expect(
      (screen.getByRole('button', { name: 'Save payment' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(screen.getByRole('alert').textContent).toMatch(/cannot exceed/)
    expect(app.data.goals.find((item) => item.kind === 'debt')?.balance).toBe(1850)
  })

  it('records goal progress and its linked Activity transaction together', () => {
    const app = setup()
    const before = app.data.transactions.length
    fireEvent.click(screen.getByRole('button', { name: /Save money/ }))
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '75' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save contribution' }))
    const goal = app.data.goals.find((item) => item.kind === 'saving')!
    const transaction = app.data.transactions.at(-1)!
    expect(app.data.transactions).toHaveLength(before + 1)
    expect(transaction).toMatchObject({ amount: 75, type: 'transfer', goalId: goal.id })
    expect(goal.history[0].transactionId).toBe(transaction.id)
  })
  it('records both sides of a savings transfer once, including investment allocation', () => {
    const initial = makeDemoData()
    initial.accounts = [
      {
        id: 'chequing',
        name: 'Chequing',
        kind: 'chequing',
        openingBalance: 1000,
        asOf: '2025-01-01',
      },
      {
        id: 'tfsa',
        name: 'TFSA',
        kind: 'investment',
        subtype: 'TFSA',
        openingBalance: 500,
        asOf: '2025-01-01',
        contributionCategoryId: initial.categories[0].id,
      },
    ]
    const app = setup(initial)
    fireEvent.click(screen.getByRole('button', { name: /Save money/ }))
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '50' } })
    fireEvent.change(screen.getByLabelText('From account'), { target: { value: 'chequing' } })
    fireEvent.change(screen.getByLabelText('To account'), { target: { value: 'tfsa' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save contribution' }))
    const transaction = app.data.transactions.at(-1)!
    expect(transaction).toMatchObject({
      accountId: 'chequing',
      toAccountId: 'tfsa',
      categoryId: initial.categories[0].id,
      type: 'transfer',
    })
    expect(accountBalance(app.data.accounts![0], app.data.transactions)).toBe(950)
    expect(accountBalance(app.data.accounts![1], app.data.transactions)).toBe(550)
    expect(app.data.goals.find((goal) => goal.kind === 'saving')!.balance).toBe(2400)
    const edited = changeTransaction(app.data, transaction, { ...transaction, amount: 75 })
    expect(edited.goals.find((goal) => goal.kind === 'saving')!.balance).toBe(2425)
    expect(edited.transactions).toHaveLength(app.data.transactions.length)
  })
  it('clears the destination when the source changes to the same account', () => {
    const initial = makeDemoData()
    initial.accounts = ['a', 'b'].map((id) => ({
      id,
      name: id,
      kind: 'savings',
      openingBalance: 0,
      asOf: '2025-01-01',
    }))
    setup(initial)
    fireEvent.click(screen.getByRole('button', { name: /Save money/ }))
    fireEvent.change(screen.getByLabelText('To account'), { target: { value: 'b' } })
    fireEvent.change(screen.getByLabelText('From account'), { target: { value: 'b' } })
    expect((screen.getByLabelText('To account') as HTMLSelectElement).value).toBe('')
    expect(
      Array.from((screen.getByLabelText('To account') as HTMLSelectElement).options).some(
        (option) => option.value === 'b',
      ),
    ).toBe(false)
  })
  it('records spending against the chosen category, savings goal and account together', () => {
    const initial = makeDemoData()
    initial.accounts = [
      {
        id: 'savings',
        name: 'Savings account',
        kind: 'savings',
        openingBalance: 2350,
        asOf: '2025-01-01',
      },
    ]
    const app = setup(initial)
    fireEvent.click(screen.getByRole('button', { name: /Spend saved money/ }))
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '120' } })
    fireEvent.change(screen.getByLabelText('Spending category'), {
      target: { value: initial.categories[0].id },
    })
    fireEvent.change(screen.getByLabelText('Paid from account'), { target: { value: 'savings' } })
    expect(screen.queryByLabelText('To account')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Save expense' }))
    const tx = app.data.transactions.at(-1)!
    expect(tx).toMatchObject({
      type: 'expense',
      amount: 120,
      accountId: 'savings',
      categoryId: initial.categories[0].id,
    })
    expect(app.data.goals.find((goal) => goal.kind === 'saving')!.balance).toBe(2230)
    expect(app.data.goals.find((goal) => goal.kind === 'saving')!.history[0].amount).toBe(-120)
    expect(accountBalance(app.data.accounts![0], app.data.transactions)).toBe(2230)
  })
  it('rejects future and missing dates, and spending beyond the saved balance', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /Spend saved money/ }))
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '2400' } })
    const save = screen.getByRole('button', { name: 'Save expense' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2099-01-01' } })
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '' } })
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: todayISO() } })
    expect(save.disabled).toBe(false)
  })
  it('offers a clearly optional goal-only adjustment without changing accounts or Activity', () => {
    const app = setup()
    const before = app.data.transactions.length
    fireEvent.click(screen.getByRole('button', { name: /Save money/ }))
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '10' } })
    fireEvent.click(screen.getByLabelText('Save a linked transfer in Activity'))
    fireEvent.click(screen.getByRole('button', { name: 'Save contribution' }))
    expect(app.data.transactions).toHaveLength(before)
    expect(app.data.goals.find((goal) => goal.kind === 'saving')!.balance).toBe(2360)
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
