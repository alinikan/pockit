// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { PockitData } from '../types'
import { makeDemoData } from '../lib/defaults'
import { currentMonth, monthSummary } from '../lib/finance'
import { CalendarScreen } from './Calendar'

afterEach(cleanup)

describe('calendar', () => {
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
})
