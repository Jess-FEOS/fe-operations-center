import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { allowedEmail, isReadOnly } from '@/lib/access-policy'

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
  global: {
    // Defense in depth: authorization and read-only enforcement also sit at
    // the data boundary, independently of Next.js middleware.
    fetch: async (input, init) => {
      const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()
      if (isReadOnly(process.env) && !['GET','HEAD','OPTIONS'].includes(method)) {
        return new Response(JSON.stringify({ message:'Read-only review: database writes are disabled.' }),{status:403,headers:{'Content-Type':'application/json'}})
      }
      const preview = process.env.VERCEL_ENV === 'preview'
      const localReview = process.env.NODE_ENV === 'development' && process.env.OPS_LOCAL_REVIEW === 'true'
      if (!preview && !localReview) {
        const token = (await cookies()).get('fe-session')?.value
        if (!token || !process.env.OPS_ALLOWED_EMAILS) {
          return new Response(JSON.stringify({message:'Approved team sign-in required.'}),{status:401})
        }
        const identity = await fetch(`${supabaseUrl}/auth/v1/user`, {
          headers:{apikey:serviceRoleKey,Authorization:`Bearer ${token}`},cache:'no-store',
        })
        const user=identity.ok ? await identity.json() : null
        if(!allowedEmail(user?.email,process.env.OPS_ALLOWED_EMAILS)) {
          return new Response(JSON.stringify({message:'Approved team sign-in required.'}),{status:401})
        }
      }
      return fetch(input,init)
    },
  },
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
