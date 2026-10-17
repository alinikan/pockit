// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { clearEntryDraft, readEntryDraft, writeEntryDraft } from './entryDraft'
import { sendWidgetSummary } from './nativeCompanion'
import { makeDemoData } from './defaults'
afterEach(() => {
  localStorage.clear()
  delete (window as unknown as { webkit?: unknown }).webkit
})
describe('private device drafts and native bridge', () => {
  it('keeps drafts separate for different accounts and clears only the chosen account', () => {
    const draft = {
      id: 'draft',
      date: '2026-10-17',
      amount: 42.1,
      payee: 'Grocery',
      type: 'expense' as const,
    }
    writeEntryDraft('alice', draft)
    writeEntryDraft('bob', { ...draft, payee: 'Bob purchase' })
    expect(readEntryDraft('alice')?.payee).toBe('Grocery')
    expect(readEntryDraft('bob')?.payee).toBe('Bob purchase')
    clearEntryDraft('alice')
    expect(readEntryDraft('alice')).toBeNull()
    expect(readEntryDraft('bob')).toBeTruthy()
  })
  it('rejects corrupted drafts and tolerates no native bridge', () => {
    localStorage.setItem('pockit-entry-draft:alice', 'bad json')
    expect(readEntryDraft('alice')).toBeNull()
    expect(() => sendWidgetSummary(makeDemoData())).not.toThrow()
  })
  it('sends only a disabled summary and theme without opt-in, and survives bridge failure', () => {
    const messages: unknown[] = []
    ;(window as unknown as { webkit: unknown }).webkit = {
      messageHandlers: { pockitWidget: { postMessage: (value: unknown) => messages.push(value) } },
    }
    sendWidgetSummary(makeDemoData())
    expect(messages[0]).toEqual({ version: 1, enabled: false, theme: 'dark' })
    ;(window as unknown as { webkit: unknown }).webkit = {
      messageHandlers: {
        pockitWidget: {
          postMessage: () => {
            throw new Error('Bridge unavailable')
          },
        },
      },
    }
    expect(() => sendWidgetSummary(makeDemoData())).not.toThrow()
  })
})
