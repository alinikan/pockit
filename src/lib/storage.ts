import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import type { PockitData } from '../types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase: SupabaseClient | null =
  url && key && !url.includes('YOUR_PROJECT_REF')
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
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
export const loadCloud = async (session: Session): Promise<PockitData | null> => {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('pockit_data')
    .select('data')
    .eq('user_id', session.user.id)
    .maybeSingle()
  if (error) throw error
  return (data?.data as PockitData) || null
}
export const saveCloud = async (session: Session, data: PockitData) => {
  if (!supabase) return
  const { error } = await supabase
    .from('pockit_data')
    .upsert(
      { user_id: session.user.id, data, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
  if (error) throw error
}
