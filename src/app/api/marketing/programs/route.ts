import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Marketing programs: every project, merged with its marketing window
// (marketing_programs row, if one exists). The Strategy page groups
// assets by program; the Calendar marks program starts.

// GET /api/marketing/programs
export async function GET() {
  try {
    const [projRes, progRes] = await Promise.all([
      supabase
        .from('projects')
        .select('id, name, workflow_type, status, start_date, launch_date')
        .order('start_date', { ascending: true }),
      supabase.from('marketing_programs').select('*'),
    ])
    if (projRes.error) return NextResponse.json({ error: projRes.error.message }, { status: 500 })
    if (progRes.error) return NextResponse.json({ error: progRes.error.message }, { status: 500 })

    const byProject = new Map<string, any>()
    for (const r of progRes.data || []) byProject.set(r.project_id, r)

    const programs = (projRes.data || []).map((p: any) => {
      const m = byProject.get(p.id)
      return {
        project_id: p.id,
        name: p.name,
        workflow_type: p.workflow_type,
        project_status: p.status,
        project_start: p.start_date,
        project_launch: p.launch_date,
        // Project Launch means marketing launch; Start means program start.
        // Marketing-specific overrides never change the project's task anchors.
        marketing_start: m?.marketing_start ?? p.launch_date ?? null,
        program_start: m?.program_start ?? p.start_date ?? null,
        target_audience: m?.target_audience ?? null,
        goal: m?.goal ?? null,
        notes: m?.notes ?? null,
      }
    })
    return NextResponse.json(programs)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}

const FIELDS = ['marketing_start', 'program_start', 'target_audience', 'goal', 'notes']

// PUT /api/marketing/programs  { project_id, ...fields }  → upsert
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body?.project_id) return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
    const row: Record<string, any> = { project_id: body.project_id, updated_at: new Date().toISOString() }
    for (const f of FIELDS) {
      if (f in body) row[f] = body[f] === '' ? null : body[f]
    }
    const { data, error } = await supabase
      .from('marketing_programs')
      .upsert(row, { onConflict: 'project_id' })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}
