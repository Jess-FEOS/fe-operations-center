'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Avatar from '@/components/Avatar'

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
  assigned_to: string | null
  is_done: boolean
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

export default function WeeklyChecklistPage() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
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

  const isThisWeek = formatWeekStart(getMonday(new Date())) === weekStartStr
  const doneCount = items.filter(i => i.is_done).length

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-barlow font-extrabold text-3xl text-fe-navy">
          Weekly Checklist
        </h1>
        <p className="text-sm font-fira text-fe-blue-gray mt-1">
          Monday meeting to-do list
        </p>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigateWeek(-1)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-fe-blue-gray hover:text-fe-navy"
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
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-fe-blue-gray hover:text-fe-navy"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Checklist */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
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
              {items.map(item => {
                const assignee = item.assigned_to ? teamMap.get(item.assigned_to) : null
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

                    {/* Assigned Person */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {assignee && (
                        <Avatar initials={assignee.initials} color={assignee.color} size="sm" />
                      )}
                      <select
                        value={item.assigned_to || ''}
                        onChange={e => updateItem(item.id, { assigned_to: e.target.value || null })}
                        className="text-xs font-fira bg-transparent border-0 text-fe-blue-gray focus:outline-none focus:ring-0 cursor-pointer pr-5 max-w-[110px]"
                      >
                        <option value="">Unassigned</option>
                        {team.map(m => (
                          <option key={m.id} value={m.id}>{m.name.split(' ')[0]}</option>
                        ))}
                      </select>
                    </div>

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
  )
}
