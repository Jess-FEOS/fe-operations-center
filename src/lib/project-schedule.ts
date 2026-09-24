export type ScheduleAnchor = 'launch' | 'start' | 'fixed'
export interface ScheduleRule { anchor: ScheduleAnchor; offset_days: number | null }
export interface ScheduleTask {
  id: string; task_name: string; phase: string; due_date: string | null
  status: string; week_number: number
  phase_order?: number; task_order?: number
  schedule_anchor?: ScheduleAnchor | null
  schedule_offset_days?: number | null
}
export interface ScheduleDates { start_date: string; launch_date: string | null }
export interface ScheduleRow extends ScheduleRule {
  id: string; task_name: string; phase: string; status: string
  old_date: string | null; new_date: string | null; suggested: boolean; note: string
}

export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
export function shiftDays(date: string, days: number): string {
  if (!validDate(date) || !Number.isInteger(days)) throw new Error('Invalid date or day offset.')
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
export function validateDates(dates: ScheduleDates) {
  if (!validDate(dates.start_date)) throw new Error('Enter a valid program start date.')
  if (dates.launch_date !== null && !validDate(dates.launch_date)) throw new Error('Enter a valid marketing launch date.')
  if (dates.launch_date && dates.launch_date > dates.start_date) throw new Error('Marketing launch must be on or before program start.')
}
export function scheduledDate(rule: ScheduleRule, dates: ScheduleDates, old: string | null) {
  if (rule.anchor === 'fixed') return old
  const date = rule.anchor === 'launch' ? dates.launch_date : dates.start_date
  if (!date) return null
  return shiftDays(date, rule.offset_days ?? 0)
}
export function validRule(rule: ScheduleRule) {
  return rule && ['launch', 'start', 'fixed'].includes(rule.anchor) &&
    (rule.anchor === 'fixed' ? rule.offset_days === null : Number.isInteger(rule.offset_days) && Math.abs(rule.offset_days!) <= 3650)
}

/**
 * Legacy suggestions are NOT a migration/backfill. Users review them before
 * persistence. Only the known course phase sequence is suggested; other
 * workflows and custom dates stay fixed until explicitly configured.
 */
export function schedulePreview(tasks: ScheduleTask[], dates: ScheduleDates, workflow: string): ScheduleRow[] {
  validateDates(dates)
  const marketingWeeks = [...new Set(tasks.filter(t => t.phase === 'Marketing Launch').map(t => t.week_number))]
  const launchWeek = marketingWeeks.length === 1 ? marketingWeeks[0] : null
  const baselines = new Map<string, number>()
  for (const t of tasks) {
    if (validDate(t.due_date) && Number.isInteger(t.week_number)) {
      const baseline = shiftDays(t.due_date, t.week_number * 7)
      baselines.set(baseline, (baselines.get(baseline) || 0) + 1)
    }
  }
  const common = [...baselines].sort((a, b) => b[1] - a[1])[0]
  const baseline = common && common[1] >= 3 && common[1] > tasks.length / 2 ? common[0] : null
  return [...tasks].sort((a, b) => (a.phase_order ?? 0) - (b.phase_order ?? 0) ||
    (a.task_order ?? 0) - (b.task_order ?? 0)).map(t => {
    let rule: ScheduleRule = { anchor: 'fixed', offset_days: null }
    let note = 'Unconfigured or custom task: kept fixed. Choose an anchor to automate it.'
    const suggested = !t.schedule_anchor
    if (t.schedule_anchor) {
      rule = { anchor: t.schedule_anchor, offset_days: t.schedule_offset_days ?? null }
      if (!validRule(rule)) throw new Error(`Invalid saved schedule rule for ${t.task_name}.`)
      note = rule.anchor === 'fixed' ? 'Fixed date: will not move.' : 'Uses its saved date rule.'
    } else if (workflow === 'course-launch' && launchWeek !== null && baseline &&
      validDate(t.due_date) && shiftDays(t.due_date, t.week_number * 7) === baseline) {
      if (['Planning', 'Setup', 'Build', 'Marketing Launch'].includes(t.phase)) {
        rule = { anchor: 'launch', offset_days: (launchWeek - t.week_number) * 7 }
        note = 'Suggested: preserve the existing lead time relative to marketing launch.'
      } else if (['Pre-Launch', 'Delivery Prep', 'Launch', 'Wrap Up'].includes(t.phase)) {
        rule = { anchor: 'start', offset_days: -t.week_number * 7 }
        note = 'Suggested: preserve the existing offset from program start.'
      }
    }
    const done = t.status === 'done'
    return {
      ...rule, id: t.id, task_name: t.task_name, phase: t.phase, status: t.status,
      old_date: t.due_date, new_date: done ? t.due_date : scheduledDate(rule, dates, t.due_date),
      suggested, note: done ? 'Completed: original deadline is preserved.' : note,
    }
  })
}
