import { ScheduleDates, ScheduleTask, schedulePreview, scheduledDate, validDate, validateDates } from './project-schedule'
import { matchTemplateOwner, Person, resolveOwnership, RoleJoin } from './ownership'

export const WEEK_PHASES: Record<number, string> = {
  8: 'Planning', 6: 'Setup', 4: 'Build', 3: 'Marketing Launch',
  2: 'Pre-Launch', 1: 'Delivery Prep', 0: 'Launch', [-1]: 'Wrap Up',
}
export interface TemplateStep {
  id: string; title: string; owner: string; week_number: number; order_index: number
  phase?: string | null; phase_order?: number | null; role_id?: string | null; description?: string | null
}
export interface FoundationTask {
  source_id: string; task_name: string; phase: string; phase_order: number; task_order: number
  week_number: number; due_date: string | null; status: 'not_started'
  owner_ids: string[]; role_id: string | null; vendor_role_id: string | null
  schedule_anchor: 'launch' | 'start' | 'fixed'; schedule_offset_days: number | null
  issues: string[]; owner_name: string | null
}
export type Overrides = { owners?: Record<string, string>; dates?: Record<string, string> }

function assign(task: FoundationTask, suggested: Person | null, people: Person[], override?: string) {
  const person = override ? people.find(p => p.id === override) : suggested
  if (override && !person) throw new Error('An owner selection is no longer available.')
  task.owner_ids = person ? [person.id] : []
  task.owner_name = person?.name || null
  task.vendor_role_id = person?.vendor_role_id || null
  // Keep legacy categorization when available; do not invent a role for modern-only people.
  task.role_id = person?.role_id || task.role_id
  if (!person) task.issues.push('Choose one accountable owner.')
}

export function prepareTemplateTasks(steps: TemplateStep[], workflow: string, dates: ScheduleDates,
  people: Person[], joins: RoleJoin[], overrides: Overrides = {}): FoundationTask[] {
  validateDates(dates)
  const weeks = [...new Set(steps.map(t => t.week_number))].sort((a,b) => b-a)
  const launchWeek = weeks.includes(3) ? 3 : null
  return steps.map(step => {
    if (!Number.isInteger(step.week_number) || Math.abs(step.week_number) > 520) throw new Error('Invalid template week.')
    const launch = workflow === 'course-launch' && launchWeek !== null && step.week_number >= launchWeek
    const rule = { anchor: launch ? 'launch' as const : 'start' as const,
      offset_days: launch ? (launchWeek! - step.week_number) * 7 : -step.week_number * 7 }
    const task: FoundationTask = {
      source_id: step.id, task_name: step.title, phase: step.phase || WEEK_PHASES[step.week_number] || `Week ${step.week_number}`,
      phase_order: step.phase_order ?? weeks.indexOf(step.week_number) + 1, task_order: step.order_index,
      week_number: step.week_number, due_date: scheduledDate(rule, dates, null), status: 'not_started',
      owner_ids: [], role_id: step.role_id || null, vendor_role_id: null,
      schedule_anchor: rule.anchor, schedule_offset_days: rule.offset_days, issues: [], owner_name: null,
    }
    // A joint or unknown name requires an explicit choice; never silently pick the first.
    const suggested = step.owner.includes('+') ? null : matchTemplateOwner(step.owner, people)
    assign(task, suggested, people, overrides.owners?.[step.id])
    if (overrides.dates?.[step.id]) {
      if (!validDate(overrides.dates[step.id])) throw new Error('Enter a valid fixed deadline.')
      task.due_date = overrides.dates[step.id]; task.schedule_anchor = 'fixed'; task.schedule_offset_days = null
    }
    if (!task.due_date) task.issues.push('Set a marketing launch date or an explicit fixed deadline.')
    return task
  })
}

export function prepareCopyTasks(steps: (ScheduleTask & { role_id?: string | null; vendor_role_id?: string | null; owner_ids?: string[] })[],
  workflow: string, dates: ScheduleDates, people: Person[], joins: RoleJoin[], overrides: Overrides = {}): FoundationTask[] {
  // A copy is fresh work. Completed originals remain untouched; their copies are not completed.
  const rows = schedulePreview(steps.map(t => ({ ...t, status: 'not_started' })), dates, workflow)
  return rows.map(row => {
    const source = steps.find(t => t.id === row.id)!
    const resolved = resolveOwnership(source, people, joins)
    const task: FoundationTask = {
      source_id: source.id, task_name: source.task_name, phase: source.phase,
      phase_order: source.phase_order ?? 0, task_order: source.task_order ?? 0, week_number: source.week_number,
      due_date: row.anchor === 'fixed' ? null : row.new_date, status: 'not_started',
      owner_ids: [], role_id: source.role_id || null, vendor_role_id: source.vendor_role_id || null,
      schedule_anchor: row.anchor, schedule_offset_days: row.offset_days, issues: [], owner_name: null,
    }
    assign(task, people.find(p => p.id === resolved.accountable_owner_id) || null, people, overrides.owners?.[source.id])
    if (overrides.dates?.[source.id]) {
      if (!validDate(overrides.dates[source.id])) throw new Error('Enter a valid fixed deadline.')
      task.due_date = overrides.dates[source.id]; task.schedule_anchor = 'fixed'; task.schedule_offset_days = null
    }
    if (!task.due_date) task.issues.push(row.anchor === 'fixed' ?
      'Choose a new deadline: fixed or custom dates are not copied.' : 'Set a marketing launch date.')
    return task
  })
}
