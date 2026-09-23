import { describe, expect, it } from 'vitest'
import { makeDemoData } from './defaults'
import { changeTransaction } from './linked'

describe('linked Activity entries', () => {
  it('updates and reverses a linked debt payment without touching other entries', () => {
    let data = makeDemoData()
    const goal = data.goals.find((item) => item.kind === 'debt')!
    const payment = {
      id: 'linked-payment',
      date: '2026-09-22',
      payee: goal.name,
      amount: 100,
      type: 'expense' as const,
      goalId: goal.id,
    }
    data = changeTransaction(data, null, payment)
    expect(data.goals.find((item) => item.id === goal.id)?.balance).toBe(goal.balance - 100)
    expect(data.goals.find((item) => item.id === goal.id)?.history[0].transactionId).toBe(
      payment.id,
    )
    const edited = { ...payment, amount: 125, date: '2026-09-23' }
    data = changeTransaction(data, payment, edited)
    expect(data.goals.find((item) => item.id === goal.id)?.balance).toBe(goal.balance - 125)
    expect(data.goals.find((item) => item.id === goal.id)?.history[0].date).toBe('2026-09-23')
    data = changeTransaction(data, edited, null)
    expect(data.goals.find((item) => item.id === goal.id)?.balance).toBe(goal.balance)
    data = changeTransaction(data, null, edited)
    expect(data.goals.find((item) => item.id === goal.id)?.balance).toBe(goal.balance - 125)
  })
  it('keeps a bill paid state linked to its Activity transaction', () => {
    let data = makeDemoData()
    const bill = data.bills.find((item) => item.name === 'Internet')!
    const payment = {
      id: 'bill-payment',
      date: '2026-09-24',
      payee: bill.name,
      amount: bill.amount,
      type: 'expense' as const,
      billId: bill.id,
    }
    data = changeTransaction(data, null, payment)
    expect(data.bills.find((item) => item.id === bill.id)?.paidMonths).toContain('2026-09')
    data = changeTransaction(data, payment, null)
    expect(data.bills.find((item) => item.id === bill.id)?.paidMonths).not.toContain('2026-09')
  })
  it('reduces savings on a linked withdrawal and restores it on deletion', () => {
    let data = makeDemoData()
    const goal = data.goals.find((item) => item.kind === 'saving')!
    const withdrawal = {
      id: 'goal-withdrawal',
      date: '2026-09-24',
      payee: 'Emergency repair',
      amount: 120,
      type: 'expense' as const,
      goalId: goal.id,
    }
    data = changeTransaction(data, null, withdrawal)
    expect(data.goals.find((item) => item.id === goal.id)?.balance).toBe(goal.balance - 120)
    data = changeTransaction(data, withdrawal, null)
    expect(data.goals.find((item) => item.id === goal.id)?.balance).toBe(goal.balance)
  })
  it('rejects a goal withdrawal larger than the available saved balance', () => {
    const data = makeDemoData()
    const goal = data.goals.find((item) => item.kind === 'saving')!
    expect(() =>
      changeTransaction(data, null, {
        id: 'too-large',
        date: '2026-09-24',
        payee: 'Repair',
        amount: goal.balance + 1,
        type: 'expense',
        goalId: goal.id,
      }),
    ).toThrow(/exceeds/)
    expect(data.goals.find((item) => item.id === goal.id)?.balance).toBe(goal.balance)
  })
  it('moves progress when a transaction is linked to a different goal', () => {
    let data = makeDemoData()
    const first = data.goals.find((item) => item.kind === 'saving')!
    const second = { ...first, id: 'second-goal', balance: 0, history: [] }
    data = { ...data, goals: [...data.goals, second] }
    const before = {
      id: 'contribution',
      date: '2026-09-24',
      payee: 'Saving',
      amount: 100,
      type: 'transfer' as const,
      goalId: first.id,
    }
    data = changeTransaction(data, null, before)
    data = changeTransaction(data, before, { ...before, goalId: second.id })
    expect(data.goals.find((item) => item.id === first.id)?.balance).toBe(first.balance)
    expect(data.goals.find((item) => item.id === second.id)?.balance).toBe(100)
  })
  it('keeps a bill paid when one of two linked payments is deleted', () => {
    let data = makeDemoData()
    const bill = data.bills.find((item) => item.name === 'Internet')!
    const first = {
      id: 'payment-1',
      date: '2026-09-24',
      payee: 'Internet',
      amount: 40,
      type: 'expense' as const,
      billId: bill.id,
    }
    const second = { ...first, id: 'payment-2', amount: 40 }
    data = changeTransaction(data, null, first)
    data = changeTransaction(data, null, second)
    data = changeTransaction(data, first, null)
    expect(data.bills.find((item) => item.id === bill.id)?.paidMonths).toContain('2026-09')
  })
})
