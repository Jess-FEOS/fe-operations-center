// Shared marketing types + helpers used by the Pipeline, Calendar and
// Strategy pages. All three read the same marketing_content rows, so a
// change in one view shows up in the others.

export type Status = 'ready' | 'idea' | 'drafted' | 'scheduled' | 'posted'

export const STATUSES: { key: Status; label: string; color: string }[] = [
  { key: 'ready', label: 'Ready to write', color: '#437F94' },
  { key: 'idea', label: 'Idea', color: '#9CA3AF' },
  { key: 'drafted', label: 'Drafted', color: '#0762C8' },
  { key: 'scheduled', label: 'Scheduled', color: '#B29838' },
  { key: 'posted', label: 'Posted', color: '#046A38' },
]
export const STATUS_LABEL: Record<Status, string> = {
  ready: 'Ready to write', idea: 'Idea', drafted: 'Drafted', scheduled: 'Scheduled', posted: 'Posted',
}

export const CHANNELS = ['YouTube', 'TikTok', 'Instagram', 'LinkedIn', 'X', 'Email', 'Blog'] as const

export const ASSET_TYPES = [
  { key: 'graphic', label: 'Graphic' },
  { key: 'video', label: 'Video' },
  { key: 'clip', label: 'Short clip' },
  { key: 'post', label: 'Text post' },
  { key: 'email', label: 'Email' },
  { key: 'ad', label: 'Paid ad' },
  { key: 'blog', label: 'Blog / article' },
  { key: 'other', label: 'Other' },
] as const
export const ASSET_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  ASSET_TYPES.map((t) => [t.key, t.label])
)

export interface Owner { id: string; name: string; initials: string; color: string }

export interface ContentItem {
  id: string
  source_task_id?: string | null
  title: string
  channels: string[]
  status: Status
  scheduled_date: string | null
  asset_link: string | null
  caption: string | null
  owner_id: string | null
  owner: Owner | null
  project_id: string | null
  project_name: string | null
  transcript: string | null
  content_kind: 'clip' | 'episode'
  hashtags: string | null
  video_link: string | null
  asset_type: string | null
  target_audience: string | null
  copy_ready: boolean
  creative_ready: boolean
}

export interface Program {
  project_id: string
  name: string
  workflow_type: string | null
  project_status: string | null
  project_start: string | null
  project_launch: string | null
  marketing_start: string | null
  program_start: string | null
  target_audience: string | null
  goal: string | null
  notes: string | null
}

// ── Readiness ──────────────────────────────────────────────────────────
// red   = not worked on yet (no copy, no creative)
// amber = in progress (copy or creative done, or drafted) but not scheduled
// green = ready and scheduled (or already posted)
export type Readiness = 'red' | 'amber' | 'green'

export const READINESS: Record<Readiness, { label: string; color: string; bg: string }> = {
  red: { label: 'Not started', color: '#C8350D', bg: '#C8350D14' },
  amber: { label: 'In progress', color: '#B7791F', bg: '#B7791F17' },
  green: { label: 'Ready & scheduled', color: '#046A38', bg: '#046A3814' },
}

export function readinessOf(it: Pick<ContentItem, 'status' | 'copy_ready' | 'creative_ready'>): Readiness {
  if (it.status === 'scheduled' || it.status === 'posted') return 'green'
  if (it.copy_ready || it.creative_ready || it.status === 'drafted') return 'amber'
  return 'red'
}

// ── Dates (all local, noon-anchored to dodge TZ drift) ────────────────
export function parseDate(s: string): Date {
  return new Date(s + 'T12:00:00')
}
export function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
/** Monday of the week containing d. */
export function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12)
  const dow = (x.getDay() + 6) % 7
  return addDays(x, -dow)
}
export function fmtShort(s: string | null): string {
  if (!s) return '—'
  return parseDate(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
export function fmtLong(s: string | null): string {
  if (!s) return '—'
  return parseDate(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000)
}

/** Where does an asset's date sit relative to its program's marketing window? */
export function windowFit(date: string | null, p: Program | undefined): 'inside' | 'before' | 'after' | 'unknown' {
  if (!date || !p || !p.marketing_start || !p.program_start) return 'unknown'
  if (date < p.marketing_start) return 'before'
  if (date > p.program_start) return 'after'
  return 'inside'
}

/** Empty form for a new asset. */
export function emptyItem(): Omit<ContentItem, 'owner' | 'project_name'> {
  return {
    id: '', source_task_id: null, title: '', channels: [], status: 'idea', scheduled_date: null,
    asset_link: null, caption: null, owner_id: null, project_id: null,
    transcript: null, content_kind: 'clip', hashtags: null, video_link: null,
    asset_type: null, target_audience: null, copy_ready: false, creative_ready: false,
  }
}

/** Surface API failures rather than displaying an empty plan or a false save. */
export async function marketingRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init })
  const data = await response.json()
  if (!response.ok) throw new Error(data?.error || 'Could not save or load marketing data.')
  return data as T
}

/** Count only assets inside the actual window, including partial edge weeks. */
export function marketingWeeks(p: Program, items: ContentItem[]) {
  const weeks: { start: string; end: string; items: ContentItem[] }[] = []
  if (!p.marketing_start || !p.program_start || p.marketing_start > p.program_start) return weeks
  for (let w = startOfWeek(parseDate(p.marketing_start)); toISO(w) <= p.program_start; w = addDays(w, 7)) {
    const start = toISO(w) < p.marketing_start ? p.marketing_start : toISO(w)
    const weekEnd = toISO(addDays(w, 6))
    const end = weekEnd > p.program_start ? p.program_start : weekEnd
    weeks.push({ start, end, items: items.filter(i => !!i.scheduled_date && i.scheduled_date >= start && i.scheduled_date <= end) })
  }
  return weeks
}
