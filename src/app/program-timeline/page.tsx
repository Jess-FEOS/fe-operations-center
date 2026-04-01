'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { SIMPLIFIED_PHASE_ORDER, SIMPLIFIED_PHASE_COLORS, SimplifiedPhase } from '@/lib/phases'

// ── Types ───────────────────────────────────────────────────────────────────
interface PhaseStats { total: number; done: number }

interface Project {
  id: string
  name: string
  workflow_type: string
  start_date: string
  launch_date: string | null
  phase_breakdown: Record<SimplifiedPhase, PhaseStats>
  total_tasks: number
  done_tasks: number
}

// ── Constants ───────────────────────────────────────────────────────────────
const WORKFLOW_LABELS: Record<string, string> = {
  'course-launch': 'Course Launch',
  'podcast': 'Podcast',
  'newsletter': 'Newsletter',
  'subscription': 'Subscription',
}

const WORKFLOW_BADGE_COLORS: Record<string, string> = {
  'course-launch': '#1B365D',
  'podcast': '#6B4C9A',
  'newsletter': '#C45C2E',
  'subscription': '#0762C8',
}

const ROW_HEIGHT = 56
const ROW_GAP = 8
const LABEL_WIDTH = 200
const MARKETING_WINDOW_DAYS = 21

// ── Date helpers ────────────────────────────────────────────────────────────
function parseDate(s: string) { return new Date(s + 'T12:00:00') }

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function formatDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function loadColor(count: number) {
  if (count >= 3) return '#C8350D'
  if (count === 2) return '#D4930D'
  if (count === 1) return '#046A38'
  return '#D1D5DB'
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ── Page component ──────────────────────────────────────────────────────────
export default function ProgramTimeline() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragGhostLeft, setDragGhostLeft] = useState<number | null>(null)
  const [dragGhostWidth, setDragGhostWidth] = useState<number | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  const dragStartX = useRef(0)
  const dragBarOrigLeft = useRef(0)
  const dragBarOrigWidth = useRef(0)

  // Toast state
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then((data: Project[]) => setProjects(data))
      .finally(() => setLoading(false))
  }, [])

  const today = useMemo(() => new Date(), [])

  // Sort: projects with launch_date first (ascending), then TBDs
  const sorted = useMemo(() =>
    [...projects].sort((a, b) => {
      if (a.launch_date && b.launch_date) return parseDate(a.launch_date).getTime() - parseDate(b.launch_date).getTime()
      if (a.launch_date) return -1
      if (b.launch_date) return 1
      return 0
    }),
    [projects],
  )

  // Timeline range: earliest start to latest launch, +14 days padding each side
  const { timelineStart, timelineEnd, totalDays } = useMemo(() => {
    const starts = sorted.map(p => parseDate(p.start_date))
    const launches = sorted.filter(p => p.launch_date).map(p => parseDate(p.launch_date!))
    const allDates = [...starts, ...launches, today]
    const min = new Date(Math.min(...allDates.map(d => d.getTime())))
    const max = new Date(Math.max(...allDates.map(d => d.getTime())))
    const s = addDays(min, -14)
    const e = addDays(max, 14)
    return { timelineStart: s, timelineEnd: e, totalDays: daysBetween(s, e) }
  }, [sorted, today])

  const pct = useCallback((date: Date) => {
    return Math.max(0, Math.min(100, (daysBetween(timelineStart, date) / totalDays) * 100))
  }, [timelineStart, totalDays])

  // Month ticks
  const monthTicks = useMemo(() => {
    const ticks: { label: string; pct: number }[] = []
    const cursor = new Date(timelineStart.getFullYear(), timelineStart.getMonth(), 1)
    if (cursor < timelineStart) cursor.setMonth(cursor.getMonth() + 1)
    while (cursor <= timelineEnd) {
      ticks.push({
        label: `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`,
        pct: pct(cursor),
      })
      cursor.setMonth(cursor.getMonth() + 1)
    }
    return ticks
  }, [timelineStart, timelineEnd, pct])

  const todayPct = pct(today)

  // ── Marketing Load by Week (from launch-timeline) ─────────────────────────
  const weeks = useMemo(() => {
    const result: { start: Date; end: Date; label: string; count: number }[] = []
    let cursor = new Date(timelineStart)
    while (cursor < timelineEnd) {
      const weekEnd = addDays(cursor, 6)
      const mid = addDays(cursor, 3)
      const label = mid.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      let count = 0
      for (const p of sorted) {
        if (!p.launch_date) continue
        const launch = parseDate(p.launch_date)
        const mktStart = addDays(launch, -MARKETING_WINDOW_DAYS)
        if (mktStart <= weekEnd && launch >= cursor) count++
      }
      result.push({ start: new Date(cursor), end: weekEnd, label, count })
      cursor = addDays(cursor, 7)
    }
    return result
  }, [sorted, timelineStart, timelineEnd])

  const maxCount = Math.max(...weeks.map(w => w.count), 1)

  // ── Marketing overlap detection ─────────────────────────────────────────
  const marketWindows = useMemo(() => {
    return sorted.filter(p => p.launch_date && p.total_tasks > 0).map(p => {
      const start = parseDate(p.start_date)
      const end = parseDate(p.launch_date!)
      const span = daysBetween(start, end)
      const pb = p.phase_breakdown
      const total = p.total_tasks
      const buildFrac = (pb.Build?.total ?? 0) / total
      const marketFrac = (pb.Market?.total ?? 0) / total
      const mktStart = addDays(start, Math.round(span * buildFrac))
      const mktEnd = addDays(start, Math.round(span * (buildFrac + marketFrac)))
      return { id: p.id, mktStart, mktEnd }
    })
  }, [sorted])

  const overlapZones = useMemo(() => {
    const zones: { left: number; width: number }[] = []
    for (let i = 0; i < marketWindows.length; i++) {
      for (let j = i + 1; j < marketWindows.length; j++) {
        const a = marketWindows[i]
        const b = marketWindows[j]
        const overlapStart = new Date(Math.max(a.mktStart.getTime(), b.mktStart.getTime()))
        const overlapEnd = new Date(Math.min(a.mktEnd.getTime(), b.mktEnd.getTime()))
        if (overlapStart < overlapEnd) {
          const left = pct(overlapStart)
          const right = pct(overlapEnd)
          zones.push({ left, width: right - left })
        }
      }
    }
    if (zones.length === 0) return zones
    zones.sort((a, b) => a.left - b.left)
    const merged: typeof zones = [zones[0]]
    for (let i = 1; i < zones.length; i++) {
      const prev = merged[merged.length - 1]
      const cur = zones[i]
      if (cur.left <= prev.left + prev.width) {
        const end = Math.max(prev.left + prev.width, cur.left + cur.width)
        prev.width = end - prev.left
      } else {
        merged.push(cur)
      }
    }
    return merged
  }, [marketWindows, pct])

  // ── Drag-to-reschedule handlers ───────────────────────────────────────────
  function pctToDate(pctVal: number): Date {
    const days = Math.round((pctVal / 100) * totalDays)
    return addDays(timelineStart, days)
  }

  function getChartAreaRect() {
    if (!chartRef.current) return null
    // The chart area is the portion after LABEL_WIDTH
    const rect = chartRef.current.getBoundingClientRect()
    return {
      left: rect.left + LABEL_WIDTH,
      width: rect.width - LABEL_WIDTH,
      top: rect.top,
      height: rect.height,
    }
  }

  function onBarMouseDown(e: React.MouseEvent, project: Project, barLeftPct: number, barWidthPct: number) {
    if (!project.launch_date) return
    e.preventDefault()
    e.stopPropagation()
    setDraggingId(project.id)
    dragStartX.current = e.clientX
    dragBarOrigLeft.current = barLeftPct
    dragBarOrigWidth.current = barWidthPct
    setDragGhostLeft(barLeftPct)
    setDragGhostWidth(barWidthPct)
  }

  useEffect(() => {
    if (!draggingId) return

    function onMouseMove(e: MouseEvent) {
      const area = getChartAreaRect()
      if (!area) return
      const dx = e.clientX - dragStartX.current
      const dPct = (dx / area.width) * 100
      const newLeft = Math.max(0, Math.min(100 - dragBarOrigWidth.current, dragBarOrigLeft.current + dPct))
      setDragGhostLeft(newLeft)
    }

    async function onMouseUp(e: MouseEvent) {
      const area = getChartAreaRect()
      if (!area || !draggingId) {
        setDraggingId(null)
        setDragGhostLeft(null)
        setDragGhostWidth(null)
        return
      }

      const dx = e.clientX - dragStartX.current
      const dPct = (dx / area.width) * 100

      // If barely moved, treat as click — navigate
      if (Math.abs(dPct) < 0.5) {
        setDraggingId(null)
        setDragGhostLeft(null)
        setDragGhostWidth(null)
        router.push(`/projects/${draggingId}`)
        return
      }

      const project = projects.find(p => p.id === draggingId)
      if (!project || !project.launch_date) {
        setDraggingId(null)
        setDragGhostLeft(null)
        setDragGhostWidth(null)
        return
      }

      // Calculate new launch date from the RIGHT edge of the ghost bar
      const newBarLeft = Math.max(0, Math.min(100 - dragBarOrigWidth.current, dragBarOrigLeft.current + dPct))
      const newBarRight = newBarLeft + dragBarOrigWidth.current
      const newLaunchDate = pctToDate(newBarRight)
      const newLaunchStr = formatDateStr(newLaunchDate)

      // Optimistic update
      const prevProjects = [...projects]
      setProjects(prev =>
        prev.map(p => p.id === draggingId ? { ...p, launch_date: newLaunchStr } : p)
      )

      setDraggingId(null)
      setDragGhostLeft(null)
      setDragGhostWidth(null)

      try {
        const res = await fetch(`/api/projects/${draggingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ launch_date: newLaunchStr }),
        })
        if (!res.ok) throw new Error('Failed to update')
        showToast(`Launch date updated to ${newLaunchDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`)
      } catch {
        setProjects(prevProjects)
        showToast('Failed to update launch date')
      }
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingId, projects, router, totalDays, timelineStart])

  // ── Loading ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-fe-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-barlow font-extrabold text-2xl text-fe-navy">Program Timeline</h1>
        <span className="text-sm font-fira text-fe-blue-gray">
          {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </span>
      </div>

      {/* Chart container */}
      <div ref={chartRef} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-visible">

        {/* ── Marketing Load bar chart ─────────────────────────────────── */}
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="font-barlow font-bold text-sm text-fe-navy mb-3">Marketing Load by Week</h2>
          <div className="flex items-end gap-[2px] h-24">
            {weeks.map((w, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                <div className="absolute -top-8 hidden group-hover:flex bg-fe-navy text-white text-[10px] font-fira rounded px-2 py-1 whitespace-nowrap z-10">
                  {w.label}: {w.count} program{w.count !== 1 ? 's' : ''}
                </div>
                <div
                  className="w-full rounded-t transition-all"
                  style={{
                    height: `${(w.count / maxCount) * 100}%`,
                    minHeight: w.count > 0 ? 3 : 1,
                    backgroundColor: loadColor(w.count),
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-2 text-[10px] font-fira text-fe-anthracite">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: '#C8350D' }} /> 3+</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: '#D4930D' }} /> 2</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: '#046A38' }} /> 1</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: '#D1D5DB' }} /> 0</span>
          </div>
        </div>

        {/* Month header row */}
        <div className="flex border-b border-gray-100">
          <div className="shrink-0" style={{ width: LABEL_WIDTH }} />
          <div className="flex-1 relative h-8">
            {monthTicks.map(m => (
              <span
                key={m.label}
                className="absolute top-2 text-[10px] font-fira text-fe-blue-gray -translate-x-1/2"
                style={{ left: `${m.pct}%` }}
              >
                {m.label}
              </span>
            ))}
            <span
              className="absolute top-0 text-[10px] font-fira font-bold text-fe-red -translate-x-1/2"
              style={{ left: `${todayPct}%` }}
            >
              Today
            </span>
          </div>
        </div>

        {/* Project rows */}
        <div className="relative">
          {sorted.map((project, i) => {
            const hasLaunch = !!project.launch_date
            const start = parseDate(project.start_date)
            const end = hasLaunch ? parseDate(project.launch_date!) : addDays(start, 28)
            const barLeft = pct(start)
            const barRight = pct(end)
            const barWidth = Math.max(barRight - barLeft, 1)
            const daysUntilLaunch = hasLaunch ? daysBetween(today, parseDate(project.launch_date!)) : null
            const pb = project.phase_breakdown
            const badgeColor = WORKFLOW_BADGE_COLORS[project.workflow_type] ?? '#1B365D'
            const isHovered = hoveredId === project.id
            const isLast = i === sorted.length - 1
            const isDragging = draggingId === project.id

            // Use ghost position while dragging this row
            const displayLeft = isDragging && dragGhostLeft !== null ? dragGhostLeft : barLeft
            const displayWidth = isDragging && dragGhostWidth !== null ? dragGhostWidth : barWidth

            return (
              <div
                key={project.id}
                className={`flex items-center transition-colors ${isHovered && !draggingId ? 'bg-fe-blue/[0.03]' : ''} ${isLast ? '' : 'border-b border-gray-50'}`}
                style={{ height: ROW_HEIGHT + ROW_GAP }}
                onMouseEnter={() => setHoveredId(project.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => { if (!draggingId) router.push(`/projects/${project.id}`) }}
              >
                {/* Label */}
                <div className="shrink-0 flex flex-col justify-center px-4" style={{ width: LABEL_WIDTH }}>
                  <p className="font-fira text-sm font-bold text-fe-anthracite leading-tight truncate">
                    {project.name}
                  </p>
                  <span
                    className="inline-block text-[9px] font-fira font-bold text-white rounded px-1 py-0.5 mt-0.5 w-fit"
                    style={{ backgroundColor: badgeColor }}
                  >
                    {WORKFLOW_LABELS[project.workflow_type] ?? project.workflow_type}
                  </span>
                </div>

                {/* Chart area */}
                <div className="flex-1 relative h-full group/row">
                  {/* Bar */}
                  <div
                    className={`absolute top-2 bottom-2 rounded-md overflow-hidden flex ${
                      hasLaunch ? '' : 'border-2 border-dashed border-gray-300'
                    } ${hasLaunch ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${isDragging ? 'opacity-70 ring-2 ring-fe-blue ring-offset-1' : ''}`}
                    style={{ left: `${displayLeft}%`, width: `${displayWidth}%` }}
                    onMouseDown={e => onBarMouseDown(e, project, barLeft, barWidth)}
                  >
                    {hasLaunch && project.total_tasks > 0 ? (
                      SIMPLIFIED_PHASE_ORDER.map(sp => {
                        const stats = pb[sp]
                        if (!stats || stats.total === 0) return null
                        const segWidthPct = (stats.total / project.total_tasks) * 100
                        const donePct = stats.total > 0 ? (stats.done / stats.total) * 100 : 0
                        const color = SIMPLIFIED_PHASE_COLORS[sp]
                        return (
                          <div key={sp} className="relative h-full" style={{ width: `${segWidthPct}%` }}>
                            <div className="absolute inset-0 opacity-30" style={{ backgroundColor: color }} />
                            <div className="absolute left-0 top-0 bottom-0" style={{ width: `${donePct}%`, backgroundColor: color }} />
                          </div>
                        )
                      })
                    ) : (
                      <div className="flex-1 flex items-center justify-center">
                        <span className="text-[10px] font-fira font-bold text-gray-400">TBD</span>
                      </div>
                    )}
                  </div>

                  {/* Tooltip */}
                  {isHovered && !draggingId && (
                    <div
                      className="absolute z-20 bg-fe-navy text-white text-[11px] font-fira rounded-lg px-3 py-2 shadow-lg pointer-events-none whitespace-nowrap"
                      style={{ left: `${barLeft}%`, bottom: '100%', marginBottom: 4 }}
                    >
                      <div className="font-bold mb-0.5">
                        {project.name}
                        {hasLaunch && (
                          <span className="font-normal text-white/70">
                            {' '}· Launch {parseDate(project.launch_date!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            {daysUntilLaunch !== null && (
                              <span> ({daysUntilLaunch > 0 ? `${daysUntilLaunch}d away` : daysUntilLaunch === 0 ? 'today' : `${Math.abs(daysUntilLaunch)}d ago`})</span>
                            )}
                          </span>
                        )}
                      </div>
                      <div className="text-white/80">
                        {SIMPLIFIED_PHASE_ORDER.map((sp, idx) => {
                          const stats = pb[sp]
                          if (!stats || stats.total === 0) return null
                          return (
                            <span key={sp}>
                              {idx > 0 && ' · '}
                              <span style={{ color: sp === 'Build' ? '#93B5E0' : sp === 'Market' ? '#6BB0F0' : '#5CD89A' }}>{sp}</span> {stats.done}/{stats.total}
                            </span>
                          )
                        })}
                      </div>
                      <div className="text-white/50 mt-0.5 text-[10px]">Drag bar to reschedule</div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Overlay: today line spanning all rows */}
          <div
            className="absolute top-0 bottom-0 w-px border-l border-dashed border-fe-red pointer-events-none z-10"
            style={{ left: `calc(${LABEL_WIDTH}px + (100% - ${LABEL_WIDTH}px) * ${todayPct / 100})` }}
          />

          {/* Overlay: marketing overlap zones */}
          {overlapZones.map((z, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 pointer-events-none"
              style={{
                left: `calc(${LABEL_WIDTH}px + (100% - ${LABEL_WIDTH}px) * ${z.left / 100})`,
                width: `calc((100% - ${LABEL_WIDTH}px) * ${z.width / 100})`,
                backgroundColor: '#C8350D',
                opacity: 0.06,
              }}
            />
          ))}

          {/* Overlay: month grid lines */}
          {monthTicks.map(m => (
            <div
              key={m.label}
              className="absolute top-0 bottom-0 w-px bg-gray-50 pointer-events-none"
              style={{ left: `calc(${LABEL_WIDTH}px + (100% - ${LABEL_WIDTH}px) * ${m.pct / 100})` }}
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-4 text-xs font-fira text-fe-anthracite">
        {SIMPLIFIED_PHASE_ORDER.map(sp => (
          <span key={sp} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: SIMPLIFIED_PHASE_COLORS[sp] }} />
            {sp}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-fe-blue-gray">|</span>
        <span className="flex items-center gap-1.5 text-fe-blue-gray">
          Filled = complete · Faded = remaining
        </span>
        {overlapZones.length > 0 && (
          <>
            <span className="flex items-center gap-1.5 text-fe-blue-gray">|</span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-fe-red/20 border border-fe-red/30" />
              Overlapping marketing windows
            </span>
          </>
        )}
      </div>

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-fe-navy text-white text-sm font-fira rounded-lg px-4 py-3 shadow-xl animate-in fade-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}
    </div>
  )
}
