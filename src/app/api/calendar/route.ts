import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { loadOwnership } from '@/lib/ownership-server'
import { resolveOwnership } from '@/lib/ownership'
import { validCalendarDate } from '@/lib/calendar'

export const dynamic = 'force-dynamic'

// Unified calendar feed. One source for the three-layer master calendar.
// Returns typed events for a date range so the month grid (and any future
// week/agenda view) reads a single shape:
//   { type: 'project' | 'seminar' | 'marketing', date, ... }
//
// - project  : derived from project_tasks due dates, grouped by project per day
// - seminar  : rows from the seminars table (entered on the calendar)
// - marketing: rows from marketing_content (owned by the Marketing page;
//              the calendar displays them and links out)

interface ProjectEvent {
  type: 'project'
  date: string
  project_id: string
  project_name: string
  task_count: number
  task_titles: string[]
}
interface SeminarEvent {
  type: 'seminar'
  date: string
  id: string
  title: string | null
  start_time: string | null
  client_name: string | null
  location: string | null
  notes: string | null
}
interface MarketingEvent {
  type: 'marketing'
  date: string
  id: string
  title: string
  channels: string[]
  status: string
  copy_ready: boolean
  creative_ready: boolean
  asset_link: string | null
}
type CalendarEvent = ProjectEvent | SeminarEvent | MarketingEvent

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const projectId = searchParams.get('project_id')
    const ownerId = searchParams.get('owner_id')
    if (!validCalendarDate(from) || !validCalendarDate(to) || from > to) {
      return NextResponse.json({ error: 'A valid from/to date range is required.' }, { status: 400 })
    }
    let tasksQuery = supabase
        .from('project_tasks')
        .select('id, task_name, due_date, project_id, owner_ids,role_id,vendor_role_id,projects!inner(id, name,status)')
        .eq('projects.status', 'active')
        .neq('status', 'done')
        .gte('due_date', from)
        .lte('due_date', to)
    let marketingQuery = supabase.from('marketing_content')
      .select('id,title,scheduled_date,channels,status,asset_link,copy_ready,creative_ready')
      .gte('scheduled_date', from).lte('scheduled_date', to)
    if (projectId) {
      tasksQuery = tasksQuery.eq('project_id', projectId)
      marketingQuery = marketingQuery.eq('project_id', projectId)
    }
    if (ownerId) marketingQuery = marketingQuery.eq('owner_id', ownerId)
    const [tasksRes, seminarsRes, marketingRes, ownership] = await Promise.all([
      tasksQuery,
      projectId || ownerId ? Promise.resolve({ data: [], error: null }) : supabase
        .from('seminars')
        .select('*')
        .gte('seminar_date', from)
        .lte('seminar_date', to),
      marketingQuery,
      ownerId ? loadOwnership() : Promise.resolve(null),
    ])

    if (tasksRes.error || seminarsRes.error || marketingRes.error) {
      return NextResponse.json({ error: 'Could not load the complete calendar. Please retry.' }, { status: 500 })
    }
    const events: CalendarEvent[] = []

    // --- Projects: group tasks by (date, project) into one chip per project/day
    const groupMap = new Map<string, ProjectEvent>()
    for (const t of (tasksRes.data as any[]) || []) {
      if (!t.due_date) continue
      if (ownerId && ownership && !resolveOwnership(t, ownership.people, ownership.joins).owner_ids.includes(ownerId)) continue
      const projId = t.projects?.id || t.project_id || 'unknown'
      const key = `${t.due_date}::${projId}`
      let g = groupMap.get(key)
      if (!g) {
        g = {
          type: 'project',
          date: t.due_date,
          project_id: projId,
          project_name: t.projects?.name || 'Untitled project',
          task_count: 0,
          task_titles: [],
        }
        groupMap.set(key, g)
      }
      g.task_count += 1
      if (t.task_name) g.task_titles.push(t.task_name)
    }
    for (const g of groupMap.values()) events.push(g)

    // --- Seminars
    for (const s of (seminarsRes.data as any[]) || []) {
      events.push({
        type: 'seminar',
        date: s.seminar_date,
        id: s.id,
        title: s.title,
        start_time: s.start_time,
        client_name: s.client_name,
        location: s.location,
        notes: s.notes,
      })
    }

    // --- Marketing
    for (const m of (marketingRes.data as any[]) || []) {
      if (!m.scheduled_date) continue
      events.push({
        type: 'marketing',
        date: m.scheduled_date,
        id: m.id,
        title: m.title,
        channels: Array.isArray(m.channels) ? m.channels : [],
        status: m.status || 'idea',
        copy_ready: !!m.copy_ready,
        creative_ready: !!m.creative_ready,
        asset_link: m.asset_link,
      })
    }

    return NextResponse.json({ events })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}
