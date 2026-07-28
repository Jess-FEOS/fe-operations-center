'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

// ------------------------------------------------------------------
// Master calendar — three toggleable layers on one month grid:
//   • Projects  — auto-derived from task due dates, one chip per project/day
//   • Seminars  — added directly on the calendar (date, time, client, location)
//   • Marketing — displayed from marketing_content; links to the Marketing page
// A single unified feed (/api/calendar) supplies all three.
// ------------------------------------------------------------------

type Layer = 'project' | 'seminar' | 'marketing'

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
  asset_link: string | null
}
type CalendarEvent = ProjectEvent | SeminarEvent | MarketingEvent

const LAYERS: { key: Layer; label: string; color: string }[] = [
  { key: 'project', label: 'Projects', color: '#0762C8' },
  { key: 'seminar', label: 'Seminars', color: '#B29838' },
  { key: 'marketing', label: 'Marketing', color: '#437F94' },
]
const LAYER_COLOR: Record<Layer, string> = {
  project: '#0762C8',
  seminar: '#B29838',
  marketing: '#437F94',
}

const MKT_STATUS_COLOR: Record<string, string> = {
  idea: '#9CA3AF',
  drafted: '#0762C8',
  scheduled: '#B29838',
  posted: '#046A38',
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function toDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getMonthRange(year: number, month: number) {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  let startDay = first.getDay()
  if (startDay === 0) startDay = 7
  const calStart = new Date(first)
  calStart.setDate(first.getDate() - (startDay - 1))
  let endDay = last.getDay()
  if (endDay === 0) endDay = 7
  const calEnd = new Date(last)
  calEnd.setDate(last.getDate() + (7 - endDay))
  return { calStart, calEnd, first, last }
}

function fmtTime(t: string | null) {
  if (!t) return ''
  const [h, m] = t.split(':')
  let hour = parseInt(h, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  hour = hour % 12 || 12
  return `${hour}:${m} ${ampm}`
}

const EMPTY_FORM = {
  id: '',
  title: '',
  seminar_date: '',
  start_time: '',
  client_name: '',
  location: '',
  notes: '',
}

export default function CalendarPage() {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [month, setMonth] = useState(() => new Date().getMonth())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [activeLayers, setActiveLayers] = useState<Set<Layer>>(
    () => new Set<Layer>(['project', 'seminar', 'marketing'])
  )

  // Seminar day form
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  const { calStart, calEnd, first } = getMonthRange(year, month)

  const load = useCallback(() => {
    setLoading(true)
    const from = toDateStr(calStart)
    const to = toDateStr(calEnd)
    fetch(`/api/calendar?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((d) => setEvents(Array.isArray(d?.events) ? d.events : []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month])

  useEffect(() => {
    load()
  }, [load])

  const toggleLayer = (key: Layer) => {
    setActiveLayers((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Bucket events by date, filtered to active layers.
  const byDate = new Map<string, CalendarEvent[]>()
  for (const e of events) {
    if (!activeLayers.has(e.type)) continue
    if (!byDate.has(e.date)) byDate.set(e.date, [])
    byDate.get(e.date)!.push(e)
  }

  // Build weeks
  const weeks: Date[][] = []
  const cursor = new Date(calStart)
  while (cursor <= calEnd) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
  }

  const todayStr = toDateStr(new Date())
  const monthLabel = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const prevMonth = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11) }
    else setMonth((m) => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0) }
    else setMonth((m) => m + 1)
  }
  const goToday = () => {
    const now = new Date()
    setYear(now.getFullYear())
    setMonth(now.getMonth())
  }

  // --- Seminar form handlers
  const openNew = (dateStr: string) => {
    setForm({ ...EMPTY_FORM, seminar_date: dateStr })
    setFormOpen(true)
  }
  const openEdit = (s: SeminarEvent) => {
    setForm({
      id: s.id,
      title: s.title || '',
      seminar_date: s.date,
      start_time: s.start_time || '',
      client_name: s.client_name || '',
      location: s.location || '',
      notes: s.notes || '',
    })
    setFormOpen(true)
  }
  const closeForm = () => { setFormOpen(false); setSaving(false) }

  const saveSeminar = async () => {
    if (!form.seminar_date) return
    setSaving(true)
    const method = form.id ? 'PATCH' : 'POST'
    const res = await fetch('/api/seminars', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).catch(() => null)
    setSaving(false)
    if (res && res.ok) { closeForm(); load() }
  }
  const deleteSeminar = async () => {
    if (!form.id) return
    setSaving(true)
    const res = await fetch(`/api/seminars?id=${form.id}`, { method: 'DELETE' }).catch(() => null)
    setSaving(false)
    if (res && res.ok) { closeForm(); load() }
  }

  return (
    <div className="font-fira">
      <PageHeader
        title="Master Calendar"
        subtitle="Projects, seminars, and marketing on one surface"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              className="p-2 border border-fe-line bg-white hover:bg-gray-50 transition-colors"
              data-testid="button-prev-month"
              aria-label="Previous month"
            >
              <svg className="w-4 h-4 text-fe-anthracite" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={goToday}
              className="px-3 py-1.5 border border-fe-line bg-white hover:bg-gray-50 text-sm font-fira text-fe-anthracite transition-colors"
              data-testid="button-today"
            >
              Today
            </button>
            <span className="font-barlow font-bold text-lg text-fe-navy min-w-[180px] text-center" data-testid="text-month">
              {monthLabel}
            </span>
            <button
              onClick={nextMonth}
              className="p-2 border border-fe-line bg-white hover:bg-gray-50 transition-colors"
              data-testid="button-next-month"
              aria-label="Next month"
            >
              <svg className="w-4 h-4 text-fe-anthracite" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        }
      />

      {/* Layer toggles */}
      <div className="flex items-center gap-2 mb-4 flex-wrap no-print">
        <span className="text-xs text-fe-blue-gray font-fira mr-1 uppercase tracking-wider">Layers</span>
        {LAYERS.map((l) => {
          const on = activeLayers.has(l.key)
          return (
            <button
              key={l.key}
              onClick={() => toggleLayer(l.key)}
              data-testid={`toggle-layer-${l.key}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 border border-fe-line bg-white text-xs font-fira text-fe-anthracite transition-all ${
                on ? 'ring-2 ring-fe-blue ring-offset-1' : 'opacity-45 hover:opacity-80'
              }`}
            >
              <span
                className="w-2.5 h-2.5 shrink-0"
                style={{ backgroundColor: on ? l.color : '#cbd5e1' }}
              />
              {l.label}
            </button>
          )
        })}
        <span className="text-xs text-fe-blue-gray font-fira ml-2">Click any day to add a seminar</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-fe-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white border border-fe-line overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-fe-line">
            {DAYS.map((day) => (
              <div key={day} className="px-2 py-2.5 text-center text-xs font-fira font-bold text-fe-blue-gray bg-fe-offwhite">
                {day}
              </div>
            ))}
          </div>

          {/* Weeks */}
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-fe-line last:border-b-0">
              {week.map((day, di) => {
                const dateStr = toDateStr(day)
                const isCurrentMonth = day.getMonth() === month
                const isToday = dateStr === todayStr
                const dayEvents = byDate.get(dateStr) || []

                return (
                  <div
                    key={di}
                    onClick={() => openNew(dateStr)}
                    data-testid={`day-${dateStr}`}
                    className={`group min-h-[132px] border-r border-fe-line last:border-r-0 p-2 cursor-pointer transition-colors ${
                      isCurrentMonth ? 'bg-white hover:bg-fe-offwhite' : 'bg-fe-offwhite'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className={`text-xs font-fira ${
                        isToday
                          ? 'w-6 h-6 rounded-full bg-fe-blue text-white flex items-center justify-center font-bold'
                          : isCurrentMonth ? 'text-fe-anthracite font-medium' : 'text-gray-300'
                      }`}>
                        {day.getDate()}
                      </div>
                      <span className="opacity-0 group-hover:opacity-100 text-fe-blue-gray text-base leading-none transition-opacity" aria-hidden>+</span>
                    </div>

                    <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                      {dayEvents.map((ev, idx) => {
                        if (ev.type === 'project') {
                          const c = LAYER_COLOR.project
                          return (
                            <Link
                              key={`p-${ev.project_id}-${idx}`}
                              href={`/projects/${ev.project_id}`}
                              className="block px-2 py-1 text-xs font-fira truncate hover:opacity-80 transition-opacity"
                              style={{ backgroundColor: `${c}12`, color: c, borderLeft: `3px solid ${c}` }}
                              title={ev.task_titles.map((t) => `• ${t}`).join('\n')}
                              data-testid={`event-project-${ev.project_id}`}
                            >
                              <span className="truncate">{ev.project_name}</span>
                              <span
                                className="ml-1 inline-flex items-center justify-center px-1 min-w-[16px] h-4 rounded-full text-white font-bold leading-none"
                                style={{ backgroundColor: c, fontSize: '10px' }}
                              >
                                {ev.task_count}
                              </span>
                            </Link>
                          )
                        }
                        if (ev.type === 'seminar') {
                          const c = LAYER_COLOR.seminar
                          const label = ev.client_name || ev.title || 'Seminar'
                          return (
                            <button
                              key={`s-${ev.id}`}
                              onClick={() => openEdit(ev)}
                              className="w-full text-left px-2 py-1 text-xs font-fira truncate hover:opacity-80 transition-opacity"
                              style={{ backgroundColor: `${c}18`, color: '#7a6626', borderLeft: `3px solid ${c}` }}
                              title={[ev.title, ev.client_name, ev.location, fmtTime(ev.start_time)].filter(Boolean).join(' · ')}
                              data-testid={`event-seminar-${ev.id}`}
                            >
                              {ev.start_time && <span className="font-bold mr-1">{fmtTime(ev.start_time)}</span>}
                              <span className="truncate">{label}</span>
                            </button>
                          )
                        }
                        // marketing
                        const c = LAYER_COLOR.marketing
                        const sc = MKT_STATUS_COLOR[ev.status] || '#9CA3AF'
                        return (
                          <Link
                            key={`m-${ev.id}`}
                            href="/marketing"
                            className="flex items-center gap-1 px-2 py-1 text-xs font-fira truncate hover:opacity-80 transition-opacity"
                            style={{ backgroundColor: `${c}14`, color: '#2f5866', borderLeft: `3px solid ${c}` }}
                            title={`${ev.title} — ${ev.status}${ev.channels.length ? ' · ' + ev.channels.join(', ') : ''}`}
                            data-testid={`event-marketing-${ev.id}`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: sc }} />
                            <span className="truncate">{ev.title}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* Legend footnote */}
      <div className="mt-3 flex items-center gap-4 text-xs font-fira text-fe-blue-gray no-print flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5" style={{ backgroundColor: LAYER_COLOR.project }} /> Projects (task due dates)</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5" style={{ backgroundColor: LAYER_COLOR.seminar }} /> Seminars (click a day to add)</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5" style={{ backgroundColor: LAYER_COLOR.marketing }} /> Marketing (opens Marketing page)</span>
      </div>

      {/* Seminar add/edit modal */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 no-print"
          onClick={closeForm}
        >
          <div
            className="bg-white border border-fe-line w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
            data-testid="modal-seminar"
          >
            <div className="fe-panel-header flex items-center justify-between px-5 py-3.5 border-b border-fe-line">
              <h2 className="font-barlow font-bold text-lg text-fe-navy">
                {form.id ? 'Edit seminar' : 'Add seminar'}
              </h2>
              <button onClick={closeForm} className="text-fe-blue-gray hover:text-fe-navy" aria-label="Close" data-testid="button-close-modal">✕</button>
            </div>

            <div className="p-5 space-y-3">
              <Field label="Client name">
                <input
                  className="fe-input"
                  value={form.client_name}
                  onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                  placeholder="e.g. Point72 Academy"
                  data-testid="input-client"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date">
                  <input
                    type="date"
                    className="fe-input"
                    value={form.seminar_date}
                    onChange={(e) => setForm({ ...form, seminar_date: e.target.value })}
                    data-testid="input-date"
                  />
                </Field>
                <Field label="Time">
                  <input
                    type="time"
                    className="fe-input"
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                    data-testid="input-time"
                  />
                </Field>
              </div>
              <Field label="Location">
                <input
                  className="fe-input"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="City, ST or Virtual"
                  data-testid="input-location"
                />
              </Field>
              <Field label="Title (optional)">
                <input
                  className="fe-input"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Valuation Deep Dive"
                  data-testid="input-title"
                />
              </Field>
              <Field label="Notes (optional)">
                <textarea
                  className="fe-input min-h-[64px] resize-y"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  data-testid="input-notes"
                />
              </Field>
            </div>

            <div className="flex items-center justify-between px-5 py-3.5 border-t border-fe-line">
              {form.id ? (
                <button
                  onClick={deleteSeminar}
                  disabled={saving}
                  className="text-xs font-fira text-fe-red hover:underline disabled:opacity-50"
                  data-testid="button-delete-seminar"
                >
                  Delete
                </button>
              ) : <span />}
              <div className="flex items-center gap-2">
                <button
                  onClick={closeForm}
                  className="px-3 py-1.5 border border-fe-line bg-white hover:bg-gray-50 text-sm font-fira text-fe-anthracite"
                  data-testid="button-cancel-seminar"
                >
                  Cancel
                </button>
                <button
                  onClick={saveSeminar}
                  disabled={saving || !form.seminar_date}
                  className="px-4 py-1.5 bg-fe-blue text-white text-sm font-fira font-bold hover:opacity-90 disabled:opacity-50"
                  data-testid="button-save-seminar"
                >
                  {saving ? 'Saving…' : form.id ? 'Save' : 'Add seminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-fira text-fe-blue-gray uppercase tracking-wider mb-1">{label}</span>
      {children}
    </label>
  )
}
