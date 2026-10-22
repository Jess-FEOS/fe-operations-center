import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { validCalendarDate } from '@/lib/calendar'
import { companyCommitments } from '@/lib/company-calendar'
import { loadOwnership } from '@/lib/ownership-server'
import { resolveOwnership } from '@/lib/ownership'

export const dynamic = 'force-dynamic'
export async function GET(request: NextRequest) {
  try {
    const params = new URL(request.url).searchParams
    const from = params.get('from'), to = params.get('to')
    if (!validCalendarDate(from) || !validCalendarDate(to) || from > to)
      return NextResponse.json({ error:'A valid from/to date range is required.' }, { status:400 })
    const projectId = params.get('project_id'), ownerId = params.get('owner_id')
    // select(*) tolerates the unapplied additive migration. Only explicitly
    // constructed public calendar fields leave this server route.
    const [projects, tasks, seminars, ownership] = await Promise.all([
      supabase.from('projects').select('*').eq('status','active'),
      supabase.from('project_tasks').select('*').neq('status','done').gte('due_date',from).lte('due_date',to),
      projectId || ownerId ? Promise.resolve({data:[],error:null}) :
        supabase.from('seminars').select('*').gte('seminar_date',from).lte('seminar_date',to),
      loadOwnership(),
    ])
    if (projects.error || tasks.error || seminars.error) throw new Error('Calendar query failed')
    const events = companyCommitments(projects.data || [], (tasks.data || []).map(t => ({
      ...t, owner_ids:resolveOwnership(t, ownership.people, ownership.joins).owner_ids,
    })), {from,to,projectId,ownerId}).map(e => ({
      ...e, owner_names:e.owner_ids.map(id => ownership.people.find(p => p.id === id)?.name || 'Unknown owner'),
    }))
    const seminarEvents = (seminars.data || []).map(s => ({
      type:'seminar', id:s.id, date:s.seminar_date, title:s.title, start_time:s.start_time,
      client_name:s.client_name, location:s.location, notes:s.notes,
    }))
    return NextResponse.json({events:[...events,...seminarEvents]})
  } catch {
    return NextResponse.json({ error:'Could not load the complete Company calendar. Please retry.' }, { status:500 })
  }
}
