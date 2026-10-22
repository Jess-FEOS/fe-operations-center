import { NextRequest, NextResponse } from 'next/server'
import { prepareCreation } from '@/lib/project-creation-server'
export const dynamic = 'force-dynamic'
/** Pure read/review endpoint: safe in read-only previews. */
export async function POST(request: NextRequest) {
  try { return NextResponse.json(await prepareCreation(await request.json())) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not prepare project.' }, { status: 400 }) }
}
