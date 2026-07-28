import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Marketing content pipeline CRUD, backed by marketing_content.
// This is the SAME table the calendar's Marketing layer reads, so items
// created here appear on the calendar on their scheduled_date.
//
// Fields: title (required), channels text[], status, scheduled_date,
//         asset_link, caption, owner_id, project_id.

const ALLOWED = ['title', 'channels', 'status', 'scheduled_date', 'asset_link', 'caption', 'owner_id', 'project_id', 'transcript', 'content_kind', 'hashtags', 'video_link']

// GET /api/marketing  → all items with owner + project joined, newest first
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('marketing_content')
      .select('*, team_members(id, name, initials, color), projects(id, name)')
      .order('scheduled_date', { ascending: true, nullsFirst: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const items = (data || []).map((r: any) => ({
      id: r.id,
      title: r.title,
      channels: Array.isArray(r.channels) ? r.channels : [],
      status: r.status || 'idea',
      scheduled_date: r.scheduled_date,
      asset_link: r.asset_link,
      caption: r.caption,
      transcript: r.transcript,
      content_kind: r.content_kind || 'clip',
      hashtags: r.hashtags,
      video_link: r.video_link,
      owner_id: r.owner_id,
      owner: r.team_members
        ? { id: r.team_members.id, name: r.team_members.name, initials: r.team_members.initials, color: r.team_members.color }
        : null,
      project_id: r.project_id,
      project_name: r.projects?.name || null,
    }))
    return NextResponse.json(items)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}

function cleanRow(body: any) {
  const row: Record<string, any> = {}
  for (const f of ALLOWED) {
    if (!(f in body)) continue
    let v = body[f]
    if (f === 'channels') v = Array.isArray(v) ? v : []
    else if (f === 'owner_id' || f === 'project_id' || f === 'scheduled_date' || f === 'asset_link' || f === 'caption' || f === 'transcript' || f === 'hashtags' || f === 'video_link') {
      v = v === '' ? null : v
    }
    row[f] = v
  }
  return row
}

// POST /api/marketing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body?.title) return NextResponse.json({ error: 'title is required' }, { status: 400 })
    const row = cleanRow(body)
    if (!row.status) row.status = 'idea'
    const { data, error } = await supabase.from('marketing_content').insert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/marketing  { id, ...fields }  (used for edits AND status advances)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body?.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const row = cleanRow(body)
    row.updated_at = new Date().toISOString()
    const { data, error } = await supabase.from('marketing_content').update(row).eq('id', body.id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/marketing?id=
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const { error } = await supabase.from('marketing_content').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}
