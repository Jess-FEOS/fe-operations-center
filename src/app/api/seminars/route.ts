import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Seminars CRUD — entered directly on the master calendar.
// Fields: title, seminar_date (required), start_time, client_name, location, notes.

// GET /api/seminars?from=&to=  (optional range)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    let q = supabase.from('seminars').select('*').order('seminar_date', { ascending: true })
    if (from) q = q.gte('seminar_date', from)
    if (to) q = q.lte('seminar_date', to)
    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}

// POST /api/seminars  { title?, seminar_date, start_time?, client_name?, location?, notes? }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body?.seminar_date) {
      return NextResponse.json({ error: 'seminar_date is required' }, { status: 400 })
    }
    const row = {
      title: body.title ?? null,
      seminar_date: body.seminar_date,
      start_time: body.start_time || null,
      client_name: body.client_name ?? null,
      location: body.location ?? null,
      notes: body.notes ?? null,
    }
    const { data, error } = await supabase.from('seminars').insert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/seminars  { id, ...fields }
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body?.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const patch: Record<string, any> = { updated_at: new Date().toISOString() }
    for (const f of ['title', 'seminar_date', 'start_time', 'client_name', 'location', 'notes']) {
      if (f in body) patch[f] = body[f] === '' ? null : body[f]
    }
    const { data, error } = await supabase.from('seminars').update(patch).eq('id', body.id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/seminars?id=
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const { error } = await supabase.from('seminars').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}
