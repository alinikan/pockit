// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { PockitData } from '../types'
import { makeDemoData } from '../lib/defaults'
import { currentMonth } from '../lib/finance'
import { CalendarScreen } from './Calendar'

afterEach(cleanup)

describe('calendar', () => {
  it('marks a bill paid for the selected month', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Paid' }))
    expect(data.bills.find((b) => b.name === 'Internet')?.paidMonths).toContain(month)
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
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(data.transactions.some((transaction) => transaction.billId === internet.id)).toBe(false)
    expect(data.bills.find((bill) => bill.id === internet.id)?.paidMonths).not.toContain(month)
  })
})
