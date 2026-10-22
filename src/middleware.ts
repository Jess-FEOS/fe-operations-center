import { NextRequest, NextResponse } from 'next/server'
import { allowedOrigin, isReadOnly, isReadRequest } from '@/lib/access-policy'

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  if (path.startsWith('/api/') && !['GET','HEAD','OPTIONS'].includes(request.method)) {
    // Compare with the incoming Host, not Next's normalized internal hostname.
    if (!allowedOrigin(request.headers.get('origin'), request.headers.get('host'))) {
      return NextResponse.json({ error:'Cross-origin writes are not allowed.' },{status:403})
    }
    if (isReadOnly(process.env) && !isReadRequest(request.method,path)) {
      return NextResponse.json({ error:'Read-only review: no changes were saved to production.',code:'READ_ONLY_PREVIEW' },{status:403})
    }
  }
  // The owner approved preserving open access. These guards are not user
  // authentication and do not restrict production data or editing to the team.
  return NextResponse.next()
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
