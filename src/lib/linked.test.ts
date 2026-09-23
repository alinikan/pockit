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
})
