import { describe, expect, it } from 'vitest'
import type { Account, PockitData, Transaction } from '../types'
import { makeInitialData, newCategory } from './defaults'
import {
  accountTypeLabel,
  investmentContributionsByCategory,
  investmentTransferCategory,
  investmentTransferDirection,
} from './accounts'
import { accountBalance } from './ledger'
import {
  budgetHealth,
  categoryPlanUsage,
  monthSummary,
  rolloverBalance,
  rolloverMonth,
  spendingByCategory,
} from './finance'
import { changeTransaction } from './linked'
import { budgetComparison, monthSnapshot } from './compare'
import { parseBackup } from './backup'

const account = (id: string, kind: Account['kind'], openingBalance: number): Account => ({
  id,
  name: id,
  kind,
  openingBalance,
  asOf: '2026-08-31',
})
function fixture(): PockitData {
  const data = makeInitialData('Alex')
  data.profile.payAmount = 2000
  data.profile.payFrequency = 'monthly'
  data.accounts = [
    account('chequing', 'chequing', 1000),
    {
      ...account('tfsa', 'investment', 500),
      subtype: 'TFSA',
      contributionCategoryId: 'investments',
    },
    account('rrsp', 'investment', 300),
  ]
  data.categories = [
    {
      ...newCategory('Investments', 'TrendingUp', 'Savings & Goals', '#123456', 300, '2026-09'),
      id: 'investments',
    },
  ]
  return data
}
const transfer = (patch: Partial<Transaction> = {}): Transaction => ({
  id: 'transfer',
  type: 'transfer',
  amount: 200,
  date: '2026-09-01',
  payee: 'TFSA contribution',
  accountId: 'chequing',
  toAccountId: 'tfsa',
  categoryId: 'investments',
  ...patch,
})

describe('investment accounts and category plans', () => {
  it('moves one contribution between balances and uses the plan without inventing income or spending', () => {
    const data = changeTransaction(fixture(), null, transfer())
    expect(accountBalance(data.accounts![0], data.transactions)).toBe(800)
    expect(accountBalance(data.accounts![1], data.transactions)).toBe(700)
    expect(spendingByCategory(data.transactions, '2026-09')).toEqual({})
    expect(monthSummary(data, '2026-09')).toMatchObject({
      spent: 0,
      actualIncome: 0,
      netInvested: 200,
      remaining: 1800,
    })
    expect(categoryPlanUsage(data, '2026-09')).toEqual({ investments: 200 })
    expect(budgetComparison(data, '2026-09')[0]).toMatchObject({ spent: 200, balance: 100 })
    expect(monthSnapshot(data, '2026-09').spent).toBe(0)
    expect(accountTypeLabel(data.accounts![1])).toBe('TFSA')
    expect(investmentTransferCategory(data, 'chequing', 'tfsa')).toBe('investments')
  })
  it('recalculates edits, dates, deletion, and withdrawals from the single transaction record', () => {
    const original = transfer()
    let data = changeTransaction(fixture(), null, original)
    const revised = transfer({ date: '2026-10-01', amount: 400 })
    data = changeTransaction(data, original, revised)
    expect(investmentContributionsByCategory(data, '2026-09')).toEqual({})
    expect(categoryPlanUsage(data, '2026-10').investments).toBe(400)
    expect(accountBalance(data.accounts![0], data.transactions, '2026-09-30')).toBe(1000)
    const withdrawal = transfer({
      id: 'withdrawal',
      date: '2026-10-02',
      amount: 50,
      accountId: 'tfsa',
      toAccountId: 'chequing',
    })
    data = changeTransaction(data, null, withdrawal)
    expect(investmentContributionsByCategory(data, '2026-10').investments).toBe(350)
    expect(accountBalance(data.accounts![1], data.transactions)).toBe(850)
    data = changeTransaction(data, revised, null)
    expect(accountBalance(data.accounts![0], data.transactions)).toBe(1050)
    expect(categoryPlanUsage(data, '2026-10').investments).toBe(-50)
    expect(monthSummary(data, '2026-10').spent).toBe(0)
  })
  it('keeps internal investment moves, excluded transfers, and unassigned categories out of contribution totals', () => {
    const data = fixture()
    data.transactions = [
      transfer({ accountId: 'tfsa', toAccountId: 'rrsp' }),
      transfer({ id: 'excluded', excludedFromBudget: true }),
      transfer({ id: 'unassigned', categoryId: undefined }),
    ]
    expect(investmentContributionsByCategory(data, '2026-09')).toEqual({})
    expect(investmentTransferDirection(data, transfer({ toAccountId: 'chequing' }))).toBe(0)
    expect(accountBalance(data.accounts![1], data.transactions)).toBe(700)
    data.accounts![1].contributionCategoryId = ''
    expect(investmentTransferCategory(data, 'chequing', 'tfsa')).toBeUndefined()
  })
  it('carries unused investment allocations across months and never treats an outgoing contribution as manual funding', () => {
    const data = fixture()
    data.categories[0].mode = 'rollover'
    data.transactions = [transfer(), transfer({ id: 'next', date: '2026-10-01', amount: 150 })]
    expect(rolloverBalance(data.categories[0], data, '2026-09')).toBe(100)
    expect(rolloverMonth(data.categories[0], data, '2026-10')).toMatchObject({
      carried: 100,
      added: 300,
      spent: 150,
      available: 250,
    })
    data.categories[0].funding = 'manual'
    expect(rolloverBalance(data.categories[0], data, '2026-09')).toBe(-200)
    data.transactions.unshift(
      transfer({ id: 'fund', type: 'income', amount: 300, toAccountId: undefined }),
    )
    expect(rolloverBalance(data.categories[0], data, '2026-09')).toBe(100)
    expect(rolloverMonth(data.categories[0], data, '2026-09').added).toBe(300)
    data.transactions.push(transfer({ id: 'internal', accountId: 'tfsa', toAccountId: 'rrsp' }))
    expect(rolloverMonth(data.categories[0], data, '2026-09').added).toBe(300)
    expect(rolloverBalance(data.categories[0], data, '2026-09')).toBe(100)
  })
  it('flags an over-allocation and preserves TFSA settings and transfers through backup restore', () => {
    const data = fixture()
    data.transactions = [transfer({ amount: 500 })]
    expect(budgetHealth(data, '2026-09').trouble.map((category) => category.id)).toEqual([
      'investments',
    ])
    const restored = parseBackup(JSON.stringify(data))
    expect(restored.accounts![1]).toMatchObject({
      kind: 'investment',
      subtype: 'TFSA',
      contributionCategoryId: 'investments',
    })
    expect(categoryPlanUsage(restored, '2026-09').investments).toBe(500)
  })
})
