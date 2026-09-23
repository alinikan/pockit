import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import type { PockitData } from '../types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase: SupabaseClient | null =
  url && key && !url.includes('YOUR_PROJECT_REF')
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          experimental: { passkey: true },
        },
      })
    : null

export const readDemo = (): PockitData | null => {
  try {
    const raw = localStorage.getItem('pockit-demo-v1')
    return raw ? (JSON.parse(raw) as PockitData) : null
  } catch {
    return null
  }
}
export const saveDemo = (data: PockitData) =>
  localStorage.setItem('pockit-demo-v1', JSON.stringify(data))
export interface CloudSnapshot {
  data: PockitData
  revision: number
}
export interface PendingSnapshot extends CloudSnapshot {
  changedAt: string
  /** Last cloud data this device started editing from. Used for safe three-way merges. */
  base?: PockitData
}
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([key, entry]) => [key, canonical(entry)]),
    )
  return value
}
export const sameData = (first: PockitData, second: PockitData) =>
  JSON.stringify(canonical(first)) === JSON.stringify(canonical(second))
const equal = (first: unknown, second: unknown) =>
  JSON.stringify(canonical(first)) === JSON.stringify(canonical(second))

/** Merge disjoint edits; never guess when both devices changed the same field or record. */
export function mergeSnapshots(
  base: PockitData,
  local: PockitData,
  remote: PockitData,
  prefer: 'device' | 'cloud' = 'device',
) {
  const conflicts: string[] = []
  function choose<T>(name: string, before: T, here: T, there: T): T {
    if (equal(here, there)) return here
    if (equal(here, before)) return there
    if (equal(there, before)) return here
    conflicts.push(name)
    return prefer === 'device' ? here : there
  }
  function fields<T extends object>(name: string, before: T, here: T, there: T): T {
    const keys = new Set([...Object.keys(before), ...Object.keys(here), ...Object.keys(there)])
    return Object.fromEntries(
      [...keys].map((key) => [
        key,
        choose(
          `${name}.${key}`,
          (before as Record<string, unknown>)[key],
          (here as Record<string, unknown>)[key],
          (there as Record<string, unknown>)[key],
        ),
      ]),
    ) as T
  }
  function records<T extends { id: string }>(
    name: string,
    before: T[] = [],
    here: T[] = [],
    there: T[] = [],
  ): T[] {
    const old = new Map(before.map((item) => [item.id, item]))
    const mine = new Map(here.map((item) => [item.id, item]))
    const theirs = new Map(there.map((item) => [item.id, item]))
    const ids = new Set([...old.keys(), ...theirs.keys(), ...mine.keys()])
    const output: T[] = []
    for (const id of ids) {
      const item = choose(`${name}:${id}`, old.get(id), mine.get(id), theirs.get(id))
      if (item) output.push(item)
    }
    return output
  }
  const data: PockitData = {
    ...remote,
    version: choose('version', base.version, local.version, remote.version),
    onboarded: choose('onboarded', base.onboarded, local.onboarded, remote.onboarded),
    onboardingStep: choose(
      'onboardingStep',
      base.onboardingStep,
      local.onboardingStep,
      remote.onboardingStep,
    ),
    profile: fields('profile', base.profile, local.profile, remote.profile),
    settings: fields('settings', base.settings, local.settings, remote.settings),
    debtPlan: choose('debtPlan', base.debtPlan, local.debtPlan, remote.debtPlan),
    accounts: records('accounts', base.accounts, local.accounts, remote.accounts),
    categories: records('categories', base.categories, local.categories, remote.categories),
    transactions: records(
      'transactions',
      base.transactions,
      local.transactions,
      remote.transactions,
    ),
    goals: records('goals', base.goals, local.goals, remote.goals),
    bills: records('bills', base.bills, local.bills, remote.bills),
  }
  return { data, conflicts }
}
const pendingKey = (userId: string) => `pockit-pending-${userId}`
const cacheKey = (userId: string) => `pockit-cache-${userId}`
export const readPending = (userId: string): PendingSnapshot | null => {
  try {
    const value = JSON.parse(localStorage.getItem(pendingKey(userId)) || 'null')
    return value && typeof value.revision === 'number' && value.data ? value : null
  } catch {
    return null
  }
}
export const writePending = (userId: string, pending: PendingSnapshot) =>
  localStorage.setItem(pendingKey(userId), JSON.stringify(pending))
export const clearPending = (userId: string) => localStorage.removeItem(pendingKey(userId))
export const readCache = (userId: string): CloudSnapshot | null => {
  try {
    const value = JSON.parse(localStorage.getItem(cacheKey(userId)) || 'null')
    return value && typeof value.revision === 'number' && value.data ? value : null
  } catch {
    return null
  }
}
export const writeCache = (userId: string, snapshot: CloudSnapshot) =>
  localStorage.setItem(cacheKey(userId), JSON.stringify(snapshot))
export const clearCache = (userId: string) => localStorage.removeItem(cacheKey(userId))
export const downloadJSON = (data: PockitData, filename: string) => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export const loadCloud = async (session: Session): Promise<CloudSnapshot | null> => {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('pockit_data')
    .select('data,revision')
    .eq('user_id', session.user.id)
    .maybeSingle()
  if (error) throw error
  return data ? { data: data.data as PockitData, revision: Number(data.revision) } : null
}
export const saveCloud = async (_session: Session, data: PockitData, revision: number) => {
  if (!supabase) throw new Error('Cloud sync is not configured.')
  const { data: nextRevision, error } = await supabase.rpc('pockit_save', {
    expected_revision: revision,
    next_data: data,
  })
  if (error) throw error
  return Number(nextRevision)
}
export const isConflictError = (error: unknown) =>
  error instanceof Error && error.message.includes('POCKIT_CONFLICT')
