import { createClient } from '@supabase/supabase-js'

export function getServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

// Alias for convenience
export const createAdminClient = getServiceRoleClient

// Helper to generate a clean, secure, shareable password
export function generateTeacherPassword(name: string): string {
  const cleanName = name.split(' ')[0].replace(/[^a-zA-Z]/g, '') || 'Teacher'
  const randomChars = Math.random().toString(36).slice(-4).toUpperCase()
  const year = new Date().getFullYear()
  return `Elkanemi@${cleanName}${year}!${randomChars}`
}
