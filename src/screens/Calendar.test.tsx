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
})
