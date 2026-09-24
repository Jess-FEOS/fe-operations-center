import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { supabase } from '@/lib/supabase'
import { schedulePreview, scheduledDate, validRule, validateDates, ScheduleRule } from '@/lib/project-schedule'

export const dynamic = 'force-dynamic'
const PATCH_FIELDS = ['name', 'start_date', 'launch_date', 'workflow_type', 'revenue_goal', 'enrollment_goal']
const revisionOf = (project: unknown, tasks: unknown) => createHash('sha256').update(JSON.stringify({ project, tasks })).digest('hex')

async function snapshot(id: string) {
  const p = await supabase.from('projects').select('*').eq('id', id).single()
  if (p.error || !p.data) throw new Error(p.error?.message || 'Project not found.')
  const t = await supabase.from('project_tasks').select('*').eq('project_id', id).order('id')
  if (t.error) throw new Error(t.error.message)
  return { project: p.data, tasks: t.data || [] }
}
function patchFor(body: any, project: any) {
  if (!body.patch || typeof body.patch !== 'object' || Array.isArray(body.patch)) throw new Error('Project date changes are required.')
  if (Object.keys(body.patch).some(k => !PATCH_FIELDS.includes(k))) throw new Error('Save status or template changes separately.')
  const patch = { ...body.patch }
  patch.start_date = patch.start_date === undefined ? project.start_date : patch.start_date
  patch.launch_date = patch.launch_date === undefined ? project.launch_date : patch.launch_date
  validateDates(patch)
  if ('name' in patch && (typeof patch.name !== 'string' || !patch.name.trim())) throw new Error('Project name is required.')
  return patch
}

// Read-only preview works before the migration; SELECT * tolerates absent columns.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { project, tasks } = await snapshot(params.id)
    const patch = patchFor(body, project)
    return NextResponse.json({
      revision: revisionOf(project, tasks), project, dates: { start_date: patch.start_date, launch_date: patch.launch_date },
      rows: schedulePreview(tasks, patch, patch.workflow_type || project.workflow_type),
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not preview schedule.' }, { status: 400 })
  }
}

// Only the privileged RPC writes. A missing migration fails without saving ANY fields.
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { project, tasks } = await snapshot(params.id)
    const patch = patchFor(body, project)
    if (body.revision !== revisionOf(project, tasks)) {
      return NextResponse.json({ error: 'This project or its tasks changed. Close this preview and review the latest schedule.' }, { status: 409 })
    }
    const rows = schedulePreview(tasks, patch, patch.workflow_type || project.workflow_type)
    if (!Array.isArray(body.rules) || body.rules.length !== rows.length ||
      new Set(body.rules.map((r: any) => r.id)).size !== rows.length ||
      body.rules.some((r: any) => !rows.some(row => row.id === r.id) || !validRule(r))) {
      return NextResponse.json({ error: 'Review a valid schedule rule for every task.' }, { status: 400 })
    }
    const changes = rows.filter(row => row.status !== 'done').map(row => {
      const rule = body.rules.find((r: { id: string } & ScheduleRule) => r.id === row.id)
      const date = scheduledDate(rule, patch, row.old_date)
      if (rule.anchor !== 'fixed' && !date) throw new Error(`Set the ${rule.anchor === 'launch' ? 'marketing launch' : 'program start'} date or keep "${row.task_name}" fixed.`)
      return { id: row.id, due_date: date, schedule_anchor: rule.anchor, schedule_offset_days: rule.offset_days }
    })
    const { data, error } = await supabase.rpc('save_project_schedule', {
      p_project_id: params.id, p_expected_project: project, p_expected_tasks: tasks,
      p_patch: patch, p_changes: changes,
    })
    if (error) {
      const conflict = error.message.includes('SCHEDULE_CONFLICT')
      return NextResponse.json({ error: conflict
        ? 'The project changed during saving. Review a fresh schedule before retrying.'
        : 'Schedule was not saved. The scheduling database update must be installed and the save must succeed before dates can change.',
      }, { status: conflict ? 409 : 503 })
    }
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not save schedule.' }, { status: 400 })
  }
}
