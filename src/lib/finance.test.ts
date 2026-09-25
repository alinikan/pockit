import { describe, expect, it } from 'vitest'
import type { Category, Goal, PockitData, Transaction } from '../types'
import {
  billMonthlyReserve,
  billsForMonth,
  categoriesMissingBillDates,
  budgetHealth,
  categorizePayee,
  categoryBudget,
  categoryPolicy,
  monthKey,
  monthSummary,
  money,
  monthlyPay,
  projectGoal,
  receiptFields,
  recurringMerchants,
  setMoneyPrivacy,
  shortDate,
  rolloverBalance,
  rolloverMonth,
  shiftMonth,
  simulateDebtPlan,
  spendingByCategory,
  transactionsInMonth,
} from './finance'
import { makeInitialData } from './defaults'

const category = (patch: Partial<Category> = {}): Category => ({
  id: 'food',
  name: 'Groceries',
  icon: 'ShoppingBasket',
  group: 'Food & Dining',
  color: '#aaa',
  baseAmount: 400,
  changes: {},
  overrides: {},
  starts: '2026-01',
  frequency: 'monthly',
  mode: 'fresh',
  targetType: 'fixed',
  targetValue: 400,
  funding: 'auto',
  notes: '',
  ...patch,
})
const tx = (
  date: string,
  amount: number,
  type: Transaction['type'] = 'expense',
  categoryId = 'food',
): Transaction => ({ id: crypto.randomUUID(), date, amount, type, categoryId, payee: 'Test' })
const debt = (patch: Partial<Goal> = {}): Goal => ({
  id: 'card',
  kind: 'debt',
  name: 'Credit card',
  balance: 1200,
  target: 0,
  monthly: 120,
  annualInterest: 12,
  color: '#f00',
  icon: 'CreditCard',
  history: [],
  ...patch,
})

describe('months and pay frequencies', () => {
  it('shows a friendly calendar date without shifting it across time zones', () => {
    expect(shortDate('2026-09-24')).toBe('Sep 24')
  })
  it('crosses year boundaries in both directions', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })
  it('uses calendar dates for month keys', () =>
    expect(monthKey(new Date(2028, 1, 29))).toBe('2028-02'))
  it('distinguishes biweekly from twice-monthly pay', () => {
    expect(monthlyPay(1000, 'biweekly')).toBeCloseTo(2166.67, 1)
    expect(monthlyPay(1000, 'twice-monthly')).toBe(2000)
    expect(monthlyPay(1000, 'weekly')).toBeCloseTo(4333.33, 1)
  })
})
describe('calendar setup hints', () => {
  it('shows active regular costs without a day and stops prompting for linked bills', () => {
    const data = makeInitialData('Alex')
    const phone = category({
      id: 'phone',
      name: 'Phone',
      group: 'Bills & Utilities',
      baseAmount: 65,
      targetValue: 65,
    })
    const groceries = category()
    data.categories = [phone, groceries]
    expect(categoriesMissingBillDates(data, '2026-09').map((item) => item.id)).toEqual(['phone'])
    data.bills = [
      { id: 'bill-1', name: 'Phone', day: 10, amount: 65, categoryId: 'phone', paidMonths: [] },
    ]
    expect(categoriesMissingBillDates(data, '2026-09')).toHaveLength(0)
    data.bills = []
    phone.paymentDay = 12
    expect(categoriesMissingBillDates(data, '2026-09')).toHaveLength(0)
    phone.paymentDay = undefined
    phone.ends = '2026-08'
    phone.archived = true
    expect(categoriesMissingBillDates(data, '2026-09')).toHaveLength(0)
  })
})
describe('budgets and spending', () => {
  it('uses selected month overrides and excludes earlier months', () => {
    const c = category({ starts: '2026-03', overrides: { '2026-04': 600 } })
    expect(categoryBudget(c, '2026-02', 4000)).toBe(0)
    expect(categoryBudget(c, '2026-04', 4000)).toBe(600)
    expect(categoryBudget(c, '2026-05', 4000)).toBe(400)
  })
  it('applies ongoing amount changes only from their effective month', () => {
    const c = category({ changes: { '2026-09': 500 } })
    expect(categoryBudget(c, '2026-08', 4000)).toBe(400)
    expect(categoryBudget(c, '2026-09', 4000)).toBe(500)
    expect(categoryBudget(c, '2026-12', 4000)).toBe(500)
  })
  it('converts weekly period allocations to monthly', () =>
    expect(
      categoryBudget(category({ frequency: 'weekly', baseAmount: 100 }), '2026-04', 4000),
    ).toBeCloseTo(433.33, 1))
  it('calculates percentage based rollover contributions', () =>
    expect(
      categoryBudget(
        category({ mode: 'rollover', targetType: 'percent', targetValue: 10 }),
        '2026-04',
        5000,
      ),
    ).toBe(500))
  it('counts expenses, not transfers, and keeps income separate', () => {
    const data: PockitData = {
      ...makeInitialData(),
      categories: [category()],
      profile: { ...makeInitialData().profile, payAmount: 2000, payFrequency: 'twice-monthly' },
      transactions: [
        tx('2026-04-05', 100),
        tx('2026-04-06', 50, 'transfer'),
        tx('2026-04-07', 2200, 'income'),
        tx('2026-03-07', 300),
      ],
    }
    expect(transactionsInMonth(data.transactions, '2026-04')).toHaveLength(3)
    expect(spendingByCategory(data.transactions, '2026-04').food).toBe(100)
    expect(monthSummary(data, '2026-04')).toMatchObject({
      income: 4000,
      plannedIncome: 4000,
      actualIncome: 2200,
      spent: 100,
      remaining: 3900,
      recordedNet: 2100,
      allocated: 400,
    })
  })
  it('keeps planned allocations steady after the first paycheque', () => {
    const data = makeInitialData()
    data.profile.payAmount = 2500
    data.profile.payFrequency = 'twice-monthly'
    data.categories = [category({ mode: 'rollover', targetType: 'percent', targetValue: 10 })]
    const before = monthSummary(data, '2026-09')
    data.transactions = [tx('2026-09-01', 2500, 'income')]
    const after = monthSummary(data, '2026-09')
    expect(before.allocated).toBe(500)
    expect(after.allocated).toBe(500)
    expect(after.actualIncome).toBe(2500)
  })
  it('subtracts refunds from spending and distributes split expenses', () => {
    const data = makeInitialData()
    data.transactions = [
      {
        ...tx('2026-09-01', 90),
        splits: [
          { categoryId: 'food', amount: 60 },
          { categoryId: 'care', amount: 30 },
        ],
      },
      { ...tx('2026-09-02', 10), refund: true },
    ]
    expect(spendingByCategory(data.transactions, '2026-09')).toEqual({ food: 50, care: 30 })
    expect(monthSummary(data, '2026-09').spent).toBe(80)
  })
  it('carries unused rollover amounts forward', () => {
    const data = {
      ...makeInitialData(),
      categories: [category({ mode: 'rollover' })],
      transactions: [tx('2026-01-10', 150), tx('2026-02-10', 250)],
    }
    expect(rolloverBalance(data.categories[0], data, '2026-02')).toBe(400)
  })
  it('starts carrying money only when the rule begins, without changing earlier months', () => {
    const fresh = {
      frequency: 'monthly' as const,
      mode: 'fresh' as const,
      targetType: 'fixed' as const,
      targetValue: 100,
      funding: 'auto' as const,
    }
    const c = category({
      baseAmount: 100,
      mode: 'rollover',
      policyChanges: {
        '2026-01': fresh,
        '2026-03': { ...fresh, mode: 'rollover' },
      },
    })
    const data = {
      ...makeInitialData(),
      categories: [c],
      transactions: [tx('2026-01-10', 20), tx('2026-02-10', 30), tx('2026-03-10', 40)],
    }
    expect(categoryPolicy(c, '2026-02').mode).toBe('fresh')
    expect(rolloverBalance(c, data, '2026-02')).toBe(70)
    expect(rolloverMonth(c, data, '2026-03')).toMatchObject({
      carried: 0,
      added: 100,
      spent: 40,
      available: 60,
    })
    expect(rolloverMonth(c, data, '2026-04').carried).toBe(60)
  })
  it('resets carryover for a fresh month and uses one-month policy overrides', () => {
    const rollover = {
      frequency: 'monthly' as const,
      mode: 'rollover' as const,
      targetType: 'fixed' as const,
      targetValue: 100,
      funding: 'auto' as const,
    }
    const c = category({
      baseAmount: 100,
      mode: 'rollover',
      policyOverrides: { '2026-02': { ...rollover, mode: 'fresh' } },
    })
    const data = { ...makeInitialData(), categories: [c], transactions: [] }
    expect(rolloverBalance(c, data, '2026-01')).toBe(100)
    expect(rolloverBalance(c, data, '2026-02')).toBe(100)
    expect(rolloverMonth(c, data, '2026-03').carried).toBe(0)
    expect(rolloverBalance(c, data, '2026-03')).toBe(100)
  })
  it('recalculates a one-month percentage rule when expected income changes', () => {
    const c = category({
      policyOverrides: {
        '2026-02': {
          frequency: 'monthly',
          mode: 'rollover',
          targetType: 'percent',
          targetValue: 10,
          funding: 'auto',
        },
      },
    })
    expect(categoryBudget(c, '2026-01', 4000)).toBe(400)
    expect(categoryBudget(c, '2026-02', 4000)).toBe(400)
    expect(categoryBudget(c, '2026-02', 6000)).toBe(600)
    expect(categoryBudget(c, '2026-03', 6000)).toBe(400)
  })
  it('does not carry fresh balances forward', () => {
    const data = {
      ...makeInitialData(),
      categories: [category()],
      transactions: [tx('2026-01-10', 150), tx('2026-02-10', 250)],
    }
    expect(rolloverBalance(data.categories[0], data, '2026-02')).toBe(150)
  })
  it('uses linked transfers for manually funded rollovers', () => {
    const c = category({ mode: 'rollover', funding: 'manual' })
    const data = {
      ...makeInitialData(),
      categories: [c],
      transactions: [tx('2026-01-10', 250, 'transfer'), tx('2026-02-10', 100)],
    }
    expect(rolloverBalance(c, data, '2026-02')).toBe(150)
  })
  it('carries balances across years and recalculates after an earlier edit', () => {
    const c = category({ starts: '2026-11', baseAmount: 100, targetValue: 100, mode: 'rollover' })
    const data = {
      ...makeInitialData(),
      categories: [c],
      transactions: [tx('2026-11-09', 30), tx('2026-12-20', 50)],
    }
    expect(rolloverMonth(c, data, '2027-01')).toMatchObject({
      carried: 120,
      added: 100,
      spent: 0,
      available: 220,
    })
    data.transactions[0].amount = 60
    expect(rolloverMonth(c, data, '2027-01').available).toBe(190)
    c.overrides['2026-12'] = 150
    expect(rolloverMonth(c, data, '2027-01').available).toBe(240)
  })
  it('keeps a removed category and its earlier plan available in history', () => {
    const c = category({ mode: 'rollover', archived: true, ends: '2026-02' })
    const data = { ...makeInitialData(), categories: [c], transactions: [tx('2026-01-10', 150)] }
    expect(categoryBudget(c, '2026-01', 3000)).toBe(400)
    expect(categoryBudget(c, '2026-03', 3000)).toBe(0)
    expect(rolloverBalance(c, data, '2026-02')).toBe(650)
    expect(spendingByCategory(data.transactions, '2026-01')[c.id]).toBe(150)
  })
  it('spots categories over budget', () => {
    const data = {
      ...makeInitialData(),
      categories: [category()],
      transactions: [tx('2026-02-10', 450)],
    }
    expect(budgetHealth(data, '2026-02').trouble.map((c) => c.id)).toEqual(['food'])
  })
})
describe('goals and debt', () => {
  it('shows zero months for completed goals and debts', () => {
    expect(projectGoal(debt({ balance: 0 })).months).toBe(0)
    expect(projectGoal({ ...debt(), kind: 'saving', balance: 1000, target: 900 }).months).toBe(0)
  })
  it('detects debt payments that cannot cover interest', () =>
    expect(projectGoal(debt({ balance: 1000, annualInterest: 24, monthly: 20 })).months).toBeNull())
  it('projects a zero-interest debt exactly', () =>
    expect(projectGoal(debt({ balance: 1200, annualInterest: 0, monthly: 100 })).months).toBe(12))
  it('projects a savings target with monthly contributions', () =>
    expect(
      projectGoal({
        ...debt(),
        kind: 'saving',
        balance: 0,
        target: 1200,
        annualInterest: 0,
        monthly: 100,
      }).months,
    ).toBe(12))
  it('can reach a savings goal through interest even without new contributions', () => {
    expect(
      projectGoal({
        ...debt(),
        kind: 'saving',
        balance: 1000,
        target: 1100,
        monthly: 0,
        annualInterest: 12,
      }).months,
    ).toBe(10)
    expect(
      projectGoal({
        ...debt(),
        kind: 'saving',
        balance: 1000,
        target: 1100,
        monthly: 0,
        annualInterest: 0,
      }).months,
    ).toBeNull()
  })
  it('puts newly added debt after the saved custom payoff order', () => {
    const goals = [debt({ id: 'first' }), debt({ id: 'new' }), debt({ id: 'second' })]
    expect(
      simulateDebtPlan(goals, {
        strategy: 'custom',
        extra: 0,
        order: ['second', 'first'],
      }).order.map((goal) => goal.id),
    ).toEqual(['second', 'first', 'new'])
  })
  it('applies freed payments to later debts in a plan', () => {
    const goals = [
      debt({ id: 'a', balance: 100, monthly: 100, annualInterest: 0 }),
      debt({ id: 'b', balance: 300, monthly: 100, annualInterest: 0 }),
    ]
    const result = simulateDebtPlan(goals, { strategy: 'balance', extra: 0, order: [] })
    expect(result.months).toBe(2)
    expect(result.payoffMonths).toEqual({ a: 1, b: 2 })
  })
  it('reports a plan with no ability to repay', () =>
    expect(
      simulateDebtPlan([debt({ balance: 1000, annualInterest: 24, monthly: 10 })], {
        strategy: 'interest',
        extra: 0,
        order: [],
      }).months,
    ).toBeNull())
})
describe('dates and smart helpers', () => {
  it('masks displayed amounts without changing calculations', () => {
    setMoneyPrivacy(true)
    try {
      expect(money(1234)).toBe('••••')
    } finally {
      setMoneyPrivacy(false)
    }
    expect(money(1234)).toContain('1,234')
  })
  it('clamps bills on the 31st in February, including leap years', () => {
    const bill = { id: 'x', name: 'Rent', day: 31, amount: 100, paidMonths: [] }
    expect(billsForMonth([bill], '2028-02')[0].date).toBe('2028-02-29')
    expect(billsForMonth([bill], '2027-02')[0].date).toBe('2027-02-28')
  })
  it('schedules quarterly and annual bills only in their due months', () => {
    const bills = [
      {
        id: 'quarter',
        name: 'Insurance',
        day: 31,
        amount: 200,
        paidMonths: [],
        frequency: 'quarterly' as const,
        starts: '2026-01' as const,
      },
      {
        id: 'year',
        name: 'Annual fee',
        day: 5,
        amount: 100,
        paidMonths: [],
        frequency: 'yearly' as const,
        starts: '2026-03' as const,
      },
    ]
    expect(billsForMonth(bills, '2026-02')).toHaveLength(0)
    expect(billsForMonth(bills, '2026-04').map((bill) => bill.id)).toEqual(['quarter'])
    expect(billsForMonth(bills, '2027-03').map((bill) => bill.id)).toEqual(['year'])
  })
  it('estimates a monthly reserve through the next irregular due month', () => {
    const quarterly = {
      id: 'insurance',
      name: 'Insurance',
      amount: 300,
      day: 15,
      starts: '2026-01' as const,
      frequency: 'quarterly' as const,
      paidMonths: [],
    }
    expect(billMonthlyReserve(quarterly, '2026-02')).toEqual({ dueMonth: '2026-04', perMonth: 100 })
    expect(billMonthlyReserve(quarterly, '2026-04')).toEqual({ dueMonth: '2026-04', perMonth: 300 })
    expect(billMonthlyReserve({ ...quarterly, paidMonths: ['2026-04'] }, '2026-04')).toEqual({
      dueMonth: '2026-07',
      perMonth: 100,
    })
    expect(billMonthlyReserve({ ...quarterly, frequency: 'monthly' }, '2026-04')).toBeNull()
  })
  it('suggests a matching category without changing other payees', () => {
    const c = category()
    expect(categorizePayee('Costco Warehouse', [c])).toBe('food')
    expect(categorizePayee('Unknown place', [c])).toBeUndefined()
  })
  it('spots monthly repeat charges within a price tolerance', () => {
    const transactions = [
      tx('2026-01-10', 18.99),
      tx('2026-02-10', 18.99),
      tx('2026-03-10', 40),
    ].map((t) => ({ ...t, payee: 'Netflix' }))
    expect(recurringMerchants(transactions)).toEqual(['netflix'])
  })
  it('reads a receipt total and tolerates missing totals', () => {
    expect(receiptFields('CAFE\nCoffee 3.00\nTOTAL 3.24')).toEqual({ payee: 'CAFE', amount: 3.24 })
    expect(receiptFields('Shop\nTOTAL $1,234.56')).toEqual({ payee: 'Shop', amount: 1234.56 })
    expect(receiptFields('Shop\nHello')).toEqual({ payee: 'Shop', amount: 0 })
  })
})
