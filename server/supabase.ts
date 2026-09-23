import { createClient } from '@supabase/supabase-js'
import { requiredEnv } from './http'

export function adminClient() {
  return createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SECRET_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
