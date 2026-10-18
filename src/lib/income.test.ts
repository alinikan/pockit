import { describe, expect, it } from 'vitest'
import type { Account, Transaction } from '../types'
import { makeInitialData } from './defaults'
import { incomeCategoryLabel, needsIncomeBalanceChoice, prepareIncomeEntry } from './income'
import { accountBalance, reconcileAccount } from './ledger'
import { changeTransaction } from './linked'
import { monthSummary } from './finance'
import { parseBackup } from './backup'

const date = '2026-10-17',
  time = '2026-10-17T20:00:00.000Z'
const account: Account = {
  id: 'cash',
  name: 'Chequing',
  kind: 'chequing',
  openingBalance: 1000,
  asOf: date,
  asOfTime: '2026-10-17T19:00:00.000Z',
}
const entry = (patch: Partial<Transaction> = {}): Transaction => ({
  id: 'pay',
  type: 'income',
  payee: 'Employer',
  incomeCategory: 'paycheque',
  amount: 250,
  date,
  accountId: 'cash',
  ...patch,
})
const fixture = () => ({
  ...makeInitialData(),
  accounts: [{ ...account }],
  transactions: [] as Transaction[],
})
const posting = (mode: 'add' | 'included', patch: Partial<Transaction> = {}) =>
  prepareIncomeEntry(entry({ ...patch, balancePosting: { mode, date, time } }), null, date, time)

describe('income account decisions', () => {
  it.each(['2026-10-17', '2026-10-03', '2026-09-28'])(
    'adds a missing deposit dated %s now while reporting it in its original month',
    (incomeDate) => {
      const data = fixture()
      const value = posting('add', { date: incomeDate })
      const next = changeTransaction(data, null, value)
      expect(accountBalance(account, next.transactions, date)).toBe(1250)
      expect(monthSummary(next, incomeDate.slice(0, 7) as '2026-10').actualIncome).toBe(250)
      expect(value.date).toBe(incomeDate)
      expect(value.balancePosting?.date).toBe(date)
      expect(accountBalance(account, next.transactions, '2026-10-16')).toBe(1000)
      expect(data.transactions).toHaveLength(0)
    },
  )
  it.each(['2026-10-17', '2026-10-03', '2026-09-28'])(
    'can record an already-included deposit dated %s without changing the estimate',
    (incomeDate) => {
      const data = changeTransaction(fixture(), null, posting('included', { date: incomeDate }))
      expect(accountBalance(account, data.transactions, date)).toBe(1000)
      expect(monthSummary(data, incomeDate.slice(0, 7) as '2026-10').actualIncome).toBe(250)
    },
  )
  it('honours an explicit same-day addition even when the imported snapshot has no time', () => {
    expect(accountBalance({ ...account, asOfTime: undefined }, [posting('add')], date)).toBe(1250)
    expect(accountBalance({ ...account, asOfTime: undefined }, [entry()], date)).toBe(1000)
  })
  it('updates only the receiving account and supports independent deposits', () => {
    const other = { ...account, id: 'savings', openingBalance: 500 }
    const deposits = [
      posting('add'),
      posting('add', { id: 'second', amount: 150, accountId: 'savings' }),
    ]
    expect(accountBalance(account, deposits, date)).toBe(1250)
    expect(accountBalance(other, deposits, date)).toBe(650)
  })
  it('edits and deletes an included deposit by its net amount before a newer balance check', () => {
    const first = posting('add')
    const data = changeTransaction(fixture(), null, first)
    const edited = prepareIncomeEntry(
      { ...first, amount: 300 },
      first,
      date,
      '2026-10-17T21:00:00Z',
    )
    const next = changeTransaction(data, first, edited)
    expect(accountBalance(account, next.transactions, date)).toBe(1300)
    expect(edited.balancePosting).toEqual(first.balancePosting)
    expect(accountBalance(account, changeTransaction(next, edited, null).transactions, date)).toBe(
      1000,
    )
  })
  it('does not replay a saved addition when editing it after a later balance check', () => {
    const first = posting('add')
    const data = reconcileAccount(
      changeTransaction(fixture(), null, first),
      account.id,
      1200,
      date,
      '2026-10-17T21:00:00Z',
    )
    const edited = prepareIncomeEntry(
      { ...first, amount: 300 },
      first,
      date,
      '2026-10-17T22:00:00Z',
    )
    const next = changeTransaction(data, first, edited)
    expect(accountBalance(next.accounts![0], next.transactions, date)).toBe(1200)
    const second = prepareIncomeEntry(
      entry({ id: 'second', balancePosting: first.balancePosting }),
      null,
      date,
      '2026-10-17T22:01:00Z',
    )
    expect(accountBalance(next.accounts![0], [...next.transactions, second], date)).toBe(1450)
  })
  it('compares snapshot timestamps by time rather than string formatting', () => {
    const value = posting('add')
    expect(accountBalance({ ...account, asOfTime: '2026-10-17T20:00:00Z' }, [value], date)).toBe(
      1000,
    )
  })
  it('requires a fresh decision for a new deposit or a changed receiving account', () => {
    const data = fixture(),
      value = entry()
    expect(needsIncomeBalanceChoice(data, value)).toBe(true)
    expect(needsIncomeBalanceChoice(data, { ...value, accountId: undefined })).toBe(false)
    expect(needsIncomeBalanceChoice(data, posting('included'))).toBe(false)
    data.transactions = [value]
    expect(needsIncomeBalanceChoice(data, value)).toBe(false)
    expect(needsIncomeBalanceChoice(data, { ...value, accountId: 'savings' })).toBe(true)
  })
  it('keeps legacy handling and removes income-only metadata when changing transaction type', () => {
    const legacy = entry({ incomeCategory: undefined })
    expect(prepareIncomeEntry(legacy, legacy, date, time).balancePosting).toBeUndefined()
    const expense = prepareIncomeEntry({ ...posting('add'), type: 'expense' }, null, date, time)
    expect(expense.incomeCategory).toBeUndefined()
    expect(expense.balancePosting).toBeUndefined()
    expect(incomeCategoryLabel(undefined)).toBe('Other income')
  })
  it('round-trips choices in backups and rejects malformed income fields', () => {
    const data = changeTransaction(fixture(), null, posting('included'))
    expect(parseBackup(JSON.stringify(data)).transactions[0]).toEqual(data.transactions[0])
    for (const patch of [
      { incomeCategory: 'groceries' },
      { balancePosting: { mode: 'bad', date, time } },
      { balancePosting: { mode: 'add', date: '2026-02-30', time } },
      { balancePosting: { mode: 'add', date, time: 'invalid' } },
      { balancePosting: null },
      { type: 'expense' },
    ]) {
      const next = { ...data, transactions: [{ ...data.transactions[0], ...patch }] }
      expect(() => parseBackup(JSON.stringify(next))).toThrow(/invalid transaction/)
    }
  })
})
