import { describe, expect, it } from 'vitest'
import { buildOnboardedData, makeInitialData } from './defaults'
import { categoryBudget, currentMonth, monthlyPay } from './finance'

describe('starting plan', () => {
  it('keeps visible example costs even when income is lower, without adding unchosen costs', () => {
    const base = makeInitialData('Sam')
    const input = {
      ...base,
      profile: {
        ...base.profile,
        payAmount: 100,
        payFrequency: 'weekly' as const,
        housing: 'No rent or mortgage',
        transport: 'Walk or bike',
      },
    }
    const plan = buildOnboardedData(input)
    const total = plan.categories.reduce((sum, category) => sum + category.baseAmount, 0)
    expect(total).toBeGreaterThan(monthlyPay(100, 'weekly'))
    expect(
      plan.categories.some(
        (category) =>
          category.name === 'Rent' || category.name === 'Mortgage' || category.name === 'Gas',
      ),
    ).toBe(false)
    expect(plan.settings.currency).toBe('CAD')
    expect(plan.categories.find((category) => category.name === 'Groceries')).toMatchObject({
      baseAmount: 450,
      suggested: true,
    })
  })
  it('uses the real housing payment, a Vancouver rent example, and the 2026 transit fare', () => {
    const base = makeInitialData()
    const input = {
      ...base,
      profile: {
        ...base.profile,
        housing: 'I rent',
        transport: 'Public transit',
        payAmount: 500,
        payFrequency: 'monthly' as const,
      },
    }
    const example = buildOnboardedData(input)
    expect(example.categories.find((category) => category.name === 'Rent')).toMatchObject({
      baseAmount: 2154,
      suggested: true,
    })
    expect(example.categories.find((category) => category.name === 'Transit')?.baseAmount).toBe(
      117.2,
    )
    const actual = buildOnboardedData({
      ...input,
      profile: { ...input.profile, housingPayment: 975 },
    })
    expect(actual.categories.find((category) => category.name === 'Rent')).toMatchObject({
      baseAmount: 975,
      suggested: false,
    })
    expect(
      categoryBudget(
        actual.categories.find((category) => category.name === 'Rent')!,
        currentMonth(),
        500,
      ),
    ).toBe(975)
  })
  it('does not invent a mortgage payment and connects entered goal contributions', () => {
    const base = makeInitialData()
    const plan = buildOnboardedData({
      ...base,
      profile: { ...base.profile, housing: 'I own a home', payAmount: 3000 },
      goals: [
        {
          id: 's',
          kind: 'saving',
          name: 'Holiday',
          balance: 0,
          target: 1000,
          monthly: 125,
          annualInterest: 0,
          color: '#fff',
          icon: 'Plane',
          history: [],
        },
        {
          id: 'd',
          kind: 'debt',
          name: 'Card',
          balance: 800,
          target: 0,
          monthly: 80,
          annualInterest: 18,
          color: '#fff',
          icon: 'CreditCard',
          history: [],
        },
      ],
    })
    expect(plan.categories.find((category) => category.name === 'Mortgage')).toMatchObject({
      baseAmount: 0,
      needsAmount: true,
    })
    expect(plan.categories.find((category) => category.name === 'Savings')?.baseAmount).toBe(125)
    expect(plan.categories.find((category) => category.name === 'Debt Payments')?.baseAmount).toBe(
      80,
    )
  })
  it('never assumes that choosing a car means a loan payment', () => {
    const base = makeInitialData()
    const input = { ...base, profile: { ...base.profile, transport: 'Car' } }
    expect(
      buildOnboardedData(input).categories.some((category) => category.name === 'Car Payment'),
    ).toBe(false)
    const withLoan = buildOnboardedData({
      ...input,
      profile: { ...input.profile, carPayment: 280 },
    })
    expect(withLoan.categories.find((category) => category.name === 'Car Payment')).toMatchObject({
      baseAmount: 280,
      suggested: false,
    })
  })
  it('marks missing savings and debt amounts for the user instead of inventing payments', () => {
    const base = makeInitialData()
    const plan = buildOnboardedData({
      ...base,
      profile: { ...base.profile, reason: 'Get out of debt' },
      goals: [
        {
          id: 'd',
          kind: 'debt',
          name: 'Card',
          balance: 900,
          target: 0,
          monthly: 0,
          annualInterest: 20,
          color: '#fff',
          icon: 'CreditCard',
          history: [],
        },
        {
          id: 's',
          kind: 'saving',
          name: 'Trip',
          balance: 0,
          target: 900,
          monthly: 0,
          annualInterest: 0,
          color: '#fff',
          icon: 'Plane',
          history: [],
        },
      ],
    })
    expect(plan.categories.find((category) => category.name === 'Debt Payments')).toMatchObject({
      baseAmount: 0,
      needsAmount: true,
      suggested: false,
    })
    expect(plan.categories.find((category) => category.name === 'Savings')).toMatchObject({
      baseAmount: 0,
      needsAmount: true,
      suggested: false,
    })
  })
  it('adds debt and savings categories when goals were selected even if the main reason differs', () => {
    const base = makeInitialData()
    const goals = [
      {
        id: 'debt',
        kind: 'debt' as const,
        name: 'Credit card',
        balance: 100,
        target: 0,
        monthly: 20,
        annualInterest: 20,
        color: '#fff',
        icon: 'CreditCard',
        history: [],
      },
      {
        id: 'saving',
        kind: 'saving' as const,
        name: 'Emergency fund',
        balance: 0,
        target: 1000,
        monthly: 0,
        annualInterest: 0,
        color: '#fff',
        icon: 'Shield',
        history: [],
      },
    ]
    const plan = buildOnboardedData({
      ...base,
      goals,
      profile: {
        ...base.profile,
        payAmount: 3000,
        payFrequency: 'monthly',
        housing: 'I rent',
        transport: 'Public transit',
      },
    })
    expect(plan.categories.map((category) => category.name)).toEqual(
      expect.arrayContaining(['Debt Payments', 'Savings', 'Rent', 'Transit']),
    )
  })
})
