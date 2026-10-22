import { createClient } from '@supabase/supabase-js'
import { isReadOnly } from '@/lib/access-policy'

/**
 * Server-only Supabase client.
 *
 * This module is imported exclusively by API route handlers (src/app/api/**),
 * never by client components, so it is safe to use the service_role key here.
 * The service_role key bypasses Row Level Security — which is intentional:
 * database access is funneled through server routes. RLS coverage is managed
 * separately. Production routes retain open access by owner approval; keeping
 * this key server-side does NOT authenticate app users.
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
  global: {
    // Preview write protection also sits at the data boundary, independently
    // of middleware. Production access intentionally remains open.
    fetch: async (input, init) => {
      const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()
      if (isReadOnly(process.env) && !['GET','HEAD','OPTIONS'].includes(method)) {
        return new Response(JSON.stringify({ message:'Read-only review: database writes are disabled.' }),{status:403,headers:{'Content-Type':'application/json'}})
      }
      return fetch(input,init)
    },
  },
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
