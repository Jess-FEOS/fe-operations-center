import { createHash } from 'node:crypto'
import { isReadOnly } from '@/lib/access-policy'
import { supabase } from '@/lib/supabase'
import { loadOwnership } from '@/lib/ownership-server'
import { prepareCopyTasks, prepareTemplateTasks, Overrides } from '@/lib/project-foundation'
import { validateDates } from '@/lib/project-schedule'

export interface CreationInput extends Overrides {
  template_id?: string; source_project_id?: string; name: string; start_date: string; launch_date?: string | null
  priority_id?: string | null; revenue_goal?: number | null; enrollment_goal?: number | null
  review_hash?: string; request_id?: string
}
export async function prepareCreation(input: CreationInput) {
  if (!input.name?.trim() || input.name.trim().length > 200) throw new Error('Enter a project name (up to 200 characters).')
  if (!!input.template_id === !!input.source_project_id) throw new Error('Choose one template or one source project.')
  const dates = { start_date: input.start_date, launch_date: input.launch_date || null }
  validateDates(dates)
  for (const value of [input.revenue_goal, input.enrollment_goal]) {
    if (value != null && (!Number.isFinite(value) || value < 0)) throw new Error('Goals must be non-negative numbers.')
  }
  if (input.enrollment_goal != null && !Number.isInteger(input.enrollment_goal)) throw new Error('Enrollment must be a whole number.')
  const { people, joins } = await loadOwnership()
  let workflow: string, workflowId: string | null, source: Record<string, unknown>, tasks
  if (input.template_id) {
    const template = await supabase.from('project_templates').select('*').eq('id', input.template_id).single()
    if (template.error || !template.data) throw new Error('Template not found.')
    const steps = await supabase.from('project_template_tasks').select('*').eq('template_id', input.template_id).order('order_index').order('id')
    if (steps.error) throw new Error('Could not read template steps.')
    workflow = template.data.type
    const legacy = await supabase.from('workflow_templates').select('id').eq('slug', workflow).limit(1)
    if (legacy.error) throw new Error('Could not read workflow category.')
    workflowId = legacy.data?.[0]?.id || null
    source = { kind: 'template', id: input.template_id, name: template.data.name, steps: steps.data }
    tasks = prepareTemplateTasks(steps.data || [], workflow, dates, people, joins, input)
  } else {
    const project = await supabase.from('projects').select('*').eq('id', input.source_project_id!).single()
    if (project.error || !project.data) throw new Error('Source project not found.')
    const steps = await supabase.from('project_tasks').select('*').eq('project_id', input.source_project_id!).order('phase_order').order('task_order').order('id')
    if (steps.error) throw new Error('Could not read source checklist.')
    workflow = project.data.workflow_type; workflowId = project.data.workflow_template_id
    source = { kind: 'project', id: project.data.id, name: project.data.name, steps: steps.data }
    tasks = prepareCopyTasks(steps.data || [], workflow, dates, people, joins, input)
  }
  const project = { name: input.name.trim(), ...dates, workflow_type: workflow, workflow_template_id: workflowId,
    priority_id: input.priority_id || null, revenue_goal: input.revenue_goal ?? null, enrollment_goal: input.enrollment_goal ?? null }
  const review_hash = createHash('sha256').update(JSON.stringify({ project, source, tasks })).digest('hex')
  return { project, source, tasks, review_hash, issues: tasks.filter(t => t.issues.length).length,
    people: people.map(p => ({ id: p.id, name: p.name })), can_save: !isReadOnly(process.env) }
}

export async function createReviewedProject(input: CreationInput) {
  const review = await prepareCreation(input)
  if (!input.review_hash || input.review_hash !== review.review_hash) {
    return { status: 409, body: { error: 'Review the current checklist and dates before creating this project.', code: 'REVIEW_REQUIRED' } }
  }
  if (review.issues) return { status: 422, body: { error: 'Resolve the highlighted owners and dates before creating this project.' } }
  if (!input.request_id || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.request_id)) {
    return { status: 400, body: { error: 'A valid creation request ID is required.' } }
  }
  if (!review.can_save) return { status: 403, body: { error: 'Preview is read-only. No project or tasks were saved.' } }
  const { data, error } = await supabase.rpc('create_project_from_review', {
    p_project: review.project, p_tasks: review.tasks, p_source: review.source,
    p_request_id: input.request_id, p_review_hash: review.review_hash,
  })
  if (error) return { status: 503, body: { error: 'Project was not created. The reviewed foundation migration must be installed, and all owners, dates, and priority links must be valid.' } }
  return { status: 201, body: data }
}
