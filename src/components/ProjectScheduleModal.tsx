'use client'

import { useEffect, useRef, useState } from 'react'
import { ScheduleDates, ScheduleRow, ScheduleAnchor, scheduledDate } from '@/lib/project-schedule'

interface Props {
  projectId: string
  patch: Record<string, unknown>
  onClose: () => void
  onSaved: (result: any) => void
}
const dateLabel = (value: string | null) => value
  ? new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : 'No date'

export default function ProjectScheduleModal({ projectId, patch, onClose, onSaved }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [rows, setRows] = useState<ScheduleRow[]>([])
  const [dates, setDates] = useState<ScheduleDates | null>(null)
  const [revision, setRevision] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [approved, setApproved] = useState(false)
  useEffect(() => {
    dialog.current?.showModal()
    let active = true
    fetch(`/api/projects/${projectId}/schedule`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patch }),
    }).then(async res => {
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not preview schedule.')
      if (active) { setRows(data.rows); setDates(data.dates); setRevision(data.revision) }
    }).catch(err => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [projectId, patch])

  const editRule = (id: string, values: Partial<ScheduleRow>) => {
    setApproved(false)
    setRows(current => current.map(row => {
      if (row.id !== id) return row
      const next = { ...row, ...values }
      return { ...next, suggested: false, new_date: scheduledDate(next, dates!, next.old_date),
        note: next.anchor === 'fixed' ? 'Your reviewed rule: keep the current deadline.' : 'Your reviewed rule: calculate from the selected anchor.' }
    }))
  }
  const missing = rows.some(r => r.status !== 'done' && r.anchor !== 'fixed' && !r.new_date)
  const changed = rows.filter(r => r.old_date !== r.new_date).length
  const save = async () => {
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/projects/${projectId}/schedule`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patch, revision, rules: rows.map(({ id, anchor, offset_days }) => ({ id, anchor, offset_days })) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save schedule.')
      onSaved(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save schedule.')
    } finally { setSaving(false) }
  }
  return (
    <dialog ref={dialog} aria-labelledby="schedule-title"
      onCancel={event => { event.preventDefault(); if (!saving) onClose() }}
      className="w-[calc(100%-2rem)] max-w-6xl max-h-[90vh] overflow-y-auto p-0 border border-gray-200 backdrop:bg-black/40 text-fe-anthracite font-fira">
      <div className="p-5 sm:p-6">
        <div className="flex justify-between items-start gap-3">
          <div>
            <h2 id="schedule-title" className="font-barlow text-2xl font-bold text-fe-navy">Review project schedule</h2>
            <p className="text-sm text-fe-blue-gray mt-2">Preview only. Nothing changes until you confirm and save.</p>
          </div>
          <button autoFocus disabled={saving} onClick={onClose} className="text-sm border border-gray-200 px-3 py-2">Cancel</button>
        </div>
        {loading && <p role="status" className="py-8">Loading current tasks…</p>}
        {error && <p role="alert" className="my-4 bg-red-50 border border-red-200 p-3 text-sm text-red-800">{error}</p>}
        {dates && <>
          <div className="grid sm:grid-cols-3 gap-3 my-5 bg-gray-50 p-4 text-sm">
            <p>Marketing launch<br /><strong>{dateLabel(dates.launch_date)}</strong></p>
            <p>Program start<br /><strong>{dateLabel(dates.start_date)}</strong></p>
            <p>Task deadlines changing<br /><strong>{changed} of {rows.length}</strong></p>
          </div>
          <div className="border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed mb-4">
            <p>Suggested rules need review. Negative days mean before the anchor; positive days mean after. Fixed dates and completed tasks do not move.</p>
            <p className="mt-2">Enrollment reminders retain their existing offsets. Wrap-up retains its existing timing from program start, not course end. Adjust these if your course duration or enrollment cutoff differs.</p>
            <p className="mt-2">Project-backed task views update together. Existing marketing post dates, Strategy date overrides, and separately assigned vendor deadlines are not moved.</p>
          </div>
          <div className="space-y-3">
            {rows.map(row => (
              <div key={row.id} className="border border-gray-200 p-3 grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 items-center">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-fe-navy">{row.task_name}</p>
                  <p className="text-xs text-fe-blue-gray mt-1">{row.phase} · {row.status === 'done' ? 'Completed' : row.suggested ? 'Suggested rule' : 'Date rule'}</p>
                </div>
                <div className="flex gap-2 min-w-0">
                  <select aria-label={`Date anchor for ${row.task_name}`} disabled={saving || row.status === 'done'}
                    value={row.anchor} onChange={e => editRule(row.id, { anchor: e.target.value as ScheduleAnchor, offset_days: e.target.value === 'fixed' ? null : row.offset_days ?? 0 })}
                    className="min-w-0 flex-1 border border-gray-200 px-2 py-2 text-sm bg-white">
                    <option value="launch">Marketing launch</option><option value="start">Program start</option><option value="fixed">Fixed date</option>
                  </select>
                  {row.anchor !== 'fixed' && <input type="number" min="-3650" max="3650" step="1"
                    aria-label={`Day offset for ${row.task_name}`} value={row.offset_days ?? 0} disabled={saving || row.status === 'done'}
                    onChange={e => { const n = Number(e.target.value); if (Number.isInteger(n) && Math.abs(n) <= 3650) editRule(row.id, { offset_days: n }) }}
                    className="w-20 border border-gray-200 px-2 py-2 text-sm" />}
                </div>
                <div className="text-sm">
                  <span className="text-fe-blue-gray">{dateLabel(row.old_date)}</span>
                  <span className="mx-2">→</span>
                  <span className={row.old_date !== row.new_date ? 'font-bold text-fe-navy' : ''}>{dateLabel(row.new_date)}</span>
                  <p className="text-xs text-fe-blue-gray mt-1">{row.note}</p>
                </div>
              </div>
            ))}
          </div>
          {missing && <p role="alert" className="text-sm text-red-700 mt-4">A required anchor date is missing. Cancel to enter it, or choose Fixed date for the affected tasks.</p>}
          <label className="flex items-start gap-2 text-sm mt-5">
            <input type="checkbox" disabled={saving} checked={approved} onChange={e => setApproved(e.target.checked)} className="mt-1" />
            I reviewed these rules and deadlines. Save project dates and task changes together.
          </label>
          <div className="flex justify-end gap-2 mt-4">
            <button disabled={saving} onClick={onClose} className="px-4 py-2 text-sm border border-gray-200">Back</button>
            <button disabled={!approved || saving || missing} onClick={save}
              className="px-4 py-2 text-sm bg-fe-navy text-white disabled:opacity-40">
              {saving ? 'Saving…' : 'Save reviewed schedule'}
            </button>
          </div>
        </>}
      </div>
    </dialog>
  )
}
