import { createClient } from '@supabase/supabase-js'
import {
  AUTH_REQUEST_TIMEOUT_MS,
  createAuthTimeoutFetch,
} from './authRequestTimeout'
import type { Database } from '../types/database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Check your .env.local file.'
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  global: { fetch: createAuthTimeoutFetch(AUTH_REQUEST_TIMEOUT_MS) },
})
