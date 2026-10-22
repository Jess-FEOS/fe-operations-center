import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createReviewedProject } from '@/lib/project-creation-server'
export const dynamic = 'force-dynamic'

/** Reads never seed, rename, restore, or otherwise mutate templates. */
export async function GET() {
  try {
    const templates = await supabase.from('project_templates').select('*').order('created_at')
    if (templates.error) throw templates.error
    const tasks = await supabase.from('project_template_tasks').select('*').order('order_index')
    if (tasks.error) throw tasks.error
    return NextResponse.json((templates.data || []).map(t => ({
      ...t, tasks: (tasks.data || []).filter(step => step.template_id === t.id),
    })))
  } catch { return NextResponse.json({ error: 'Could not load templates. Please retry.' }, { status: 500 }) }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (body.action === 'create_template') {
      if (typeof body.name !== 'string' || !body.name.trim() || typeof body.type !== 'string' || !body.type.trim()) {
        return NextResponse.json({ error: 'Name and type are required.' }, { status: 400 })
      }
      const result = await supabase.from('project_templates')
        .insert({ name: body.name.trim(), type: body.type.trim(), description: body.description || null }).select().single()
      if (result.error) throw result.error
      return NextResponse.json(result.data, { status: 201 })
    }
    const result = await createReviewedProject(body)
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not create project/template.' }, { status: 400 })
  }
}
