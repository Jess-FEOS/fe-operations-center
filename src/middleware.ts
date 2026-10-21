import { NextRequest, NextResponse } from 'next/server'
import { allowedEmail, allowedOrigin, isReadOnly, isReadRequest } from '@/lib/access-policy'

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const api = path.startsWith('/api/')
  const preview = process.env.VERCEL_ENV === 'preview'
  const localReview = process.env.NODE_ENV === 'development' && process.env.OPS_LOCAL_REVIEW === 'true'
  const authRoute = path === '/api/auth/login' || path === '/api/auth/logout'
  if (api && !['GET','HEAD','OPTIONS'].includes(request.method)) {
    const origin = request.headers.get('origin')
    // Next may normalize nextUrl to localhost behind a proxy. Compare the
    // browser Origin with the incoming Host, never a forwarded-host override.
    if (!allowedOrigin(origin,request.headers.get('host'))) return NextResponse.json({ error:'Cross-origin writes are not allowed.' },{status:403})
    if (!authRoute && isReadOnly(process.env) && !isReadRequest(request.method,path)) {
      return NextResponse.json({ error:'Read-only review: no changes were saved to production.',code:'READ_ONLY_PREVIEW' },{status:403})
    }
  }
  // Preview access relies on the existing Vercel Deployment Protection.
  // Production never uses this exception; do not disable preview protection.
  if (preview || localReview || path === '/login' || authRoute) return NextResponse.next()
  const token = request.cookies.get('fe-session')?.value
  if (token && process.env.OPS_ALLOWED_EMAILS) {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!, Authorization:`Bearer ${token}` },
        cache:'no-store',
      })
      const user = response.ok ? await response.json() : null
      if (allowedEmail(user?.email,process.env.OPS_ALLOWED_EMAILS)) return NextResponse.next()
    } catch { /* Fail closed when identity cannot be verified. */ }
  }
  if(api) return NextResponse.json({error:'Sign in with an approved team account.'},{status:401})
  const loginUrl=new URL('/login',request.url)
  // Keep redirects on the caller's host when Next normalizes the URL
  // internally, such as localhost behind a reverse proxy.
  const host=request.headers.get('host')
  if(host) { loginUrl.port=''; loginUrl.host=host }
  if(request.headers.get('x-forwarded-proto')==='https') loginUrl.protocol='https:'
  return NextResponse.redirect(loginUrl)
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
