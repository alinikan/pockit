// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeDemoData, makeInitialData } from './lib/defaults'
import { writePending } from './lib/storage'

const cloud = vi.hoisted(() => ({
  snapshot: null as null | { data: unknown; revision: number },
  load: vi.fn(),
  save: vi.fn(),
}))

vi.mock('./lib/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/storage')>()
  return {
    ...actual,
    supabase: {
      auth: {
        getSession: async () => ({
          data: {
            session: {
              user: { id: 'same-account', email: 'sam@example.com', user_metadata: {} },
              access_token: 'test-token',
            },
          },
        }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      },
    },
    loadCloud: cloud.load,
    saveCloud: cloud.save,
  }
})

import App from './App'

beforeEach(() => {
  localStorage.clear()
  const initial = makeInitialData('Sam')
  cloud.snapshot = { data: initial, revision: 1 }
  cloud.load.mockImplementation(async () => cloud.snapshot)
  cloud.save.mockResolvedValue(2)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('same-account setup sync', () => {
  it('replaces an open setup step with newer cloud progress without re-saving the old step', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: /what brings you to pockit/i })
    expect(screen.getByRole('status').textContent).toContain('sam@example.com')
    const next = makeInitialData('Sam')
    next.onboardingStep = 4
    cloud.snapshot = { data: next, revision: 2 }
    act(() => window.dispatchEvent(new Event('online')))
    await screen.findByRole('heading', { name: /anything else you spend on/i })
    await waitFor(() => expect(cloud.save).not.toHaveBeenCalled())
  })

  it('opens the budget when setup was completed in the installed app', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: /what brings you to pockit/i })
    cloud.snapshot = { data: makeDemoData(), revision: 2 }
    act(() => window.dispatchEvent(new Event('online')))
    await waitFor(() => expect(screen.queryByText('YOUR SETUP')).toBeNull())
    expect(screen.getByRole('button', { name: /open more and settings/i })).toBeTruthy()
    expect(cloud.save).not.toHaveBeenCalled()
  })

  it('ignores an old unchanged setup cache when the account has finished setup', async () => {
    const base = makeInitialData('Sam')
    writePending('same-account', {
      data: structuredClone(base),
      base,
      revision: 1,
      changedAt: '2026-09-24T10:00:00Z',
    })
    cloud.snapshot = { data: makeDemoData(), revision: 2 }
    render(<App />)
    await screen.findByRole('button', { name: /open more and settings/i })
    expect(screen.queryByRole('alertdialog', { name: /review changes/i })).toBeNull()
    expect(cloud.save).not.toHaveBeenCalled()
  })

  it('asks before replacing real unsynced setup answers', async () => {
    const base = makeInitialData('Sam')
    const local = structuredClone(base)
    local.profile.reason = 'Get out of debt'
    writePending('same-account', {
      data: local,
      base,
      revision: 1,
      changedAt: '2026-09-24T10:00:00Z',
    })
    cloud.snapshot = { data: makeDemoData(), revision: 2 }
    render(<App />)
    const dialog = await screen.findByRole('alertdialog', { name: /review changes/i })
    expect(dialog.textContent).toMatch(/finished setup on another device/i)
    expect(cloud.save).not.toHaveBeenCalled()
  })

  it('uses the chosen cloud setup step after a two-device review', async () => {
    const base = makeInitialData('Sam')
    const local = structuredClone(base)
    local.profile.reason = 'Get out of debt'
    writePending('same-account', {
      data: local,
      base,
      revision: 1,
      changedAt: '2026-09-24T10:00:00Z',
    })
    const remote = makeInitialData('Sam')
    remote.onboardingStep = 4
    cloud.snapshot = { data: remote, revision: 2 }
    render(<App />)
    await screen.findByRole('alertdialog', { name: /review changes/i })
    act(() => screen.getByRole('button', { name: /use cloud copy/i }).click())
    await screen.findByRole('heading', { name: /anything else you spend on/i })
    expect(cloud.save).not.toHaveBeenCalled()
  })
})
