'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Avatar from '@/components/Avatar'
import PageHeader from '@/components/PageHeader'

interface TeamMember {
  id: string
  name: string
  initials: string
  color: string
}

interface ChecklistItem {
  id: string
  week_start: string
  description: string
  assigned_to_ids: string[]
  is_done: boolean
  is_priority: boolean
  delivery_date: string | null
  created_at: string
}

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatWeekStart(date: Date): string {
  return date.toISOString().split('T')[0]
}

function formatWeekLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// Given a 'YYYY-MM-DD' week_start (a Monday), return the next Monday as 'YYYY-MM-DD'.
// Parsed from parts (not Date('YYYY-MM-DD'), which is UTC) to stay in local time, matching getMonday/formatWeekStart.
function nextWeekStart(weekStartStr: string): string {
  const [y, m, d] = weekStartStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + 7)
  return formatWeekStart(getMonday(date))
}

// Mirror of nextWeekStart: previous Monday. Same local-time parsing and Monday-snap, -7 instead of +7.
function prevWeekStart(weekStartStr: string): string {
  const [y, m, d] = weekStartStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() - 7)
  return formatWeekStart(getMonday(date))
}

export default function WeeklyChecklistPage() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Assignee picker: id of the item whose popover is open (only one at a time), plus its anchor position.
  const [openPicker, setOpenPicker] = useState<string | null>(null)
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null)
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const weekStartStr = formatWeekStart(weekStart)

  const fetchItems = useCallback(async (ws: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/weekly-checklist?week_start=${ws}`)
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch('/api/team')
      .then(r => r.json())
      .then(data => setTeam(Array.isArray(data) ? data : []))
  }, [])

  useEffect(() => {
    fetchItems(weekStartStr)
  }, [weekStartStr, fetchItems])

  // Close the assignee picker on outside-click (ignoring the trigger + popover) and on Escape.
  useEffect(() => {
    if (!openPicker) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('[data-assignee-popover]') || t.closest('[data-assignee-trigger]')) return
      setOpenPicker(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenPicker(null)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [openPicker])

  const teamMap = new Map(team.map(m => [m.id, m]))

  const navigateWeek = (delta: number) => {
    setWeekStart(prev => {
      const next = new Date(prev)
      next.setDate(prev.getDate() + delta * 7)
      return getMonday(next)
    })
  }

  const goToThisWeek = () => {
    setWeekStart(getMonday(new Date()))
  }

  const addItem = async () => {
    setAdding(true)
    try {
      const res = await fetch('/api/weekly-checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_start: weekStartStr, description: '' }),
      })
      if (res.ok) {
        const newItem = await res.json()
        setItems(prev => [...prev, newItem])
      }
    } finally {
      setAdding(false)
    }
  }

  const deleteItem = async (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
    await fetch(`/api/weekly-checklist/${id}`, { method: 'DELETE' })
  }

  const patchItem = useCallback((id: string, updates: Partial<ChecklistItem>) => {
    // Debounced save — 500ms for text, immediate for checkbox/dropdown
    const isText = 'description' in updates
    const delay = isText ? 500 : 0

    if (debounceTimers.current[id]) {
      clearTimeout(debounceTimers.current[id])
    }

    debounceTimers.current[id] = setTimeout(async () => {
      await fetch(`/api/weekly-checklist/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      delete debounceTimers.current[id]
    }, delay)
  }, [])

  const updateItem = (id: string, updates: Partial<ChecklistItem>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
    patchItem(id, updates)
  }

  // Move an item to a different week. Awaited (NOT fire-and-forget): only remove from the
  // current view on success; on failure surface an error and leave the item in place.
  const moveItemToWeek = async (item: ChecklistItem, newWeekStart: string, failMsg: string) => {
    try {
      const res = await fetch(`/api/weekly-checklist/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_start: newWeekStart }),
      })
      if (!res.ok) throw new Error('Request failed')
      setItems(prev => prev.filter(i => i.id !== item.id))
      setError(null)
    } catch {
      setError(failMsg)
    }
  }

  const pushToNextWeek = (item: ChecklistItem) =>
    moveItemToWeek(item, nextWeekStart(item.week_start), 'Could not move item to next week. Please try again.')

  const pushToPrevWeek = (item: ChecklistItem) =>
    moveItemToWeek(item, prevWeekStart(item.week_start), 'Could not move item to previous week. Please try again.')

  const isThisWeek = formatWeekStart(getMonday(new Date())) === weekStartStr
  const doneCount = items.filter(i => i.is_done).length

  // Three-tier sort (derived, does not mutate state) so it stays live on toggle:
  //   Tier 0 — open + priority: by delivery_date asc (nulls last), then created_at asc
  //   Tier 1 — open, not priority: created_at asc
  //   Tier 2 — done (any priority): created_at asc
  const tierOf = (i: ChecklistItem) => (i.is_done ? 2 : i.is_priority ? 0 : 1)
  const sortedItems = [...items].sort((a, b) => {
    const ta = tierOf(a)
    const tb = tierOf(b)
    if (ta !== tb) return ta - tb
    // Within tier 0, order by delivery_date ascending with no-date items last.
    if (ta === 0 && a.delivery_date !== b.delivery_date) {
      if (!a.delivery_date) return 1
      if (!b.delivery_date) return -1
      return a.delivery_date.localeCompare(b.delivery_date)
    }
    return a.created_at.localeCompare(b.created_at)
  })

  return (
    <div className="font-fira">
      <PageHeader title="Weekly Checklist" subtitle="Monday meeting to-do list" />

      <div className="max-w-5xl mx-auto">
      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigateWeek(-1)}
          className="p-2 hover:bg-gray-100 transition-colors text-fe-blue-gray hover:text-fe-navy"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="text-center">
          <h2 className="font-barlow font-bold text-lg text-fe-navy">
            Week of {formatWeekLabel(weekStart)}
          </h2>
          {!isThisWeek && (
            <button
              onClick={goToThisWeek}
              className="text-xs font-fira text-fe-blue hover:underline mt-0.5"
            >
              Back to this week
            </button>
          )}
        </div>

        <button
          onClick={() => navigateWeek(1)}
          className="p-2 hover:bg-gray-100 transition-colors text-fe-blue-gray hover:text-fe-navy"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 px-4 py-3 bg-red-50 border border-red-100">
          <span className="text-sm font-fira text-red-600">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600 transition-colors shrink-0"
            title="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Checklist */}
      <div className="bg-white border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-sm font-fira text-fe-blue-gray">Loading...</div>
        ) : (
          <>
            {items.length > 0 && (
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-fira font-bold text-fe-blue-gray uppercase tracking-wide">
                  {items.length} item{items.length !== 1 ? 's' : ''}
                </span>
                <span className="text-xs font-fira text-fe-blue-gray">
                  {doneCount}/{items.length} done
                </span>
              </div>
            )}

            {items.length === 0 && (
              <div className="text-center py-12">
                <p className="text-sm font-fira text-fe-blue-gray mb-1">No items for this week yet.</p>
                <p className="text-xs font-fira text-gray-400">Add your first checklist item below.</p>
              </div>
            )}

            <div>
              {sortedItems.map(item => {
                // Resolve ids against the live team list so a deleted member's stale id just doesn't render.
                const assignees = item.assigned_to_ids
                  .map(id => teamMap.get(id))
                  .filter((m): m is TeamMember => Boolean(m))
                const toggleAssignee = (memberId: string) => {
                  const next = item.assigned_to_ids.includes(memberId)
                    ? item.assigned_to_ids.filter(id => id !== memberId)
                    : [...item.assigned_to_ids, memberId]
                  updateItem(item.id, { assigned_to_ids: next })
                }
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0 group transition-colors ${
                      item.is_done ? 'bg-gray-50/50' : 'hover:bg-gray-50/30'
                    }`}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => updateItem(item.id, { is_done: !item.is_done })}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        item.is_done
                          ? 'bg-fe-green border-fe-green'
                          : 'border-gray-300 hover:border-fe-green'
                      }`}
                    >
                      {item.is_done && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>

                    {/* Priority star — filled+always-visible when flagged, outline-on-hover otherwise */}
                    <button
                      onClick={() => updateItem(item.id, { is_priority: !item.is_priority })}
                      className={`shrink-0 p-0.5 rounded transition-all ${
                        item.is_priority
                          ? 'text-fe-gold'
                          : 'text-gray-300 hover:text-fe-gold opacity-0 group-hover:opacity-100'
                      }`}
                      title={item.is_priority ? 'Remove priority' : 'Mark as priority'}
                    >
                      <svg
                        className="w-4 h-4"
                        fill={item.is_priority ? 'currentColor' : 'none'}
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </button>

                    {/* Description */}
                    <input
                      type="text"
                      value={item.description}
                      onChange={e => updateItem(item.id, { description: e.target.value })}
                      placeholder="What needs to be done?"
                      className={`flex-1 bg-transparent text-sm font-fira focus:outline-none placeholder:text-gray-300 ${
                        item.is_done ? 'line-through text-gray-400' : 'text-fe-anthracite'
                      }`}
                    />

                    {/* Delivery date — quiet when empty, clears to null */}
                    <input
                      type="date"
                      value={item.delivery_date || ''}
                      onChange={e => updateItem(item.id, { delivery_date: e.target.value || null })}
                      title="Delivery date"
                      className={`shrink-0 text-xs font-fira bg-transparent border-0 focus:outline-none focus:ring-0 cursor-pointer ${
                        item.delivery_date
                          ? 'text-fe-blue-gray'
                          : 'text-gray-300 opacity-50 hover:opacity-100 focus:opacity-100'
                      }`}
                    />

                    {/* Assignees — collapsed avatar cell; click opens a picker popover */}
                    <div className="relative shrink-0">
                      <button
                        data-assignee-trigger
                        onClick={e => {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                          setPickerPos({ top: rect.bottom + 4, left: rect.right })
                          setOpenPicker(prev => (prev === item.id ? null : item.id))
                        }}
                        className="flex items-center gap-1 px-1.5 py-1 hover:bg-gray-100 transition-colors"
                        title="Edit assignees"
                      >
                        {assignees.length === 0 ? (
                          <span className="text-xs font-fira text-fe-blue-gray">+ Assign</span>
                        ) : (
                          <div className="flex items-center">
                            {assignees.map((m, idx) => (
                              <div
                                key={m.id}
                                className={`rounded-full ring-2 ring-white ${idx > 0 ? '-ml-2' : ''}`}
                              >
                                <Avatar initials={m.initials} color={m.color} size="sm" title={m.name} />
                              </div>
                            ))}
                          </div>
                        )}
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {openPicker === item.id && pickerPos && (
                        <div
                          data-assignee-popover
                          style={{ position: 'fixed', top: pickerPos.top, left: pickerPos.left, transform: 'translateX(-100%)' }}
                          className="z-50 w-56 max-h-72 overflow-y-auto bg-white border border-gray-200 shadow-lg py-1"
                        >
                          {team.map(m => {
                            const selected = item.assigned_to_ids.includes(m.id)
                            return (
                              <button
                                key={m.id}
                                onClick={() => toggleAssignee(m.id)}
                                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                                  selected ? 'bg-fe-blue/10' : 'hover:bg-gray-50'
                                }`}
                              >
                                <Avatar initials={m.initials} color={m.color} size="sm" title={m.name} />
                                <span className="flex-1 text-sm font-fira text-fe-anthracite">{m.name}</span>
                                {selected && (
                                  <svg className="w-4 h-4 text-fe-blue shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Move week — back / forward (only for incomplete items) */}
                    {!item.is_done && (
                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-all shrink-0">
                        <button
                          onClick={() => pushToPrevWeek(item)}
                          className="p-1 rounded text-fe-blue-gray hover:text-fe-blue hover:bg-fe-blue/10 transition-colors"
                          title="Move to previous week"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => pushToNextWeek(item)}
                          className="p-1 rounded text-fe-blue-gray hover:text-fe-blue hover:bg-fe-blue/10 transition-colors"
                          title="Move to next week"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    )}

                    {/* Delete */}
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all shrink-0"
                      title="Delete"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Add Item Button */}
            <div className="px-4 py-3 border-t border-gray-100">
              <button
                onClick={addItem}
                disabled={adding}
                className="flex items-center gap-2 text-sm font-fira font-bold text-fe-blue hover:text-fe-blue/80 transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {adding ? 'Adding...' : 'Add Item'}
              </button>
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  )
}
