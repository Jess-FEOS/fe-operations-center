import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getSimplifiedPhase } from '@/lib/phases'
import { createReviewedProject } from '@/lib/project-creation-server'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get('status') || 'active'
    if (!['active','archived','completed','paused','all'].includes(status)) return NextResponse.json({ error: 'Invalid project status filter' }, { status: 400 })
    let query = supabase.from('projects').select('*,monthly_priorities!projects_priority_id_fkey(title,status)')
    if (status !== 'all') query = query.eq('status', status)
    const projects = await query
    if (projects.error) throw projects.error
    const ids = (projects.data || []).map(p => p.id)
    const tasks = ids.length ? await supabase.from('project_tasks').select('project_id,status,phase').in('project_id', ids) : { data: [], error: null }
    if (tasks.error) throw tasks.error
    return NextResponse.json((projects.data || []).map(project => {
      const work = (tasks.data || []).filter(t => t.project_id === project.id)
      const done = work.filter(t => t.status === 'done').length
      const phases: Record<string,{ total: number; done: number }> = { Build: {total:0,done:0}, Market: {total:0,done:0}, 'Launch & Run': {total:0,done:0} }
      for (const t of work) { const p = getSimplifiedPhase(t.phase); phases[p].total++; if (t.status === 'done') phases[p].done++ }
      return { ...project, monthly_priorities: undefined, priority_title: project.monthly_priorities?.title || null,
        priority_status: project.monthly_priorities?.status || null, total_tasks: work.length, done_tasks: done,
        progress: work.length ? Math.round(done / work.length * 100) : 0, phase_breakdown: phases }
    }))
  } catch { return NextResponse.json({ error: 'Could not load projects and progress. Please retry.' }, { status: 500 }) }
}
export async function POST(request: NextRequest) {
  try {
    const result = await createReviewedProject(await request.json())
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not create project.' }, { status: 400 })
  }
}
