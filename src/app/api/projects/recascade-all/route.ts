import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
// Retire the unsafe bulk routine: it also overwrote actual program start dates.
export async function POST() {
  return NextResponse.json({
    error: 'Global rescheduling is disabled. Open a project and use Review schedule to preview and confirm its deadlines.',
  }, { status: 410 })
}
