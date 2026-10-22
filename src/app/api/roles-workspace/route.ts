import { NextRequest, NextResponse } from 'next/server'
import { loadWorkspace } from '@/lib/workspace-server'
export const dynamic = 'force-dynamic'
export async function GET(request: NextRequest) {
  try { return NextResponse.json((await loadWorkspace(request.nextUrl.searchParams.get('history') === 'true')).groups) }
  catch { return NextResponse.json({ error: 'Could not load the complete team workspace. Please retry.' }, { status: 500 }) }
}
