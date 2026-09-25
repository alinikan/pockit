// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { PockitData } from '../types'
import { makeDemoData } from '../lib/defaults'
import { categoryBudget, categoryPolicy, currentMonth, shiftMonth } from '../lib/finance'
import { BudgetScreen } from './Budget'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('budget editor', () => {
  it('explains saved rollover carryover and keeps old category history when removed', () => {
    let data = makeDemoData()
    const month = currentMonth()
    const old = shiftMonth(month, -1)
    const groceries = data.categories.find((category) => category.name === 'Groceries')!
    const oldAmount = categoryBudget(groceries, old, 5800)
    const view = render(
      <BudgetScreen
        data={data}
        month={month}
        update={(recipe) => {
          data = recipe(data)
        }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Savings Savings & Goals/ }))
    expect(
      screen.getByLabelText(
        `Savings balance in ${new Intl.DateTimeFormat('en-CA', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T12:00:00`))}`,
      ).textContent,
    ).toMatch(/Carried from last month/)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    fireEvent.click(screen.getByRole('button', { name: /Groceries Food & Dining/ }))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Remove category' }))
    expect(data.categories.find((category) => category.id === groceries.id)).toMatchObject({
      archived: true,
      ends: old,
    })
    expect(
      categoryBudget(
        data.categories.find((category) => category.id === groceries.id)!,
        old,
        5800,
      ),
    ).toBe(oldAmount)
    expect(
      categoryBudget(
        data.categories.find((category) => category.id === groceries.id)!,
        month,
        5800,
      ),
    ).toBe(0)
    expect(data.transactions.some((transaction) => transaction.categoryId === groceries.id)).toBe(
      true,
    )
    view.unmount()
  })
  it('applies an ongoing allocation from the selected month without changing history', () => {
    let data: PockitData = makeDemoData()
    const month = currentMonth()
    const old = shiftMonth(month, -1)
    const groceries = data.categories.find((c) => c.name === 'Groceries')!
    const before = categoryBudget(groceries, old, 5800)
    render(
      <BudgetScreen
        data={data}
        month={month}
        update={(recipe) => {
          data = recipe(data)
        }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Groceries Food & Dining/ }))
    fireEvent.change(screen.getByLabelText('Amount to plan each period'), {
      target: { value: '600' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save category' }))
    const changed = data.categories.find((c) => c.id === groceries.id)!
    expect(categoryBudget(changed, old, 5800)).toBe(before)
    expect(categoryBudget(changed, month, 5800)).toBe(600)
    expect(categoryBudget(changed, shiftMonth(month, 1), 5800)).toBe(600)
  })

  it('applies a one-month allocation without changing neighboring months', () => {
    let data = makeDemoData()
    const month = currentMonth()
    const groceries = data.categories.find((c) => c.name === 'Groceries')!
    const prior = categoryBudget(groceries, shiftMonth(month, -1), 5800)
    const next = categoryBudget(groceries, shiftMonth(month, 1), 5800)
    render(
      <BudgetScreen
        data={data}
        month={month}
        update={(recipe) => {
          data = recipe(data)
        }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Groceries Food & Dining/ }))
    fireEvent.change(screen.getByLabelText('Amount to plan each period'), {
      target: { value: '700' },
    })
    fireEvent.click(screen.getByRole('button', { name: /More choices/ }))
    fireEvent.change(screen.getByLabelText('Applies to'), { target: { value: 'month' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save category' }))
    const changed = data.categories.find((c) => c.id === groceries.id)!
    expect(categoryBudget(changed, shiftMonth(month, -1), 5800)).toBe(prior)
    expect(categoryBudget(changed, month, 5800)).toBe(700)
    expect(categoryBudget(changed, shiftMonth(month, 1), 5800)).toBe(next)
  })

  it('changes the carryover rule from the selected month while preserving the earlier rule', () => {
    let data = makeDemoData()
    const month = currentMonth()
    const old = shiftMonth(month, -1)
    const groceries = data.categories.find((c) => c.name === 'Groceries')!
    render(
      <BudgetScreen
        data={data}
        month={month}
        update={(recipe) => {
          data = recipe(data)
        }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Groceries Food & Dining/ }))
    fireEvent.click(screen.getByRole('button', { name: /More choices/ }))
    fireEvent.click(screen.getByRole('button', { name: /Rolls over/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Save category' }))
    const changed = data.categories.find((c) => c.id === groceries.id)!
    expect(categoryPolicy(changed, old).mode).toBe('fresh')
    expect(categoryPolicy(changed, month).mode).toBe('rollover')
    expect(categoryPolicy(changed, shiftMonth(month, 1)).mode).toBe('rollover')
  })

  it('limits a one-month carryover rule to the selected month', () => {
    let data = makeDemoData()
    const month = currentMonth()
    const groceries = data.categories.find((c) => c.name === 'Groceries')!
    render(
      <BudgetScreen
        data={data}
        month={month}
        update={(recipe) => {
          data = recipe(data)
        }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Groceries Food & Dining/ }))
    fireEvent.click(screen.getByRole('button', { name: /More choices/ }))
    fireEvent.click(screen.getByRole('button', { name: /Rolls over/ }))
    fireEvent.change(screen.getByLabelText('Applies to'), { target: { value: 'month' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save category' }))
    const changed = data.categories.find((c) => c.id === groceries.id)!
    expect(categoryPolicy(changed, shiftMonth(month, -1)).mode).toBe('fresh')
    expect(categoryPolicy(changed, month).mode).toBe('rollover')
    expect(categoryPolicy(changed, shiftMonth(month, 1)).mode).toBe('fresh')
  })

  it('does not save a blank category and normalizes an invalid allocation', () => {
    let data = makeDemoData()
    const before = data.categories.length
    render(
      <BudgetScreen
        data={data}
        month={currentMonth()}
        update={(recipe) => {
          data = recipe(data)
        }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Add category/ }))
    const save = screen.getByRole('button', { name: 'Save category' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Category name'), { target: { value: '   ' } })
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Category name'), {
      target: { value: ' Test cushion ' },
    })
    fireEvent.change(screen.getByLabelText('Amount to plan each period'), {
      target: { value: '1e309' },
    })
    fireEvent.click(save)
    expect(data.categories).toHaveLength(before + 1)
    expect(data.categories.at(-1)).toMatchObject({ name: 'Test cushion', baseAmount: 0 })
  })

  it('caps a rollover percentage at 100 and allows a zero-target balance', () => {
    let data = makeDemoData()
    const savings = data.categories.find((c) => c.name === 'Savings')!
    render(
      <BudgetScreen
        data={data}
        month={currentMonth()}
        update={(recipe) => {
          data = recipe(data)
        }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Savings Savings & Goals/ }))
    fireEvent.click(screen.getByRole('button', { name: /More choices/ }))
    fireEvent.change(screen.getByLabelText('How much to add each period'), {
      target: { value: 'percent' },
    })
    fireEvent.change(screen.getByLabelText('Percent of monthly income'), {
      target: { value: '150' },
    })
    expect((screen.getByLabelText('Percent of monthly income') as HTMLInputElement).value).toBe(
      '100',
    )
    fireEvent.change(screen.getByLabelText('How much to add each period'), {
      target: { value: 'none' },
    })
    expect(screen.queryByLabelText('How will you add money?')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Save category' }))
    expect(data.categories.find((c) => c.id === savings.id)).toMatchObject({
      targetType: 'none',
      funding: 'manual',
    })
  })
})
