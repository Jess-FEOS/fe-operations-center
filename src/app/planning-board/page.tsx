'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// ── Types ───────────────────────────────────────────────────────────────────
interface Project {
  id: string
  name: string
  workflow_type: string
  launch_date: string | null
  progress: number
  total_tasks: number
  done_tasks: number
}

// ── Constants ───────────────────────────────────────────────────────────────
const WORKFLOW_STYLES: Record<string, { label: string; color: string; border: string }> = {
  'course-launch': { label: 'Course Launch', color: 'bg-fe-navy',    border: 'border-fe-navy' },
  'podcast':       { label: 'Podcast',       color: 'bg-[#6B4C9A]', border: 'border-[#6B4C9A]' },
  'newsletter':    { label: 'Newsletter',    color: 'bg-[#C45C2E]', border: 'border-[#C45C2E]' },
  'subscription':  { label: 'Subscription',  color: 'bg-fe-blue',   border: 'border-fe-blue' },
}

const MONTHS = Array.from({ length: 10 }, (_, i) => {
  const d = new Date(2026, 2 + i, 1) // March 2026 = month index 2
  return {
    key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    month: d.getMonth(),
    year: d.getFullYear(),
  }
})

const UNSCHEDULED_KEY = 'unscheduled'

function parseDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00')
}

function monthKey(dateStr: string): string {
  const d = parseDate(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function isCurrentMonth(key: string): boolean {
  const now = new Date()
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return key === current
}

// ── Page component ──────────────────────────────────────────────────────────
export default function PlanningBoard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const draggedId = useRef<string | null>(null)

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then((data: Project[]) => setProjects(data))
      .finally(() => setLoading(false))
  }, [])

  // ── Bucket projects into columns ────────────────────────────────────────
  function getColumns(): Record<string, Project[]> {
    const cols: Record<string, Project[]> = {}
    for (const m of MONTHS) cols[m.key] = []
    cols[UNSCHEDULED_KEY] = []

    for (const p of projects) {
      if (!p.launch_date) {
        cols[UNSCHEDULED_KEY].push(p)
      } else {
        const key = monthKey(p.launch_date)
        if (cols[key]) {
          cols[key].push(p)
        } else {
          // Launch date outside the visible range — put in nearest column
          cols[UNSCHEDULED_KEY].push(p)
        }
      }
    }
    return cols
  }

  const columns = getColumns()

  // ── Drag handlers ───────────────────────────────────────────────────────
  function onDragStart(e: React.DragEvent, projectId: string) {
    draggedId.current = projectId
    e.dataTransfer.effectAllowed = 'move'
    // Make the drag image slightly transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.dataTransfer.setDragImage(e.currentTarget, 0, 0)
    }
  }

  function onDragOver(e: React.DragEvent, colKey: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCol(colKey)
  }

  function onDragLeave() {
    setDragOverCol(null)
  }

  const onDrop = useCallback(
    async (e: React.DragEvent, colKey: string) => {
      e.preventDefault()
      setDragOverCol(null)
      const projectId = draggedId.current
      if (!projectId) return

      // Determine the new launch_date
      const newLaunchDate = colKey === UNSCHEDULED_KEY
        ? null
        : `${colKey}-01` // e.g. "2026-06-01"

      // Find project to check if anything actually changed
      const project = projects.find(p => p.id === projectId)
      if (!project) return
      const currentKey = project.launch_date ? monthKey(project.launch_date) : UNSCHEDULED_KEY
      if (currentKey === colKey) return

      // Optimistic update
      const prevProjects = [...projects]
      setProjects(prev =>
        prev.map(p =>
          p.id === projectId ? { ...p, launch_date: newLaunchDate } : p
        ),
      )

      try {
        const res = await fetch(`/api/projects/${projectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ launch_date: newLaunchDate }),
        })
        if (!res.ok) throw new Error('Failed to update')
      } catch {
        // Revert on failure
        setProjects(prevProjects)
      }
    },
    [projects],
  )

  // ── Loading ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-fe-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── All column keys in render order ─────────────────────────────────────
  const allCols = [...MONTHS.map(m => m.key), UNSCHEDULED_KEY]

  return (
    <div>
      <h1 className="font-barlow font-extrabold text-2xl text-fe-navy mb-6">
        Planning Board
      </h1>

      {/* Horizontally scrollable board */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3" style={{ minWidth: allCols.length * 220 }}>
          {allCols.map(colKey => {
            const isUnsched = colKey === UNSCHEDULED_KEY
            const monthMeta = MONTHS.find(m => m.key === colKey)
            const label = isUnsched ? 'Unscheduled' : monthMeta!.label
            const cards = columns[colKey] || []
            const overloaded = cards.length >= 3
            const isCurrent = !isUnsched && isCurrentMonth(colKey)
            const isDragOver = dragOverCol === colKey

            return (
              <div
                key={colKey}
                className={`w-56 shrink-0 rounded-xl border flex flex-col transition-colors ${
                  isDragOver
                    ? 'border-fe-blue bg-blue-50/60'
                    : isCurrent
                      ? 'border-fe-blue/30 bg-fe-blue/[0.04]'
                      : isUnsched
                        ? 'border-dashed border-gray-300 bg-gray-50/50'
                        : 'border-gray-200 bg-white'
                }`}
                onDragOver={e => onDragOver(e, colKey)}
                onDragLeave={onDragLeave}
                onDrop={e => onDrop(e, colKey)}
              >
                {/* Column header */}
                <div className={`px-3 py-3 border-b ${isDragOver ? 'border-fe-blue/20' : 'border-gray-100'} flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <h3 className={`font-barlow font-bold text-sm ${isCurrent ? 'text-fe-blue' : 'text-fe-navy'}`}>
                      {label}
                    </h3>
                    {isCurrent && (
                      <span className="text-[10px] font-fira font-bold text-fe-blue bg-fe-blue/10 rounded px-1.5 py-0.5 uppercase tracking-wide">
                        Now
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-fira text-fe-blue-gray">{cards.length}</span>
                    {overloaded && (
                      <span className="text-[10px] font-fira font-bold text-fe-red bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                        ⚠ Overloaded
                      </span>
                    )}
                  </div>
                </div>

                {/* Card area */}
                <div className="flex-1 p-2 space-y-2 min-h-[120px]">
                  {cards.length === 0 && (
                    <div className="flex items-center justify-center h-full text-xs font-fira text-gray-300 select-none">
                      {isDragOver ? 'Drop here' : 'No projects'}
                    </div>
                  )}
                  {cards.map(project => {
                    const style = WORKFLOW_STYLES[project.workflow_type] || WORKFLOW_STYLES['course-launch']
                    return (
                      <div
                        key={project.id}
                        draggable
                        onDragStart={e => onDragStart(e, project.id)}
                        className={`rounded-lg border-l-[3px] bg-white shadow-sm p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${style.border}`}
                      >
                        <p className="font-fira text-sm font-bold text-fe-anthracite leading-tight mb-1.5">
                          {project.name}
                        </p>
                        <span className={`inline-block text-[10px] font-fira font-bold text-white rounded px-1.5 py-0.5 mb-2 ${style.color}`}>
                          {style.label}
                        </span>
                        {/* Progress bar */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-fe-green transition-all"
                              style={{ width: `${project.progress}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-fira text-fe-blue-gray whitespace-nowrap">
                            {project.done_tasks}/{project.total_tasks}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
