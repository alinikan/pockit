import { describe, expect, it } from 'vitest'
import { makeInitialData, newCategory } from './defaults'
import type { Transaction } from '../types'
import { parseBackup } from './backup'
import { changeTransaction } from './linked'
import { categoryPlanUsage, monthSummary } from './finance'
import {
  addSpendingCategories,
  availableCategoryPresets,
  categoryMatches,
  categorySearchText,
  resolveSpendingSelection,
  spendingCategoryLibrary,
  transactionDescription,
} from './categoryLibrary'

const tobacco = spendingCategoryLibrary.find((item) => item.name === 'Cigarettes & Tobacco')!
const toys = spendingCategoryLibrary.find((item) => item.name === 'Toys & Games')!
const purchase = (patch: Partial<Transaction> = {}): Transaction => ({
  id: 'purchase',
  type: 'expense',
  amount: 25,
  date: '2026-10-18',
  payee: '',
  categoryId: tobacco.id,
  ...patch,
})

describe('spending category library', () => {
  it('has unique stable identifiers and an alphabetic, broad collection', () => {
    expect(spendingCategoryLibrary.length).toBeGreaterThanOrEqual(60)
    expect(new Set(spendingCategoryLibrary.map((item) => item.id)).size).toBe(
      spendingCategoryLibrary.length,
    )
    expect(spendingCategoryLibrary.map((item) => item.name)).toEqual(
      spendingCategoryLibrary.map((item) => item.name).sort((a, b) => a.localeCompare(b, 'en-CA')),
    )
    expect(
      spendingCategoryLibrary.every(
        (item) => /^#[0-9a-f]{6}$/i.test(item.color) && item.icon && item.group,
      ),
    ).toBe(true)
  })
  it.each([
    ['smokes', 'Cigarettes & Tobacco'],
    ['lego', 'Toys & Games'],
    ['ps5', 'Video Games'],
    ['random', 'Other Spending'],
    ['pharmacy', 'Medicines & Pharmacy'],
  ])('finds %s using familiar words', (query, name) => {
    expect(availableCategoryPresets([], query).map((item) => item.name)).toContain(name)
  })
  it('supports accents, non-Latin custom names, and multiple search words', () => {
    expect(categorySearchText('CAFÉ & Toys')).toBe('cafe toys')
    expect(categoryMatches({ name: 'Café Québec', group: 'Food & Dining' }, 'cafe food')).toBe(true)
    expect(categoryMatches({ name: '食品', group: 'Food' }, '食品')).toBe(true)
    expect(categoryMatches(toys, 'toys rent')).toBe(false)
  })
  it('adds only requested categories with zero limits and preserves every existing amount', () => {
    const data = makeInitialData('Alex')
    data.categories = [newCategory('Rent', 'House', 'Bills', '#123456', 1500, '2026-09')]
    const before = structuredClone(data)
    const next = addSpendingCategories(
      data,
      [tobacco.id, tobacco.id, 'not-real', toys.id],
      '2026-10',
    )
    expect(data).toEqual(before)
    expect(next.categories[0]).toEqual(data.categories[0])
    expect(next.categories).toHaveLength(3)
    expect(next.categories[1]).toMatchObject({
      id: tobacco.id,
      baseAmount: 0,
      needsAmount: true,
      starts: '2026-10',
    })
    expect(addSpendingCategories(next, [tobacco.id, toys.id], '2026-11')).toBe(next)
  })
  it('does not duplicate existing or archived names, even with punctuation differences', () => {
    const data = makeInitialData('Alex')
    data.categories = [
      {
        ...newCategory('Cigarettes + Tobacco', 'Cigarette', 'Lifestyle', '#123456', 80, '2026-09'),
        archived: true,
      },
    ]
    expect(availableCategoryPresets(data.categories).some((item) => item.id === tobacco.id)).toBe(
      false,
    )
    expect(addSpendingCategories(data, [tobacco.id], '2026-10')).toBe(data)
    expect(resolveSpendingSelection(data, purchase()).entry.categoryId).toBe(data.categories[0].id)
  })
  it('resolves split selections once, on the transaction month, and updates all derived totals', () => {
    const data = makeInitialData('Alex')
    data.categories = []
    const selected = resolveSpendingSelection(
      data,
      purchase({
        amount: 50,
        categoryId: undefined,
        splits: [
          { categoryId: tobacco.id, amount: 20 },
          { categoryId: toys.id, amount: 30 },
        ],
      }),
    )
    expect(selected.data.categories).toHaveLength(2)
    const next = changeTransaction(selected.data, null, {
      ...selected.entry,
      payee: transactionDescription(selected.entry, selected.data.categories),
    })
    expect(categoryPlanUsage(next, '2026-10')).toMatchObject({ [tobacco.id]: 20, [toys.id]: 30 })
    expect(monthSummary(next, '2026-10').spent).toBe(50)
    expect(monthSummary(next, '2026-09').spent).toBe(0)
    const restored = parseBackup(JSON.stringify(next))
    expect(restored.categories.map((item) => item.id)).toEqual(
      next.categories.map((item) => item.id),
    )
    expect(categoryPlanUsage(restored, '2026-10')).toEqual(categoryPlanUsage(next, '2026-10'))
  })
  it('never adds expense categories to income or transfers', () => {
    const data = makeInitialData('Alex')
    for (const type of ['income', 'transfer'] as const) {
      const entry = purchase({ type })
      expect(resolveSpendingSelection(data, entry)).toEqual({ data, entry })
      expect(transactionDescription(entry, [])).toBe('')
    }
  })
  it('makes an optional purchase description useful without changing typed words', () => {
    expect(transactionDescription(purchase(), [])).toBe('Cigarettes & Tobacco')
    expect(transactionDescription(purchase({ payee: '  Cigarettes at 7-Eleven  ' }), [])).toBe(
      'Cigarettes at 7-Eleven',
    )
    expect(transactionDescription(purchase({ categoryId: undefined }), [])).toBe('Purchase')
    expect(transactionDescription(purchase({ refund: true }), [])).toBe(
      'Refund · Cigarettes & Tobacco',
    )
    expect(
      transactionDescription(purchase({ splits: [{ categoryId: toys.id, amount: 25 }] }), []),
    ).toBe('Split purchase')
  })
})
