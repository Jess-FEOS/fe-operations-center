import { Program, parseDate, toISO } from './marketing'

export function validCalendarDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = parseDate(value)
  return !Number.isNaN(date.getTime()) && toISO(date) === value
}

export function calendarDate(value: string | null, fallback = new Date()): Date {
  return validCalendarDate(value) ? parseDate(value) : fallback
}

export function calendarHref(params: URLSearchParams, changes: Record<string, string | null>) {
  const next = new URLSearchParams(params)
  for (const [key, value] of Object.entries(changes)) {
    if (value) next.set(key, value)
    else next.delete(key)
  }
  return `/calendar${next.size ? '?' + next.toString() : ''}`
}

export function programMilestones(programs: Program[], projectId = '') {
  return programs.filter(p => p.project_status === 'active' && (!projectId || p.project_id === projectId))
    .flatMap(p => [
      { date: p.marketing_start, project_id: p.project_id, label: `${p.name} marketing launches`, kind: 'launch' as const },
      { date: p.program_start, project_id: p.project_id, label: `${p.name} starts`, kind: 'start' as const },
    ]).filter((m): m is typeof m & { date: string } => validCalendarDate(m.date))
}
