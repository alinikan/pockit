import { describe, expect, it } from 'vitest'
import { makeInitialData } from './defaults'
import { accountBalance, accountImpact, reconcileAccount } from './ledger'
import type { Account, Transaction } from '../types'

const account: Account = {
  id: 'chequing',
  name: 'Chequing',
  kind: 'chequing',
  openingBalance: 500,
  asOf: '2026-09-01',
  asOfTime: '2026-09-01T12:00:00.000Z',
}
const transaction = (patch: Partial<Transaction>): Transaction => ({
  id: crypto.randomUUID(),
  date: '2026-09-02',
  payee: 'Item',
  amount: 25,
  type: 'expense',
  accountId: 'chequing',
  ...patch,
})

describe('manual accounts', () => {
  it('counts expenses, refunds, income, and both sides of a transfer once', () => {
    const items = [
      transaction({}),
      transaction({ refund: true, amount: 10 }),
      transaction({ type: 'income', amount: 100 }),
      transaction({ type: 'transfer', amount: 50, toAccountId: 'savings' }),
    ]
    expect(accountBalance(account, items)).toBe(535)
    expect(accountImpact(items[3], 'savings')).toBe(50)
  })
  it('does not replay transactions already included in a same-day balance', () => {
    expect(
      accountBalance(account, [
        transaction({ date: '2026-09-01', createdAt: '2026-09-01T11:00:00.000Z' }),
        transaction({ date: '2026-09-01', createdAt: '2026-09-01T13:00:00.000Z' }),
      ]),
    ).toBe(475)
  })
  it('reconciles against the entered balance and retains an adjustment record', () => {
    const data = { ...makeInitialData(), accounts: [account], transactions: [transaction({})] }
    const next = reconcileAccount(data, account.id, 470, '2026-09-03', '2026-09-03T12:00:00.000Z')
    expect(next.accounts?.[0].reconciliations?.[0].adjustment).toBe(-5)
    expect(accountBalance(next.accounts![0], next.transactions)).toBe(470)
    expect(() => reconcileAccount(data, account.id, NaN, '2026-09-03', 'bad')).toThrow()
  })
})
