// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { makeDemoData } from './defaults'
import {
  clearCache,
  clearPending,
  readCache,
  readPending,
  sameData,
  writeCache,
  writePending,
} from './storage'

afterEach(() => localStorage.clear())

describe('device copies for cloud sync', () => {
  it('keeps pending and last saved copies separate for each account', () => {
    const data = makeDemoData()
    writeCache('alice', { data, revision: 4 })
    writePending('alice', { data, revision: 4, changedAt: '2026-09-22T12:00:00Z' })
    expect(readCache('alice')?.revision).toBe(4)
    expect(readPending('alice')?.data.profile.name).toBe('Alex')
    expect(readPending('bob')).toBeNull()
    clearPending('alice')
    expect(readPending('alice')).toBeNull()
    expect(readCache('alice')?.revision).toBe(4)
    clearCache('alice')
    expect(readCache('alice')).toBeNull()
  })
  it('treats malformed local storage as unavailable', () => {
    localStorage.setItem('pockit-pending-alice', '{')
    localStorage.setItem('pockit-cache-alice', '{')
    expect(readPending('alice')).toBeNull()
    expect(readCache('alice')).toBeNull()
  })
  it('recognizes equal cloud JSON even when the database changes object key order', () => {
    const local = makeDemoData()
    const remote = JSON.parse(JSON.stringify(local))
    remote.profile = Object.fromEntries(Object.entries(remote.profile).reverse())
    remote.transactions[0] = Object.fromEntries(Object.entries(remote.transactions[0]).reverse())
    expect(sameData(local, remote)).toBe(true)
    remote.transactions[0].amount += 1
    expect(sameData(local, remote)).toBe(false)
  })
})
