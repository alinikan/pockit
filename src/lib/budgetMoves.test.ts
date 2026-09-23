import { describe, expect, it } from 'vitest'
import { makeInitialData, newCategory } from './defaults'
import { coverOverspend } from './budgetMoves'

describe('covering budget overages', () => {
  it('moves only the selected month allocation and leaves earlier months unchanged', () => {
    const data = makeInitialData()
    data.profile.payAmount = 1000
    data.profile.payFrequency = 'monthly'
    data.categories = [
      newCategory('Food', 'ShoppingBasket', 'Food & Dining', '#aaa', 100, '2026-01'),
      newCategory('Fun', 'Play', 'Lifestyle', '#bbb', 100, '2026-01'),
    ]
    data.transactions = [
      {
        id: 'spent',
        date: '2026-02-12',
        type: 'expense',
        payee: 'Food',
        amount: 120,
        categoryId: data.categories[0].id,
      },
    ]
    const next = coverOverspend(data, '2026-02', data.categories[0].id, data.categories[1].id, 20)
    expect(next.categories[0].overrides['2026-02']).toBe(120)
    expect(next.categories[1].overrides['2026-02']).toBe(80)
    expect(data.categories[0].overrides['2026-02']).toBeUndefined()
    expect(() =>
      coverOverspend(data, '2026-02', data.categories[0].id, data.categories[1].id, 101),
    ).toThrow()
  })
})
