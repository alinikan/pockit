import { describe, expect, it } from 'vitest'
import { buildOnboardedData, makeInitialData } from './defaults'
import { monthlyPay } from './finance'

describe('starting plan', () => {
  it('scales suggestions to pay without including housing or transport that was not chosen', () => {
    const base = makeInitialData('Sam')
    const input = {
      ...base,
      profile: {
        ...base.profile,
        payAmount: 500,
        payFrequency: 'weekly' as const,
        housing: 'No rent or mortgage',
        transport: 'Walk or bike',
      },
    }
    const plan = buildOnboardedData(input)
    const total = plan.categories.reduce((sum, category) => sum + category.baseAmount, 0)
    expect(total).toBeLessThanOrEqual(
      monthlyPay(500, 'weekly') * 0.9 + plan.categories.length * 2.5,
    )
    expect(
      plan.categories.some(
        (category) =>
          category.name === 'Rent' || category.name === 'Mortgage' || category.name === 'Gas',
      ),
    ).toBe(false)
    expect(plan.settings.currency).toBe('CAD')
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
