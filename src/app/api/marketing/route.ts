import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { isMarketingRequirement } from '@/lib/marketing-requirements'

export const dynamic = 'force-dynamic'

// Marketing content pipeline CRUD, backed by marketing_content.
// This is the SAME table the calendar's Marketing layer reads, so items
// created here appear on the calendar on their scheduled_date.
//
// Fields: title (required), channels text[], status, scheduled_date,
//         asset_link, caption, owner_id, project_id.

const ALLOWED = ['title', 'channels', 'status', 'scheduled_date', 'asset_link', 'caption', 'owner_id', 'project_id', 'transcript', 'content_kind', 'hashtags', 'video_link', 'asset_type', 'target_audience', 'copy_ready', 'creative_ready']

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
      source_task_id: r.source_task_id || null,
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
      asset_type: r.asset_type || null,
      target_audience: r.target_audience || null,
      copy_ready: !!r.copy_ready,
      creative_ready: !!r.creative_ready,
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
    else if (f === 'owner_id' || f === 'project_id' || f === 'scheduled_date' || f === 'asset_link' || f === 'caption' || f === 'transcript' || f === 'hashtags' || f === 'video_link' || f === 'asset_type' || f === 'target_audience') {
      v = v === '' ? null : v
    } else if (f === 'copy_ready' || f === 'creative_ready') {
      v = !!v
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
    if (body.source_task_id) {
      const { data: task, error: taskError } = await supabase.from('project_tasks')
        .select('id, project_id, task_name, phase, status, role_id').eq('id', body.source_task_id).maybeSingle()
      if (taskError) throw taskError
      if (!task) return NextResponse.json({ error: 'This project task no longer exists. Refresh requirements.' }, { status: 404 })
      if (task.project_id !== row.project_id) return NextResponse.json({ error: 'The asset must stay in its source task’s project.' }, { status: 400 })
      const { data: role, error: roleError } = task.role_id
        ? await supabase.from('roles').select('name').eq('id', task.role_id).maybeSingle()
        : { data: null, error: null }
      if (roleError) throw roleError
      if (!isMarketingRequirement({ ...task, role_name: role?.name || null })) {
        return NextResponse.json({ error: 'This task is completed or is not a content requirement. Refresh requirements.' }, { status: 409 })
      }
      if (!row.scheduled_date) return NextResponse.json({ error: 'Choose a planned post date for this asset.' }, { status: 400 })
      row.source_task_id = task.id
    }
    const { data, error } = await supabase.from('marketing_content').insert(row).select().single()
    if (error?.code === '23505' && row.source_task_id) {
      return NextResponse.json({ error: 'An asset already exists for this requirement. Close this form and refresh to open it.' }, { status: 409 })
    }
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
    // Source links cannot be changed by a generic asset edit, including legacy
    // Pipeline forms. Prevent moving a linked asset to a different project.
    if ('project_id' in body || 'source_task_id' in body) {
      const { data: current, error: currentError } = await supabase.from('marketing_content')
        .select('source_task_id, project_id').eq('id', body.id).maybeSingle()
      if (currentError) throw currentError
      if (!current) return NextResponse.json({ error: 'Asset not found.' }, { status: 404 })
      if ('source_task_id' in body && (body.source_task_id || null) !== current.source_task_id) {
        return NextResponse.json({ error: 'The source task link cannot be changed here.' }, { status: 400 })
      }
      if (current.source_task_id && 'project_id' in row && row.project_id !== current.project_id) {
        return NextResponse.json({ error: 'The asset must stay in its source task’s project.' }, { status: 400 })
      }
    }
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
