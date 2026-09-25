// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { PockitData } from '../types'
import { currentMonth } from '../lib/finance'
import { makeDemoData } from '../lib/defaults'
import { ActivityScreen } from './Activity'

afterEach(cleanup)

describe('activity', () => {
  it('opens quick add only for a fresh request and consumes that request', () => {
    const data = makeDemoData()
    const consumed = vi.fn()
    const first = render(
      <ActivityScreen
        data={data}
        month={currentMonth()}
        update={() => {}}
        quickAdd={1}
        onQuickAddConsumed={consumed}
      />,
    )
    expect(screen.getByRole('dialog', { name: 'New transaction' })).toBeTruthy()
    expect(consumed).toHaveBeenCalledOnce()
    first.unmount()
    render(
      <ActivityScreen
        data={data}
        month={currentMonth()}
        update={() => {}}
        quickAdd={0}
        onQuickAddConsumed={consumed}
      />,
    )
    expect(screen.queryByRole('dialog', { name: 'New transaction' })).toBeNull()
  })
  it('suggests a category and saves a transaction', () => {
    let data: PockitData = makeDemoData()
    const update = (recipe: (value: PockitData) => PockitData) => {
      data = recipe(data)
    }
    const { rerender } = render(
      <ActivityScreen data={data} month={currentMonth()} update={update} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /add transaction/i }))
    fireEvent.change(screen.getByPlaceholderText('e.g. Fresh Market'), {
      target: { value: 'Costco' },
    })
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '24.50' } })
    expect(
      (screen.getByLabelText('Category') as HTMLSelectElement).selectedOptions[0].textContent,
    ).toBe('Groceries')
    fireEvent.click(screen.getByRole('button', { name: 'Save transaction' }))
    rerender(<ActivityScreen data={data} month={currentMonth()} update={update} />)
    expect(data.transactions.at(-1)).toMatchObject({
      payee: 'Costco',
      amount: 24.5,
      type: 'expense',
    })
    expect(screen.getByRole('button', { name: /Costco Groceries.*24.50/ })).toBeTruthy()
  })

  it('requires a payee, positive finite amount, and valid date before saving', () => {
    let data = makeDemoData()
    render(
      <ActivityScreen
        data={data}
        month={currentMonth()}
        update={(recipe) => {
          data = recipe(data)
        }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /add transaction/i }))
    const save = screen.getByRole('button', { name: 'Save transaction' }) as HTMLButtonElement
    const payee = screen.getByLabelText('Payee or description')
    const amount = screen.getByLabelText('Amount')
    const date = screen.getByLabelText('Date')
    expect(save.disabled).toBe(true)
    fireEvent.change(payee, { target: { value: '   ' } })
    fireEvent.change(amount, { target: { value: '18' } })
    expect(save.disabled).toBe(true)
    fireEvent.change(payee, { target: { value: 'A shop' } })
    fireEvent.change(amount, { target: { value: '-18' } })
    expect(save.disabled).toBe(true)
    fireEvent.change(amount, { target: { value: '1e309' } })
    expect(save.disabled).toBe(true)
    fireEvent.change(amount, { target: { value: '18' } })
    fireEvent.change(date, { target: { value: '' } })
    expect(save.disabled).toBe(true)
    expect(data.transactions).toHaveLength(20)
    fireEvent.change(date, { target: { value: `${currentMonth()}-20` } })
    expect(save.disabled).toBe(false)
  })

  it('filters transaction types, searches payees, sorts, and resets the view', () => {
    const data = makeDemoData()
    const { container } = render(
      <ActivityScreen data={data} month={currentMonth()} update={() => {}} />,
    )
    const names = () =>
      [...container.querySelectorAll('.transaction-name strong')].map((node) => node.textContent)
    fireEvent.click(screen.getByRole('button', { name: /^Transfer 1$/ }))
    expect(names()).toEqual(['Savings transfer'])
    fireEvent.click(screen.getByRole('button', { name: /^Expense 11$/ }))
    fireEvent.change(screen.getByPlaceholderText('Search transactions'), {
      target: { value: 'market' },
    })
    expect(names()).toEqual(['Fresh Market'])
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(names()).toHaveLength(14)
    fireEvent.change(screen.getByLabelText('Sort transactions'), { target: { value: 'highest' } })
    expect(names()[0]).toBe('Paycheque')
    fireEvent.change(screen.getByLabelText('Filter category'), {
      target: { value: data.categories.find((c) => c.name === 'Groceries')!.id },
    })
    expect(names()).toEqual(['Costco', 'Superstore', 'Fresh Market'])
  })
  it('records a refund and offers date shortcuts without requiring a second refund checkbox', () => {
    let data = makeDemoData()
    const update = (recipe: (value: PockitData) => PockitData) => {
      data = recipe(data)
    }
    render(<ActivityScreen data={data} month={currentMonth()} update={update} />)
    fireEvent.click(screen.getByRole('button', { name: /add transaction/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Refund' }))
    fireEvent.change(screen.getByLabelText('Payee or description'), {
      target: { value: 'Returned shoes' },
    })
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '45' } })
    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
    const today = new Date()
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe(date)
    fireEvent.click(screen.getByRole('button', { name: 'Save transaction' }))
    expect(data.transactions.at(-1)).toMatchObject({
      type: 'expense',
      refund: true,
      amount: 45,
      date,
    })
  })
  it('keeps comma-separated tags while typing and finds the saved transaction by tag', () => {
    let data = makeDemoData()
    const update = (recipe: (value: PockitData) => PockitData) => {
      data = recipe(data)
    }
    const view = () => <ActivityScreen data={data} month={currentMonth()} update={update} />
    const { rerender, container } = render(view())
    fireEvent.click(screen.getByRole('button', { name: /add transaction/i }))
    fireEvent.change(screen.getByLabelText('Payee or description'), {
      target: { value: 'Office supplies' },
    })
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '18' } })
    const tags = screen.getByLabelText(/Tags \(optional\)/) as HTMLInputElement
    fireEvent.change(tags, { target: { value: 'work,' } })
    expect(tags.value).toBe('work,')
    fireEvent.change(tags, { target: { value: 'work, reimbursable' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save transaction' }))
    expect(data.transactions.at(-1)?.tags).toEqual(['work', 'reimbursable'])
    rerender(view())
    fireEvent.change(screen.getByPlaceholderText('Search transactions'), {
      target: { value: 'reimbursable' },
    })
    expect(container.querySelectorAll('.transaction-row')).toHaveLength(1)
  })
})
