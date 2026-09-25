import { describe, expect, it } from 'vitest'
import { makeDemoData } from './defaults'
import { parseBackup } from './backup'

describe('backup restore validation', () => {
  it('accepts a current CAD backup', () => {
    const data = makeDemoData()
    expect(parseBackup(JSON.stringify(data)).transactions).toHaveLength(data.transactions.length)
  })
  it('rejects damaged, future, non-CAD, and invalid transaction data', () => {
    expect(() => parseBackup('{')).toThrow(/valid JSON/)
    const future = makeDemoData()
    expect(() => parseBackup(JSON.stringify({ ...future, version: 2 }))).toThrow(/unsupported/)
    expect(() =>
      parseBackup(JSON.stringify({ ...future, settings: { ...future.settings, currency: 'USD' } })),
    ).toThrow(/not marked as CAD/)
    expect(() =>
      parseBackup(
        JSON.stringify({ ...future, transactions: [{ ...future.transactions[0], amount: -1 }] }),
      ),
    ).toThrow(/invalid transaction/)
  })
  it('rejects duplicate IDs, malformed goal and bill records, and invalid split totals', () => {
    const data = makeDemoData()
    expect(() =>
      parseBackup(
        JSON.stringify({ ...data, transactions: [data.transactions[0], data.transactions[0]] }),
      ),
    ).toThrow(/invalid transaction/)
    expect(() =>
      parseBackup(JSON.stringify({ ...data, goals: [{ ...data.goals[0], history: null }] })),
    ).toThrow(/invalid goal/)
    expect(() =>
      parseBackup(JSON.stringify({ ...data, bills: [{ ...data.bills[0], day: 32 }] })),
    ).toThrow(/invalid bill/)
    expect(() =>
      parseBackup(
        JSON.stringify({
          ...data,
          transactions: [
            {
              ...data.transactions[0],
              type: 'expense',
              splits: [{ categoryId: 'food', amount: 1 }],
            },
          ],
        }),
      ),
    ).toThrow(/invalid transaction/)
  })
  it('validates theme, linked goal, and historical category dates without rejecting older backups', () => {
    const data = makeDemoData()
    expect(
      parseBackup(JSON.stringify({ ...data, settings: { ...data.settings, palette: undefined } }))
        .settings.palette,
    ).toBeUndefined()
    expect(() =>
      parseBackup(
        JSON.stringify({ ...data, settings: { ...data.settings, palette: 'invisible' } }),
      ),
    ).toThrow(/invalid profile or settings/)
    expect(() =>
      parseBackup(JSON.stringify({ ...data, profile: { ...data.profile, carPayment: -1 } })),
    ).toThrow(/invalid profile or settings/)
    expect(() =>
      parseBackup(
        JSON.stringify({
          ...data,
          categories: [{ ...data.categories[0], archived: true, ends: '2020-01' }],
        }),
      ),
    ).toThrow(/invalid category/)
    expect(() =>
      parseBackup(
        JSON.stringify({
          ...data,
          categories: [{ ...data.categories[0], linkedGoalKind: 'other' }],
        }),
      ),
    ).toThrow(/invalid category/)
    expect(() =>
      parseBackup(
        JSON.stringify({
          ...data,
          categories: [{ ...data.categories[0], changes: { '2026-88': 20 } }],
        }),
      ),
    ).toThrow(/invalid category/)
    expect(() =>
      parseBackup(
        JSON.stringify({
          ...data,
          categories: [
            {
              ...data.categories[0],
              policyOverrides: { '2026-09': { mode: 'rollover', targetValue: -1 } },
            },
          ],
        }),
      ),
    ).toThrow(/invalid category/)
  })
})
