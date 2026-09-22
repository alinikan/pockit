// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { PockitData } from '../types'
import { currentMonth } from '../lib/finance'
import { makeDemoData } from '../lib/defaults'
import { ActivityScreen } from './Activity'

afterEach(cleanup)

describe('activity', () => {
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
})
