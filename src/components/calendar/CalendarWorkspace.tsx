'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import { Owner, Program, marketingRequest, toISO } from '@/lib/marketing'
import { calendarDate, calendarHref } from '@/lib/calendar'
import CompanyCalendar from './CompanyCalendar'
import MarketingCalendar from './MarketingCalendar'

export interface CalendarViewProps {
  anchor: Date
  onAnchorChange: (date: Date) => void
  programs: Program[]
  team: Owner[]
  projectId: string
  ownerId: string
  navigating: boolean
}

export default function CalendarWorkspace() {
  const params = useSearchParams()
  const router = useRouter()
  const [navigating, startTransition] = useTransition()
  const view = params.get('view') === 'marketing' ? 'marketing' : 'company'
  const anchor = calendarDate(params.get('date'))
  const projectId = params.get('program') || ''
  const ownerId = params.get('owner') || ''
  const [programs, setPrograms] = useState<Program[]>([])
  const [team, setTeam] = useState<Owner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [p, t] = await Promise.all([
        marketingRequest<Program[]>('/api/marketing/programs'),
        marketingRequest<Owner[]>('/api/team'),
      ])
      setPrograms(p); setTeam(t)
    } catch (e: any) { setError(e.message || 'Could not load calendar filters.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])
  const update = (changes: Record<string, string | null>) =>
    startTransition(() => router.replace(calendarHref(new URLSearchParams(params), changes), { scroll: false }))
  const props: CalendarViewProps = {
    anchor, programs, team, projectId, ownerId, navigating,
    onAnchorChange: date => update({ date: toISO(date), asset: null, new: null }),
  }
  return (
    <div className="font-fira">
      <PageHeader title="Calendar" showDate={false} />
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <nav aria-label="Calendar views" className="flex border border-fe-line bg-white">
          {(['company', 'marketing'] as const).map(v => (
            <Link key={v} href={calendarHref(new URLSearchParams(params), { view: v, date: toISO(anchor), asset: null, new: null })}
              scroll={false} aria-current={view === v ? 'page' : undefined} data-testid={`calendar-view-${v}`}
              aria-disabled={navigating || undefined} onClick={e => { if (navigating) e.preventDefault() }}
              className={`px-5 py-3 text-sm font-bold ${navigating ? 'pointer-events-none opacity-60' : ''} ${view === v ? 'bg-fe-navy text-white' : 'text-fe-navy hover:bg-fe-offwhite'}`}>
              {v === 'company' ? 'Company' : 'Marketing'}
            </Link>
          ))}
        </nav>
        <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex min-w-0">
          <select disabled={navigating || loading} aria-label="Program" data-testid="filter-program" className="fe-input !w-full sm:!w-auto min-w-0 max-w-full"
            value={projectId} onChange={e => update({ program: e.target.value, asset: null, new: null })}>
            <option value="">{view === 'company' ? 'All projects' : 'All programs'}</option>
            {programs.map(p => <option key={p.project_id} value={p.project_id}>{p.name}{p.project_status === 'archived' ? ' (archived)' : ''}</option>)}
          </select>
          <select disabled={navigating || loading} aria-label="Owner" data-testid="filter-owner" className="fe-input !w-full sm:!w-auto min-w-0 max-w-full"
            value={ownerId} onChange={e => update({ owner: e.target.value, asset: null, new: null })}>
            <option value="">All owners</option>
            {team.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <p className="text-sm text-fe-blue-gray mb-4">
        {view === 'company' ? 'Project launches, program starts, seminars and selected enterprise commitments.' : 'Plan what goes out, on which platform, and whether it is ready.'}
      </p>
      {error ? <div role="alert" className="border border-fe-red p-4 text-fe-red">{error} <button onClick={load} className="underline">Retry</button></div>
        : loading ? <p role="status" className="py-12 text-fe-blue-gray">Loading calendar…</p>
        : view === 'company' ? <CompanyCalendar {...props} /> : <MarketingCalendar {...props} />}
    </div>
  )
}
