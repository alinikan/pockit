import { describe, expect, it } from 'vitest'
import { privacySafeError, privacySafeVitals } from './telemetry'
import type { ErrorEvent } from '@sentry/browser'

describe('private performance URLs', () => {
  it('drops email links, recovery tokens, and paths before reporting a vital', () => {
    expect(
      privacySafeVitals({
        type: 'vital',
        url: 'https://pockit-budget.vercel.app/recovery?email=alex%40example.com#access_token=secret',
        route: '/recovery',
      }),
    ).toEqual({ type: 'vital', url: 'https://pockit-budget.vercel.app/', route: '/' })
  })

  it('drops malformed URLs rather than transmitting them', () => {
    expect(privacySafeVitals({ url: 'not a URL', type: 'vital' })).toBeNull()
  })
})

describe('errors-only diagnostics', () => {
  it('keeps only error type and bundled location, dropping private content', () => {
    const input = {
      event_id: 'event-1',
      message: 'Coffee shop $42.15 paid by jane@example.com',
      request: { url: 'https://pockit-budget.vercel.app/?token=private' },
      user: { email: 'jane@example.com' },
      breadcrumbs: [{ message: 'Payee: Coffee shop' }],
      extra: { balance: 1234 },
      contexts: { state: { goal: 'Vacation' } },
      exception: {
        values: [
          {
            type: 'TypeError',
            value: 'Coffee shop $42.15 paid by jane@example.com',
            stacktrace: {
              frames: [
                {
                  filename: 'https://pockit-budget.vercel.app/assets/index-Abc123.js?token=private',
                  lineno: 10,
                  colno: 20,
                  vars: { payee: 'Coffee shop' },
                },
                { filename: 'https://pockit-budget.vercel.app/private/jane@example.com' },
              ],
            },
          },
        ],
      },
    } as unknown as ErrorEvent
    const safe = privacySafeError(input)
    expect(safe?.exception?.values?.[0].type).toBe('TypeError')
    expect(safe?.exception?.values?.[0].stacktrace?.frames).toEqual([
      { filename: '/assets/index-Abc123.js', lineno: 10, colno: 20 },
    ])
    const serialized = JSON.stringify(safe)
    expect(serialized).not.toMatch(/Coffee shop|jane@example.com|token|Vacation|1234/)
  })

  it('discards events without an exception', () => {
    expect(privacySafeError({ message: 'transaction details' } as ErrorEvent)).toBeNull()
  })
})
