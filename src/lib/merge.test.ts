import { describe, expect, it } from 'vitest'
import { makeDemoData } from './defaults'
import { mergeSnapshots } from './storage'

describe('cross-device merges', () => {
  it('combines independent transactions and settings', () => {
    const base = makeDemoData()
    const local = {
      ...base,
      transactions: [...base.transactions, { ...base.transactions[0], id: 'phone-entry' }],
    }
    const remote = {
      ...base,
      settings: { ...base.settings, theme: 'light' as const },
      transactions: [...base.transactions, { ...base.transactions[1], id: 'laptop-entry' }],
    }
    const merged = mergeSnapshots(base, local, remote)
    expect(merged.conflicts).toEqual([])
    expect(merged.data.settings.theme).toBe('light')
    expect(merged.data.transactions.some((transaction) => transaction.id === 'phone-entry')).toBe(
      true,
    )
    expect(merged.data.transactions.some((transaction) => transaction.id === 'laptop-entry')).toBe(
      true,
    )
  })
  it('refuses to guess when the same transaction changes on both devices', () => {
    const base = makeDemoData()
    const local = {
      ...base,
      transactions: base.transactions.map((entry, index) =>
        index ? entry : { ...entry, amount: 40 },
      ),
    }
    const remote = {
      ...base,
      transactions: base.transactions.map((entry, index) =>
        index ? entry : { ...entry, amount: 60 },
      ),
    }
    expect(mergeSnapshots(base, local, remote).conflicts).toContain(
      `transactions:${base.transactions[0].id}`,
    )
    const resolved = mergeSnapshots(
      base,
      {
        ...local,
        transactions: [...local.transactions, { ...base.transactions[1], id: 'phone-only' }],
      },
      remote,
      'cloud',
    )
    expect(
      resolved.data.transactions.find((entry) => entry.id === base.transactions[0].id)?.amount,
    ).toBe(60)
    expect(resolved.data.transactions.some((entry) => entry.id === 'phone-only')).toBe(true)
  })
  it('detects deletion against editing of the same record', () => {
    const base = makeDemoData()
    const local = { ...base, transactions: base.transactions.slice(1) }
    const remote = {
      ...base,
      transactions: base.transactions.map((entry, index) =>
        index ? entry : { ...entry, amount: 60 },
      ),
    }
    expect(mergeSnapshots(base, local, remote).conflicts).toHaveLength(1)
  })
})
