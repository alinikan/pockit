// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { PockitData } from '../types'
import { makeDemoData } from '../lib/defaults'
import { currentMonth, monthSummary } from '../lib/finance'
import { CalendarScreen } from './Calendar'

afterEach(cleanup)

describe('calendar', () => {
  it('moves between months from the calendar header', () => {
    let month: `${number}-${number}` = '2026-09'
    const data = makeDemoData()
    const view = () => (
      <CalendarScreen
        data={data}
        month={month}
        setMonth={(next) => {
          month = next
        }}
        update={() => {}}
      />
    )
    const { rerender } = render(view())
    fireEvent.click(screen.getByRole('button', { name: 'Previous calendar month' }))
    rerender(view())
    expect(screen.getByText('August 2026')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Next calendar month' }))
    rerender(view())
    expect(screen.getByText('September 2026')).toBeTruthy()
  })

  it('records a projected repeat once, then counts only the real transaction', () => {
    let data = makeDemoData()
    data = {
      ...data,
      transactions: [
        {
          id: 'seed',
          date: '2026-09-04',
          payee: 'Weekly class',
          amount: 25,
          type: 'expense',
          recurrence: 'weekly',
        },
      ],
    }
    const update = (recipe: (value: PockitData) => PockitData) => {
      data = recipe(data)
    }
    const { rerender } = render(<CalendarScreen data={data} month="2026-10" update={update} />)
    expect(monthSummary(data, '2026-10').spent).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: /^2$/ }))
    expect(screen.getByText(/Planned weekly repeat/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Record transaction' }))
    rerender(<CalendarScreen data={data} month="2026-10" update={update} />)
    expect(data.transactions.find((entry) => entry.recurrenceId === 'seed')?.date).toBe(
      '2026-10-02',
    )
    expect(monthSummary(data, '2026-10').spent).toBe(25)
    expect(screen.queryByRole('button', { name: 'Record transaction' })).toBeNull()
  })
  it('shows three scheduled biweekly paydays and updates the month total from the calendar setting', () => {
    let data: PockitData = makeDemoData()
    data.profile.payFrequency = 'biweekly'
    data.profile.payAmount = 1000
    data.profile.paydayAnchor = '2026-01-02'
    const update = (recipe: (value: PockitData) => PockitData) => {
      data = recipe(data)
    }
    const view = render(<CalendarScreen data={data} month="2026-01" update={update} />)
    expect(screen.getByText('3 expected cheques')).toBeTruthy()
    expect(screen.getByText('2 · 16 · 30')).toBeTruthy()
    expect(monthSummary(data, '2026-01').income).toBe(3000)
    fireEvent.change(screen.getByLabelText('One real payday'), { target: { value: '2026-01-09' } })
    view.rerender(<CalendarScreen data={data} month="2026-01" update={update} />)
    expect(screen.getByText('9 · 23')).toBeTruthy()
    expect(monthSummary(data, '2026-01').income).toBe(2000)
  })
  it('skips a reminder without recording a payment', () => {
    let data: PockitData = makeDemoData()
    const month = currentMonth()
    render(
      <CalendarScreen
        data={data}
        month={month}
        update={(recipe) => {
          data = recipe(data)
        }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^24$/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Skip this reminder' }))
    expect(data.bills.find((b) => b.name === 'Internet')?.skippedMonths).toContain(month)
    expect(data.bills.find((b) => b.name === 'Internet')?.paidMonths).not.toContain(month)
    expect(
      data.transactions.some(
        (transaction) => transaction.billId === data.bills.find((b) => b.name === 'Internet')?.id,
      ),
    ).toBe(false)
  })
  it('records a bill payment in Activity and marks the bill paid together', () => {
    let data: PockitData = makeDemoData()
    const month = currentMonth()
    const { rerender } = render(
      <CalendarScreen
        data={data}
        month={month}
        update={(recipe) => {
          data = recipe(data)
        }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^24$/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Record payment' }))
    const internet = data.bills.find((bill) => bill.name === 'Internet')!
    expect(internet.paidMonths).toContain(month)
    expect(
      data.transactions.find((transaction) => transaction.billId === internet.id),
    ).toMatchObject({
      amount: 80,
      type: 'expense',
      date: `${month}-24`,
    })
    rerender(
      <CalendarScreen
        data={data}
        month={month}
        update={(recipe) => {
          data = recipe(data)
        }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Undo payment' }))
    expect(data.transactions.some((transaction) => transaction.billId === internet.id)).toBe(false)
    expect(data.bills.find((bill) => bill.id === internet.id)?.paidMonths).not.toContain(month)
  })
  it('records a card payment as a transfer without increasing spending', () => {
    let data: PockitData = makeDemoData()
    const month = currentMonth()
    const internet = data.bills.find((bill) => bill.name === 'Internet')!
    data = {
      ...data,
      bills: data.bills.map((bill) =>
        bill.id === internet.id ? { ...bill, paymentType: 'transfer' } : bill,
      ),
    }
    const before = monthSummary(data, month).spent
    render(
      <CalendarScreen
        data={data}
        month={month}
        update={(recipe) => {
          data = recipe(data)
        }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^24$/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Record payment' }))
    expect(data.transactions.find((transaction) => transaction.billId === internet.id)?.type).toBe(
      'transfer',
    )
    expect(monthSummary(data, month).spent).toBe(before)
  })
  it('offers a missing bill date, requires a real day, and links the reminder to its budget category', () => {
    let data: PockitData = makeDemoData()
    const month = currentMonth()
    const phone = data.categories.find((category) => category.name === 'Phone')!
    const update = (recipe: (value: PockitData) => PockitData) => {
      data = recipe(data)
    }
    const view = () => <CalendarScreen data={data} month={month} update={update} />
    const { rerender } = render(view())
    fireEvent.click(screen.getByRole('button', { name: /Set Phone date/ }))
    const save = screen.getByRole('button', { name: 'Save bill' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Day of month'), { target: { value: '15' } })
    expect(save.disabled).toBe(false)
    fireEvent.click(save)
    expect(data.bills.find((bill) => bill.categoryId === phone.id)).toMatchObject({
      day: 15,
      amount: 65,
    })
    rerender(view())
    expect(screen.queryByRole('button', { name: /Set Phone date/ })).toBeNull()
    expect(data.transactions).toHaveLength(20)
  })
})
