import { supabase } from './supabase'

/**
 * Test Supabase connection
 * @returns {Promise<boolean>} true if connected successfully
 */
export async function testSupabaseConnection() {
  try {
    console.log('🔄 Testing Supabase connection...')

    // Simple auth check - this will work even without tables
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error) {
      console.error('❌ Supabase connection failed:', error.message)
      return false
    }

    console.log('✅ Supabase connected successfully!')
    console.log('📊 Project URL:', import.meta.env.VITE_SUPABASE_URL)
    console.log('🔑 Anon key configured:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Yes' : 'No')
    console.log('🔐 Auth session:', session ? 'Logged in' : 'Anonymous (OK)')
    return true
  } catch (err) {
    console.error('❌ Unexpected error:', err.message)
    return false
  }
}
