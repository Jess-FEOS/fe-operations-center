'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { calendarHref } from '@/lib/calendar'
import { marketingRequest } from '@/lib/marketing'
import type { CompanyCommitment } from '@/lib/company-calendar'
import type { CalendarViewProps } from './CalendarWorkspace'

// ------------------------------------------------------------------
// Company commitments only; Marketing owns asset scheduling in its own view.
// ------------------------------------------------------------------

type Layer = 'milestone' | 'seminar' | 'enterprise'
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
type CalendarEvent = SeminarEvent | (CompanyCommitment & {owner_names:string[]})

const LAYERS: { key: Layer; label: string; color: string }[] = [
  { key: 'milestone', label: 'Launches & starts', color: '#0762C8' },
  { key: 'seminar', label: 'Seminars', color: '#B29838' },
  { key: 'enterprise', label: 'Enterprise delivery', color: '#437F94' },
]
const LAYER_COLOR: Record<Layer, string> = {
  milestone: '#0762C8',
  seminar: '#B29838',
  enterprise: '#437F94',
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

export default function CompanyCalendar({ anchor, onAnchorChange, projectId, ownerId, navigating }: CalendarViewProps) {
  const year = anchor.getFullYear()
  const month = anchor.getMonth()
  const params = useSearchParams()
  const router = useRouter()
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const requestId = useRef(0)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [activeLayers, setActiveLayers] = useState<Set<Layer>>(
    () => new Set<Layer>(['milestone', 'seminar', 'enterprise'])
  )

  // Seminar day form
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  const { calStart, calEnd, first } = getMonthRange(year, month)

  const load = useCallback(() => {
    const id = ++requestId.current
    setLoading(true)
    setError('')
    const query = new URLSearchParams({ from: toDateStr(calStart), to: toDateStr(calEnd) })
    if (projectId) query.set('project_id', projectId)
    if (ownerId) query.set('owner_id', ownerId)
    return marketingRequest<{ events: CalendarEvent[] }>(`/api/calendar/company?${query}`)
      .then(d => { if (id === requestId.current) setEvents(d.events) })
      .catch(e => { if (id === requestId.current) setError(e.message || 'Could not load the calendar.') })
      .finally(() => { if (id === requestId.current) setLoading(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, projectId, ownerId])

  useEffect(() => {
    load()
    return () => { requestId.current++ }
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
    onAnchorChange(new Date(year, month - 1, 1, 12))
  }
  const nextMonth = () => {
    onAnchorChange(new Date(year, month + 1, 1, 12))
  }
  const goToday = () => {
    onAnchorChange(new Date())
  }

  // --- Seminar form handlers
  const openNew = (dateStr: string) => {
    setFormError('')
    setForm({ ...EMPTY_FORM, seminar_date: dateStr })
    setFormOpen(true)
  }
  const openEdit = (s: SeminarEvent) => {
    setFormError('')
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
    setFormError('')
    const method = form.id ? 'PATCH' : 'POST'
    const res = await fetch('/api/seminars', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).catch(() => null)
    setSaving(false)
    if (res && res.ok) {
      closeForm()
      if (projectId || ownerId) router.replace(calendarHref(new URLSearchParams(params), { program: null, owner: null }), { scroll: false })
      else load()
    }
    else setFormError('Could not save the seminar. No changes were confirmed; please retry.')
  }
  const deleteSeminar = async () => {
    if (!form.id || !confirm('Delete this seminar?')) return
    setSaving(true)
    const res = await fetch(`/api/seminars?id=${form.id}`, { method: 'DELETE' }).catch(() => null)
    setSaving(false)
    if (res && res.ok) { closeForm(); load() }
    else setFormError('Could not delete the seminar. Please retry.')
  }

  return (
    <div className="font-fira">
          <div className="flex items-center gap-2 flex-wrap mb-5">
            <button
              onClick={prevMonth}
              disabled={navigating}
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
              disabled={navigating}
              className="px-3 py-1.5 border border-fe-line bg-white hover:bg-gray-50 text-sm font-fira text-fe-anthracite transition-colors"
              data-testid="button-today"
            >
              Today
            </button>
            <span className="font-barlow font-bold text-base sm:text-lg text-fe-navy px-2 text-center" data-testid="text-month">
              {monthLabel}
            </span>
            <button
              onClick={nextMonth}
              disabled={navigating}
              className="p-2 border border-fe-line bg-white hover:bg-gray-50 transition-colors"
              data-testid="button-next-month"
              aria-label="Next month"
            >
              <svg className="w-4 h-4 text-fe-anthracite" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

      {/* Layer toggles */}
      <div className="flex items-center gap-2 mb-4 flex-wrap no-print">
        <span className="text-xs text-fe-blue-gray font-fira mr-1 uppercase tracking-wider">Layers</span>
        {LAYERS.map((l) => {
          const on = activeLayers.has(l.key)
          return (
            <button
              key={l.key}
              onClick={() => toggleLayer(l.key)}
              aria-pressed={on}
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
        <span className="text-xs text-fe-blue-gray font-fira ml-2">Click a day to add a seminar</span>
      </div>
      <p className="text-sm text-fe-blue-gray mb-3">Company commitments, not the task list. Manage client deliverables and sessions in Projects; email and social assets stay in Marketing.</p>
      {(projectId || ownerId) && <p className="text-xs text-fe-blue-gray mb-3">
        {ownerId ? 'Owner filters show their client commitments and engagement milestones. Seminars and milestones without a named engagement owner are hidden.' : 'Seminars are company-wide and hidden while a project filter is selected.'}
      </p>}
      <p className="sm:hidden text-xs text-fe-blue-gray mb-2">Scroll the calendar sideways to see the full week.</p>

      {error ? <div role="alert" className="border border-fe-red p-4 text-fe-red">{error} <button onClick={load} className="underline">Retry</button></div> : loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-fe-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto"><div className="bg-white border border-fe-line min-w-[700px]" data-testid="company-month-grid">
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
                      <button type="button" onClick={e => { e.stopPropagation(); openNew(dateStr) }} aria-label={`Add seminar on ${dateStr}`} className="text-fe-blue p-1">+</button>
                    </div>

                    <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                      {dayEvents.map((ev, idx) => {
                        if (ev.type === 'milestone') return <Link key={ev.id} href={`/projects/${ev.project_id}`} className="block border-l-[3px] border-fe-blue bg-blue-50 px-2 py-1 text-xs font-bold text-fe-navy break-words" data-testid="company-milestone">{ev.label}</Link>
                        if (ev.type === 'enterprise') return <Link key={ev.id} href={`/projects/${ev.project_id}?task=${ev.id}`}
                          className="block border-l-[3px] border-[#437F94] bg-[#edf4f6] px-2 py-1.5 text-xs text-fe-navy break-words hover:bg-blue-50"
                          data-testid={`event-enterprise-${ev.id}`}>
                          <span className="block uppercase tracking-wide text-[10px] font-bold">{ev.kind === 'session' ? 'Client session' : 'Client deliverable'}{ev.status === 'blocked' ? ' · Blocked' : ''}</span>
                          <span className="block font-bold mt-0.5">{ev.label}</span>
                          <span className="block mt-0.5">{ev.project_name}</span>
                          <span className="block mt-0.5">{ev.owner_names.join(', ') || 'Owner needed'}</span>
                        </Link>
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
                        return null
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div></div>
      )}

      {/* Legend footnote */}
      <div className="mt-3 flex items-center gap-4 text-xs font-fira text-fe-blue-gray no-print flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5" style={{ backgroundColor: LAYER_COLOR.milestone }} /> Project launches, starts and client kickoffs</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5" style={{ backgroundColor: LAYER_COLOR.seminar }} /> Seminars (click a day to add)</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5" style={{ backgroundColor: LAYER_COLOR.enterprise }} /> Selected client commitments (opens the original task)</span>
      </div>

      {/* Seminar add/edit modal */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 no-print"
          onClick={closeForm}
        >
          <div
            role="dialog" aria-modal="true" aria-label={form.id ? 'Edit seminar' : 'Add seminar'}
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
              {formError && <p role="alert" className="text-sm text-fe-red">{formError}</p>}
              {(projectId || ownerId) && <p className="text-xs text-fe-blue-gray">Seminars are company-wide, not tied to a program or owner. Saving clears those filters so the seminar is visible.</p>}
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
