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
})
