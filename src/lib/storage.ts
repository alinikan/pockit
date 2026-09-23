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
