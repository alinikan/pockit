import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeDemoData } from './defaults'
import {
  addDays,
  parseQuickEntry,
  monthCoverage,
  spendingSuggestions,
  projectTotals,
} from './experience'
import { cashForecast, checkAffordability, subscriptionDates } from './forecast'
import { assignGoalFunding, accountReservations, fundingSummary } from './goalFunding'
import {
  canRestoreChange,
  restoreChange,
  withChangeHistory,
  previewTransactionChange,
} from './changeHistory'
import { changeTransaction } from './linked'
import { accountBalance } from './ledger'
import { mergeSnapshots } from './storage'
import { parseBackup } from './backup'
import { widgetSummary } from './nativeCompanion'
import type { PockitData } from '../types'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-17T19:00:00Z'))
})
afterEach(() => vi.useRealTimers())
function fixture(): PockitData {
  const data = makeDemoData()
  data.transactions = []
  data.bills = []
  data.profile = {
    ...data.profile,
    payFrequency: 'twice-monthly',
    paydayDays: [15, 30],
    payAmount: 1000,
  }
  data.accounts = [
    {
      id: 'cash',
      name: 'Chequing',
      kind: 'chequing',
      openingBalance: 1000,
      asOf: '2026-10-17',
      asOfTime: '2026-10-17T18:00:00Z',
    },
    { id: 'save', name: 'Savings', kind: 'savings', openingBalance: 500, asOf: '2026-10-17' },
  ]
  data.goals = data.goals
    .filter((goal) => goal.kind === 'saving')
    .map((goal) => ({
      ...goal,
      id: 'goal',
      balance: 200,
      funding: [{ accountId: 'cash', amount: 200 }],
      history: [],
    }))
  return data
}
describe('quick entry and coverage', () => {
  it.each([
    ['Coffee 6.50 yesterday', '2026-10-16', 6.5],
    ['Coffee $2.25 today', '2026-10-17', 2.25],
    ['Groceries 42.10 2026-09-30', '2026-09-30', 42.1],
  ])('previews %s on the device', (text, date, amount) => {
    expect(parseQuickEntry(text, fixture())).toMatchObject({ date, amount, type: 'expense' })
  })
  it.each([
    'Coffee',
    'Coffee -2',
    'Coffee 0',
    'Coffee 1.234',
    'Coffee 6.50 7',
    'Coffee Infinity',
    'Coffee 1000001',
    'Coffee 5 2026-02-30',
    'Coffee 5 2027-01-01',
  ])('rejects unsupported entry %s', (text) =>
    expect(() => parseQuickEntry(text, fixture())).toThrow(),
  )
  it('uses a known merchant rule, but never a deleted category', () => {
    const data = fixture()
    data.settings.merchantRules = [{ payee: 'coffee', categoryId: data.categories[0].id }]
    expect(parseQuickEntry('Coffee 5', data).categoryId).toBe(data.categories[0].id)
    data.categories[0].archived = true
    expect(parseQuickEntry('Coffee 5', data).categoryId).toBeUndefined()
  })
  it('distinguishes empty entries from a confirmed zero-spending month', () => {
    const data = fixture()
    expect(monthCoverage(data, '2026-09').canCompare).toBe(false)
    data.settings.completeMonths = ['2026-09']
    expect(monthCoverage(data, '2026-09').confirmed).toBe(true)
  })
  it('handles leap days and year boundaries using calendar dates', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})
describe('cash-backed goals', () => {
  it('assigns existing money without a bank movement or Activity entry', () => {
    const data = fixture()
    const next = assignGoalFunding(data, 'goal', [
      { accountId: 'cash', amount: 300 },
      { accountId: 'save', amount: 100 },
    ])
    expect(next.goals[0].balance).toBe(400)
    expect(next.transactions).toHaveLength(0)
    expect(accountBalance(next.accounts![0], next.transactions)).toBe(1000)
    expect(next.goals[0].history[0].note).toMatch(/no transfer/)
  })
  it('prevents double-assignment across goals', () => {
    const data = fixture()
    data.goals.push({
      ...data.goals[0],
      id: 'second',
      balance: 400,
      funding: [{ accountId: 'cash', amount: 400 }],
    })
    expect(() => assignGoalFunding(data, 'goal', [{ accountId: 'cash', amount: 700 }])).toThrow(
      /unassigned money/,
    )
    expect(accountReservations(data, 'cash')).toBe(600)
  })
  it.each([NaN, Infinity, -1, 0.001])('rejects invalid assignments %s', (amount) =>
    expect(() => assignGoalFunding(fixture(), 'goal', [{ accountId: 'cash', amount }])).toThrow(),
  )
  it('updates backing when a linked savings transfer is edited or removed', () => {
    let data = fixture()
    const tx = {
      id: 'tx',
      date: '2026-10-18',
      payee: 'Savings',
      type: 'transfer' as const,
      amount: 50,
      accountId: 'cash',
      toAccountId: 'save',
      goalId: 'goal',
    }
    data = changeTransaction(data, null, tx)
    expect(data.goals[0].balance).toBe(250)
    expect(data.goals[0].funding?.find((item) => item.accountId === 'save')?.amount).toBe(50)
    data = changeTransaction(data, tx, { ...tx, amount: 75 })
    expect(data.goals[0].funding?.find((item) => item.accountId === 'save')?.amount).toBe(75)
    data = changeTransaction(data, { ...tx, amount: 75 }, null)
    expect(fundingSummary(data, 'goal').assigned).toBe(200)
  })
  it('reports backing that no longer fits a checked balance', () => {
    const data = fixture()
    data.accounts![0].openingBalance = 50
    expect(fundingSummary(data, 'goal').issues).toHaveLength(1)
  })
})
describe('daily account forecasts', () => {
  it('accounts for unpaid bills due today and does not mutate the ledger', () => {
    const data = fixture()
    data.bills = [
      {
        id: 'bill',
        name: 'Bill',
        amount: 100,
        day: 17,
        starts: '2026-10',
        paidMonths: [],
        accountId: 'cash',
      },
    ]
    const before = JSON.stringify(data),
      result = cashForecast(data, { days: 30, expectedPay: false })
    expect(result.points[0].balances.cash).toBe(900)
    expect(JSON.stringify(data)).toBe(before)
  })
  it('counts an explicitly linked future bill entry once', () => {
    const data = fixture()
    data.bills = [
      {
        id: 'bill',
        name: 'Bill',
        amount: 100,
        day: 20,
        starts: '2026-10',
        paidMonths: [],
        accountId: 'cash',
      },
    ]
    data.transactions = [
      {
        id: 'tx',
        date: '2026-10-20',
        payee: 'Bill',
        type: 'expense',
        amount: 100,
        accountId: 'cash',
        billId: 'bill',
      },
    ]
    const result = cashForecast(data, { days: 10, expectedPay: false })
    expect(result.events.filter((item) => item.date === '2026-10-20')).toHaveLength(1)
    expect(result.points.at(-1)?.balances.cash).toBe(900)
  })
  it('projects both sides of a transfer without changing total assets', () => {
    const data = fixture()
    data.transactions = [
      {
        id: 'tx',
        date: '2026-10-20',
        payee: 'Transfer',
        type: 'transfer',
        amount: 150,
        accountId: 'cash',
        toAccountId: 'save',
      },
    ]
    const final = cashForecast(data, { days: 10, expectedPay: false }).points.at(-1)!.balances
    expect(final.cash).toBe(850)
    expect(final.save).toBe(650)
    expect(final.cash + final.save).toBe(1500)
  })
  it('keeps preview changes hypothetical', () => {
    const data = fixture()
    data.bills = [
      {
        id: 'bill',
        name: 'Bill',
        amount: 100,
        day: 20,
        starts: '2026-10',
        paidMonths: [],
        accountId: 'cash',
      },
    ]
    const base = cashForecast(data, { days: 10, expectedPay: false }),
      event = base.events[0]
    const next = cashForecast(data, {
      days: 10,
      expectedPay: false,
      changes: { [event.id]: { date: '2026-10-22', amount: 250 } },
    })
    expect(next.points.at(-1)!.balances.cash).toBe(750)
    expect(data.bills[0].amount).toBe(100)
  })
  it('does not add optional everyday spending unless requested', () => {
    const data = fixture()
    expect(cashForecast(data, { days: 10 }).events.some((item) => item.type === 'estimate')).toBe(
      false,
    )
    expect(
      cashForecast(data, { days: 10, everyday: true }).events.some(
        (item) => item.type === 'estimate',
      ),
    ).toBe(true)
  })
  it('includes entered subscription schedules without duplicating an existing bill schedule', () => {
    const data = fixture()
    data.subscriptions = [
      {
        id: 'sub',
        name: 'Music',
        amount: 10,
        period: 'monthly',
        renewalDate: '2026-10-20',
        accountId: 'cash',
      },
    ]
    expect(cashForecast(data, { days: 10, expectedPay: false }).points.at(-1)!.balances.cash).toBe(
      990,
    )
    data.bills = [
      {
        id: 'b',
        name: 'Music',
        amount: 10,
        day: 20,
        starts: '2026-10',
        paidMonths: [],
        accountId: 'cash',
      },
    ]
    data.subscriptions[0].billId = 'b'
    expect(cashForecast(data, { days: 10, expectedPay: false }).events).toHaveLength(1)
  })
  it('keeps month-end and leap-year renewal dates anchored', () => {
    const subscription = {
      id: 'sub',
      name: 'Test',
      amount: 1,
      period: 'monthly' as const,
      renewalDate: '2028-01-31',
    }
    expect(subscriptionDates(subscription, '2028-01-01', '2028-03-31')).toEqual([
      '2028-01-31',
      '2028-02-29',
      '2028-03-31',
    ])
  })
  it.each([0, -1, Infinity, NaN, 367])('rejects invalid forecast ranges %s', (days) =>
    expect(() => cashForecast(fixture(), { days })).toThrow(),
  )
  it('protects reserved goal money when checking a purchase', () => {
    const data = fixture()
    const category = data.categories[0]
    category.baseAmount = 2000
    const result = checkAffordability(data, {
      amount: 850,
      categoryId: category.id,
      accountId: 'cash',
      days: 10,
    })
    expect(result.categoryAfter).toBe(1150)
    expect(result.after).toBe(-50)
    expect(result.fits).toBe(false)
    expect(data.transactions).toHaveLength(0)
  })
  it('uses the selected income assumption in a future purchase check', () => {
    const data = fixture()
    const options = {
      amount: 100,
      categoryId: data.categories[0].id,
      accountId: 'cash',
      date: '2026-10-31',
      days: 30,
    }
    const withPay = checkAffordability(data, { ...options, expectedPay: true })
    const withoutPay = checkAffordability(data, { ...options, expectedPay: false })
    expect(withPay.lowest - withoutPay.lowest).toBe(1000)
    expect(withoutPay.forecast.events.some((item) => item.id.startsWith('pay:'))).toBe(false)
  })
  it('flags unavailable scheduled accounts and possible overlap with income entered today', () => {
    const data = fixture()
    data.profile.paydayDays = [17, 30]
    data.transactions = [
      {
        id: 'pay',
        payee: 'Salary',
        type: 'income',
        amount: 1000,
        date: '2026-10-17',
        accountId: 'cash',
      },
      {
        id: 'old',
        payee: 'Purchase',
        type: 'expense',
        amount: 10,
        date: '2026-10-20',
        accountId: 'removed',
      },
    ]
    const result = cashForecast(data)
    expect(result.notes.some((note) => note.includes('unavailable account'))).toBe(true)
    expect(result.notes.some((note) => note.includes('other recorded or scheduled income'))).toBe(
      true,
    )
    expect(
      cashForecast(data, { expectedPay: false }).notes.some((note) =>
        note.includes('Expected pay'),
      ),
    ).toBe(false)
  })
})
describe('edit history and upgrade compatibility', () => {
  it('restores linked transaction, goal and bill changes together', () => {
    const before = fixture()
    const tx = {
      id: 'tx',
      date: '2026-10-17',
      createdAt: '2026-10-17T20:00:00Z',
      payee: 'Saving',
      type: 'transfer' as const,
      amount: 50,
      toAccountId: 'save',
      accountId: 'cash',
      goalId: 'goal',
    }
    const after = withChangeHistory(before, changeTransaction(before, null, tx)),
      entry = after.changeLog![0]
    expect(canRestoreChange(after, entry)).toBe(true)
    const restored = restoreChange(after, entry)
    expect(restored.transactions).toEqual(before.transactions)
    expect(restored.goals).toEqual(before.goals)
    expect(restored.changeLog![0].restoredFrom).toBe(entry.id)
  })
  it('refuses to overwrite a newer related edit, but preserves unrelated edits', () => {
    const before = fixture()
    const after = withChangeHistory(before, {
      ...before,
      accounts: before.accounts!.map((item) =>
        item.id === 'cash' ? { ...item, openingBalance: 900 } : item,
      ),
    })
    const entry = after.changeLog![0],
      newer = {
        ...after,
        accounts: after.accounts!.map((item) =>
          item.id === 'cash' ? { ...item, openingBalance: 800 } : item,
        ),
      }
    expect(() => restoreChange(newer, entry)).toThrow(/changed since/)
    const unrelated = { ...after, profile: { ...after.profile, name: 'Other name' } }
    expect(restoreChange(unrelated, entry).profile.name).toBe('Other name')
  })
  it('previews changed account and goal amounts before saving', () => {
    const data = fixture(),
      tx = {
        id: 'tx',
        date: '2026-10-17',
        createdAt: '2026-10-17T20:00:00Z',
        payee: 'Repair',
        amount: 50,
        type: 'expense' as const,
        accountId: 'cash',
        goalId: 'goal',
        categoryId: data.categories[0].id,
      }
    const lines = previewTransactionChange(data, null, tx)
    expect(lines.some((line) => line.includes('Chequing'))).toBe(true)
    expect(lines.some((line) => line.includes(data.goals[0].name))).toBe(true)
    expect(data.transactions).toHaveLength(0)
  })
  it('merges independent project and subscription edits across devices', () => {
    const base = fixture(),
      local = {
        ...base,
        projects: [
          {
            id: 'project',
            name: 'Trip',
            start: '2026-10-01',
            end: '2026-11-01',
            budget: 1000,
            costs: [],
          },
        ],
      },
      remote = {
        ...base,
        subscriptions: [
          {
            id: 'sub',
            name: 'Music',
            period: 'monthly' as const,
            amount: 10,
            renewalDate: '2026-10-20',
          },
        ],
      }
    const merged = mergeSnapshots(base, local, remote)
    expect(merged.conflicts).toHaveLength(0)
    expect(merged.data.projects).toHaveLength(1)
    expect(merged.data.subscriptions).toHaveLength(1)
    expect(parseBackup(JSON.stringify(merged.data)).projects?.[0].name).toBe('Trip')
  })
  it('round-trips older backups and rejects malformed optional features', () => {
    const data = fixture()
    expect(parseBackup(JSON.stringify(data)).version).toBe(1)
    for (const patch of [
      {
        projects: [
          { id: 'p', name: 'Trip', budget: Infinity, start: 'bad', end: 'bad', costs: [] },
        ],
      },
      {
        subscriptions: [
          { id: 's', name: 'Trial', amount: -1, period: 'monthly', renewalDate: '2026-10-20' },
        ],
      },
      {
        settings: {
          ...data.settings,
          entryTemplates: [{ id: 'x', name: 'Bad', payee: 'Bad', type: 'fake' }],
        },
      },
    ])
      expect(() => parseBackup(JSON.stringify({ ...data, ...patch }))).toThrow()
  })
  it('keeps project saving, transfers, refunds and expenses distinct', () => {
    const data = fixture()
    data.projects = [
      {
        id: 'trip',
        name: 'Trip',
        budget: 500,
        start: '2026-10-01',
        end: '2026-11-01',
        goalId: 'goal',
        costs: [{ id: 'cost', name: 'Hotel', amount: 100, date: '2026-10-24', paid: false }],
      },
    ]
    data.transactions = [
      {
        id: 'a',
        date: '2026-10-17',
        payee: 'Hotel',
        amount: 80,
        type: 'expense',
        projectId: 'trip',
      },
      {
        id: 'b',
        date: '2026-10-17',
        payee: 'Refund',
        amount: 20,
        type: 'expense',
        refund: true,
        projectId: 'trip',
      },
      {
        id: 'c',
        date: '2026-10-17',
        payee: 'Move saving',
        amount: 100,
        type: 'transfer',
        projectId: 'trip',
      },
    ]
    expect(projectTotals(data, 'trip')).toMatchObject({
      spent: 60,
      remaining: 440,
      upcoming: 100,
      afterUpcoming: 340,
    })
  })
  it('requires three user-confirmed complete months for personal suggestions', () => {
    const data = fixture()
    data.transactions = ['2026-07', '2026-08', '2026-09'].map((month, i) => ({
      id: String(i),
      date: `${month}-10`,
      payee: 'Grocery',
      amount: 100 + i * 10,
      type: 'expense',
      categoryId: data.categories[0].id,
    }))
    expect(spendingSuggestions(data, '2026-10')).toHaveLength(0)
    data.settings.completeMonths = ['2026-07', '2026-08', '2026-09']
    expect(spendingSuggestions(data, '2026-10')[0].median).toBe(110)
  })
  it('requires widget opt-in and sends no financial records or authentication data', () => {
    const data = fixture()
    expect(widgetSummary(data)).toEqual({ version: 1, enabled: false })
    data.settings.nativeWidgets = true
    const summary = widgetSummary(data)
    expect(summary.enabled).toBe(true)
    expect(summary).not.toHaveProperty('recordedIncome')
    expect(JSON.stringify(summary)).not.toContain('transactions')
    expect(JSON.stringify(summary)).not.toContain('Chequing')
    expect(widgetSummary(data, true).enabled).toBe(false)
  })
})

describe('bounded history for bulk edits', () => {
  it('keeps an import summary instead of offering a dangerous partial restore', () => {
    const before = fixture()
    const after = withChangeHistory(before, {
      ...before,
      transactions: Array.from({ length: 201 }, (_, index) => ({
        id: `bulk-${index}`,
        date: '2026-10-17',
        payee: 'Imported purchase',
        amount: 1,
        type: 'expense' as const,
      })),
    })
    expect(after.transactions).toHaveLength(201)
    expect(after.changeLog?.[0].changes).toHaveLength(0)
    expect(canRestoreChange(after, after.changeLog![0])).toBe(false)
  })
})
