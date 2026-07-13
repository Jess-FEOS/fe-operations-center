import { createClient } from '@supabase/supabase-js'

/**
 * Server-only Supabase client.
 *
 * This module is imported exclusively by API route handlers (src/app/api/**),
 * never by client components, so it is safe to use the service_role key here.
 * The service_role key bypasses Row Level Security — which is intentional:
 * all database access is funneled through trusted server routes, and RLS is
 * locked to deny-by-default for the public/anon keys that ship to the browser.
 *
 * IMPORTANT: SUPABASE_SERVICE_ROLE_KEY must NOT be prefixed with NEXT_PUBLIC_.
 * It must never be exposed to the browser bundle.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  throw new Error('Missing env var NEXT_PUBLIC_SUPABASE_URL')
}

if (!serviceRoleKey) {
  throw new Error(
    'Missing env var SUPABASE_SERVICE_ROLE_KEY. Set it in Vercel (marked Sensitive) ' +
      'and in .env.local for local dev. Do NOT prefix it with NEXT_PUBLIC_.'
  )
}

export const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
