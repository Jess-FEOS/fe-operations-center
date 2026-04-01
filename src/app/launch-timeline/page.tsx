'use client'

import { useState, useEffect, useMemo } from 'react'

// ── Types ───────────────────────────────────────────────────────────────────
interface ApiProject {
  id: string
  name: string
  workflow_type: string
  launch_date: string | null
  start_date: string
  status: string
}

interface Program {
  name: string
  launchDate: string | null
  color: string
  isTbd: boolean
}

// ── Color mapping ───────────────────────────────────────────────────────────
const COURSE_LAUNCH_COLORS: Record<string, string> = {
  'Analyst Academy':    '#046A38',
  'Intern Accelerator': '#437F94',
  'Modeling Academy':   '#B29838',
  'Credit Academy':     '#888888',
}

const WORKFLOW_TYPE_COLORS: Record<string, string> = {
  'subscription': '#0762C8',
  'podcast':      '#6B4C9A',
  'newsletter':   '#C45C2E',
}

function getColor(project: ApiProject): string {
  if (project.workflow_type === 'course-launch') {
    return COURSE_LAUNCH_COLORS[project.name] ?? '#0762C8'
  }
  return WORKFLOW_TYPE_COLORS[project.workflow_type] ?? '#9CA3AF'
}

// ── Date helpers ────────────────────────────────────────────────────────────
/** Parse a YYYY-MM-DD string at noon local time to avoid UTC offset issues */
function parseDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00')
}

const MARKETING_WINDOW_DAYS = 21

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

function addDays(date: Date, n: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, n: number) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1)
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function loadColor(count: number) {
  if (count >= 3) return '#C8350D'
  if (count === 2) return '#D4930D'
  if (count === 1) return '#046A38'
  return '#D1D5DB'
}

// ── Page component ──────────────────────────────────────────────────────────
export default function LaunchTimeline() {
  const [projects, setProjects] = useState<ApiProject[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then((data: ApiProject[]) => setProjects(data))
      .finally(() => setLoading(false))
  }, [])

  // ── Derive programs from API data ───────────────────────────────────────
  const programs: Program[] = useMemo(
    () =>
      projects.map(p => ({
        name: p.name,
        launchDate: p.launch_date,
        color: getColor(p),
        isTbd: !p.launch_date,
      })),
    [projects],
  )

  // ── Dynamic timeline range (1 month padding each side) ──────────────────
  const { timelineStart, timelineEnd, totalDays } = useMemo(() => {
    const dates = programs.filter(p => p.launchDate).map(p => parseDate(p.launchDate!))
    if (dates.length === 0) {
      const now = new Date()
      const s = startOfMonth(now)
      const e = addMonths(s, 6)
      return { timelineStart: s, timelineEnd: e, totalDays: daysBetween(s, e) }
    }
    const earliest = new Date(Math.min(...dates.map(d => d.getTime())))
    const latest = new Date(Math.max(...dates.map(d => d.getTime())))
    const s = addMonths(startOfMonth(earliest), -1)
    const e = addMonths(startOfMonth(latest), 2)
    return { timelineStart: s, timelineEnd: e, totalDays: daysBetween(s, e) }
  }, [programs])

  function pct(date: Date) {
    return Math.max(0, Math.min(100, (daysBetween(timelineStart, date) / totalDays) * 100))
  }

  // ── Month tick marks ────────────────────────────────────────────────────
  const monthTicks = useMemo(() => {
    const ticks: { label: string; pct: number }[] = []
    let cursor = new Date(timelineStart)
    while (cursor <= timelineEnd) {
      ticks.push({ label: MONTH_NAMES[cursor.getMonth()], pct: pct(cursor) })
      cursor = addMonths(cursor, 1)
    }
    return ticks
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineStart, timelineEnd, totalDays])

  // ── Weekly marketing load ───────────────────────────────────────────────
  const weeks = useMemo(() => {
    const result: { start: Date; end: Date; label: string; count: number }[] = []
    let cursor = new Date(timelineStart)
    while (cursor < timelineEnd) {
      const weekEnd = addDays(cursor, 6)
      const mid = addDays(cursor, 3)
      const label = mid.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      let count = 0
      for (const p of programs) {
        if (!p.launchDate) continue
        const launch = parseDate(p.launchDate)
        const mktStart = addDays(launch, -MARKETING_WINDOW_DAYS)
        if (mktStart <= weekEnd && launch >= cursor) count++
      }
      result.push({ start: new Date(cursor), end: weekEnd, label, count })
      cursor = addDays(cursor, 7)
    }
    return result
  }, [programs, timelineStart, timelineEnd])

  const maxCount = Math.max(...weeks.map(w => w.count), 1)

  // ── Launch-date collision groups ────────────────────────────────────────
  const launchGroups = useMemo(() => {
    const groups: Record<string, Program[]> = {}
    for (const p of programs) {
      if (!p.launchDate) continue
      ;(groups[p.launchDate] ??= []).push(p)
    }
    return groups
  }, [programs])

  const collisions = useMemo(
    () => Object.entries(launchGroups).filter(([, progs]) => progs.length > 1),
    [launchGroups],
  )

  // ── Warning banner text ─────────────────────────────────────────────────
  const warningText = useMemo(() => {
    if (collisions.length === 0) return null

    const parts: string[] = []
    for (const [date, progs] of collisions) {
      const formatted = parseDate(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
      parts.push(`${progs.length} programs share a ${formatted} launch date`)
    }

    // Find the earliest marketing-window start among colliding programs
    let earliestOverlap: Date | null = null
    for (const [, progs] of collisions) {
      for (const p of progs) {
        if (!p.launchDate) continue
        const mktStart = addDays(parseDate(p.launchDate), -MARKETING_WINDOW_DAYS)
        if (!earliestOverlap || mktStart < earliestOverlap) earliestOverlap = mktStart
      }
    }

    const overlapStr = earliestOverlap
      ? ` Marketing windows overlap starting ${earliestOverlap.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.`
      : ''

    return `${parts.join('. ')}.${overlapStr}`
  }, [collisions])

  // ── Loading state ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-fe-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* ── Page heading ─────────────────────────────────────────────────── */}
      <h1 className="font-barlow font-extrabold text-2xl text-fe-navy mb-6">
        Launch Timeline
      </h1>

      {/* ── Dynamic warning callout ──────────────────────────────────────── */}
      {warningText && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-5 py-4 mb-8">
          <svg className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A1 1 0 002.54 20h18.92a1 1 0 00.85-1.28l-8.6-14.86a1 1 0 00-1.72 0z" />
          </svg>
          <p className="font-fira text-sm text-amber-900 leading-relaxed">
            <span className="font-bold">{warningText.split('.')[0]}.</span>{' '}
            {warningText.split('.').slice(1).join('.').trim()}
          </p>
        </div>
      )}

      {/* ── Marketing Load bar chart ─────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-8 shadow-sm">
        <h2 className="font-barlow font-bold text-lg text-fe-navy mb-4">Marketing Load by Week</h2>
        <div className="flex items-end gap-[3px] h-40">
          {weeks.map((w, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
              <div className="absolute -top-8 hidden group-hover:flex bg-fe-navy text-white text-xs font-fira rounded px-2 py-1 whitespace-nowrap z-10">
                {w.label}: {w.count} program{w.count !== 1 ? 's' : ''}
              </div>
              <div
                className="w-full rounded-t transition-all"
                style={{
                  height: `${(w.count / maxCount) * 100}%`,
                  minHeight: w.count > 0 ? 4 : 2,
                  backgroundColor: loadColor(w.count),
                }}
              />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-5 mt-4 text-xs font-fira text-fe-anthracite">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#C8350D' }} /> 3+ programs (overloaded)</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#D4930D' }} /> 2 programs</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#046A38' }} /> 1 program</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#D1D5DB' }} /> None</span>
        </div>
      </section>

      {/* ── Swimlane timeline ────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="font-barlow font-bold text-lg text-fe-navy mb-6">Program Swimlanes</h2>

        {/* Month axis */}
        <div className="relative h-6 mb-2 ml-44">
          {monthTicks.map((m) => (
            <span
              key={m.label + m.pct}
              className="absolute text-xs font-fira text-fe-blue-gray -translate-x-1/2"
              style={{ left: `${m.pct}%` }}
            >
              {m.label}
            </span>
          ))}
        </div>

        {/* Rows */}
        <div className="space-y-2">
          {programs.map((prog) => {
            const hasDate = !prog.isTbd
            const launch = hasDate ? parseDate(prog.launchDate!) : null
            const mktStart = launch ? addDays(launch, -MARKETING_WINDOW_DAYS) : null

            // For TBD: show a short placeholder bar near the end of the timeline
            const barLeft = mktStart ? pct(mktStart) : 85
            const barWidth = mktStart ? pct(launch!) - pct(mktStart) : 8
            const launchPct = launch ? pct(launch) : null

            const group = hasDate ? (launchGroups[prog.launchDate!] ?? []) : []
            const isCollision = group.length > 1
            const collisionIdx = group.indexOf(prog)

            return (
              <div key={prog.name} className="flex items-center gap-0">
                {/* Label */}
                <div className="w-44 shrink-0 pr-4 text-right">
                  <span className="font-fira text-sm font-bold text-fe-anthracite">
                    {prog.name}
                  </span>
                  {prog.isTbd && (
                    <span className="ml-1.5 text-[10px] font-fira text-gray-400 uppercase tracking-wide">
                      TBD
                    </span>
                  )}
                </div>

                {/* Track */}
                <div className="flex-1 relative h-10">
                  {/* Grid lines for months */}
                  {monthTicks.map((m) => (
                    <div
                      key={m.label + m.pct}
                      className="absolute top-0 bottom-0 w-px bg-gray-100"
                      style={{ left: `${m.pct}%` }}
                    />
                  ))}

                  {/* Background track */}
                  <div className="absolute inset-0 rounded bg-gray-50" />

                  {/* Marketing window bar */}
                  <div
                    className="absolute top-1.5 bottom-1.5 rounded"
                    style={{
                      left: `${barLeft}%`,
                      width: `${barWidth}%`,
                      backgroundColor: prog.color,
                      opacity: prog.isTbd ? 0.15 : 0.25,
                      border: prog.isTbd ? `2px dashed ${prog.color}` : undefined,
                    }}
                  />

                  {/* Launch marker or TBD marker */}
                  {hasDate && launchPct !== null ? (
                    <div
                      className="absolute top-0 bottom-0 flex flex-col items-center"
                      style={{ left: `${launchPct}%`, transform: 'translateX(-50%)' }}
                    >
                      <div className="w-0.5 flex-1" style={{ backgroundColor: prog.color }} />
                      <div
                        className="w-3.5 h-3.5 rounded-full shadow-md shrink-0 absolute top-1/2 -translate-y-1/2"
                        style={{
                          backgroundColor: prog.color,
                          border: '2px solid white',
                          marginLeft: isCollision
                            ? `${(collisionIdx - (group.length - 1) / 2) * 14}px`
                            : undefined,
                        }}
                      />
                    </div>
                  ) : (
                    /* TBD "?" marker */
                    <div
                      className="absolute top-0 bottom-0 flex items-center justify-center"
                      style={{ left: `${barLeft + barWidth / 2}%`, transform: 'translateX(-50%)' }}
                    >
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{
                          border: `2px dashed ${prog.color}`,
                          color: prog.color,
                          backgroundColor: 'white',
                        }}
                      >
                        ?
                      </div>
                    </div>
                  )}

                  {/* Collision highlight stripe */}
                  {isCollision && collisionIdx === 0 && launchPct !== null && (
                    <div
                      className="absolute top-0 bottom-0 rounded pointer-events-none"
                      style={{
                        left: `${launchPct - 0.6}%`,
                        width: '1.2%',
                        minWidth: 6,
                        backgroundColor: '#C8350D',
                        opacity: 0.12,
                      }}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Collision callout cards */}
        {collisions.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-3">
            {collisions.map(([date, progs]) => (
              <div
                key={date}
                className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2"
              >
                <svg className="w-4 h-4 text-fe-red shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
                  <circle cx="12" cy="12" r="10" strokeWidth={2} />
                </svg>
                <span className="text-xs font-fira text-fe-anthracite">
                  <span className="font-bold">
                    {progs.length} launches on{' '}
                    {parseDate(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}:
                  </span>{' '}
                  {progs.map(p => p.name).join(', ')}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Color legend */}
        <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-gray-100">
          {programs.map((p) => (
            <span key={p.name} className="flex items-center gap-1.5 text-xs font-fira text-fe-anthracite">
              <span
                className="w-3 h-3 rounded-sm inline-block"
                style={{
                  backgroundColor: p.color,
                  border: p.isTbd ? `1.5px dashed ${p.color}` : undefined,
                  opacity: p.isTbd ? 0.6 : 1,
                }}
              />
              {p.name}
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}
