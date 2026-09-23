export interface MarketingRequirement {
  id: string
  project_id: string
  task_name: string
  phase: string
  due_date: string | null
  status: string
  owner_ids: string[]
  role_name: string | null
}

/** Use existing task metadata, not speculative matches on task titles. */
export function isMarketingRequirement(task: { phase: string; role_name: string | null }): boolean {
  const phase = task.phase.trim().toLowerCase()
  return ['market', 'marketing', 'marketing launch', 'pre-launch'].includes(phase)
    || /\bmarketing\b/i.test(task.role_name || '')
}

export function requirementCounts(tasks: MarketingRequirement[], today: string) {
  const open = tasks.filter(t => t.status !== 'done')
  return {
    open: open.length,
    done: tasks.length - open.length,
    overdue: open.filter(t => !!t.due_date && t.due_date < today).length,
    blocked: open.filter(t => t.status === 'blocked').length,
  }
}
