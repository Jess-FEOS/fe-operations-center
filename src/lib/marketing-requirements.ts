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

/** Conservative content suggestions, not all work owned by Marketing. */
export function isMarketingRequirement(task: Pick<MarketingRequirement, 'phase' | 'role_name' | 'task_name' | 'status'>): boolean {
  if (task.status === 'done') return false
  const phase = task.phase.trim().toLowerCase()
  const marketingContext = ['market', 'marketing', 'marketing launch', 'pre-launch'].includes(phase)
    || /\bmarketing\b/i.test(task.role_name || '')
  if (!marketingContext) return false
  const title = task.task_name.toLowerCase()
  // Setup, measurement, website work, onboarding and collection are operations.
  if (/\b(sales page|landing page|website|web page|formsite|zapier|automation|enrollment form|welcome|onboarding|access links|completion email|survey|course catalog|syllabus)\b/.test(title)
    || /^(set up|setup|test|monitor|track|collect|configure|integrate|report|audit|review)\b/.test(title)) return false
  return /\b(emails?|newsletter|social|posts?|graphics?|videos?|clips?|reels?|blogs?|articles?|ads?|advertisements?|show notes|thumbnails?)\b/.test(title)
}

export function requirementCounts(tasks: MarketingRequirement[], today: string, linkedTaskIds: Set<string> = new Set()) {
  const open = tasks.filter(t => isMarketingRequirement(t) && !linkedTaskIds.has(t.id))
  return {
    open: open.length,
    overdue: open.filter(t => !!t.due_date && t.due_date < today).length,
    blocked: open.filter(t => t.status === 'blocked').length,
  }
}

/** Suggestions only: the user reviews the date, format and channels before save. */
export function assetDefaultsFromRequirement(task: MarketingRequirement) {
  const title = task.task_name
  const channels = ['YouTube', 'TikTok', 'Instagram', 'LinkedIn', 'X', 'Email', 'Blog']
    .filter(channel => new RegExp(`\\b${channel === 'Email' ? 'emails?' : channel}\\b`, 'i').test(title))
  return {
    source_task_id: task.id,
    project_id: task.project_id,
    title,
    scheduled_date: task.due_date,
    owner_id: task.owner_ids.length === 1 ? task.owner_ids[0] : null,
    status: 'ready' as const,
    channels,
    asset_type: channels.length === 1 && channels[0] === 'Email' ? 'email' : null,
  }
}
