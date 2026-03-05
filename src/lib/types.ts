export interface TeamMember {
  id: string
  name: string
  role: string
  initials: string
  color: string
}

export interface WorkflowTemplate {
  id: string
  name: string
  slug: string
  color: string
  total_weeks: number
}

export interface TemplateTask {
  id: string
  workflow_template_id: string
  phase: string
  phase_order: number
  task_name: string
  task_order: number
  week_offset: number
  owner_ids: string[]
}

export interface Project {
  id: string
  name: string
  workflow_template_id: string
  workflow_type: string
  start_date: string
  current_week: number
  status: string
  created_at: string
}

export interface ProjectTask {
  id: string
  project_id: string
  phase: string
  phase_order: number
  task_name: string
  task_order: number
  due_date: string
  week_number: number
  status: 'not_started' | 'in_progress' | 'done' | 'blocked'
  owner_ids: string[]
}

export type TaskStatus = 'not_started' | 'in_progress' | 'done' | 'blocked'

export const STATUS_COLORS: Record<TaskStatus, string> = {
  not_started: '#9CA3AF',
  in_progress: '#0762C8',
  done: '#046A38',
  blocked: '#C8350D',
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  done: 'Done',
  blocked: 'Blocked',
}

export const WORKFLOW_COLORS: Record<string, string> = {
  'course-launch': '#0762C8',
  'podcast': '#437F94',
  'newsletter': '#B29838',
  'subscription': '#046A38',
}

export function nextStatus(current: TaskStatus): TaskStatus {
  const cycle: TaskStatus[] = ['not_started', 'in_progress', 'done', 'blocked']
  const idx = cycle.indexOf(current)
  return cycle[(idx + 1) % cycle.length]
}
