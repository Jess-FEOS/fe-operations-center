'use client'
import { useEffect, useState } from 'react'
import type { CreationInput } from '@/lib/project-creation-server'
import type { FoundationTask } from '@/lib/project-foundation'

interface Review {
  tasks: FoundationTask[]; issues: number; review_hash: string; can_save: boolean
  people: { id: string; name: string }[]
  source: { name: string }; project: { start_date: string; launch_date: string | null }
}
export default function ProjectCreationReview({ input, onCreated, onBack }: {
  input: CreationInput; onCreated: (p: { id: string }) => void; onBack: () => void
}) {
  const [review, setReview] = useState<Review | null>(null)
  const [owners, setOwners] = useState<Record<string,string>>({})
  const [dates, setDates] = useState<Record<string,string>>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [requestId] = useState(() => crypto.randomUUID())
  const [revision, setRevision] = useState(0)
  const [dirty, setDirty] = useState(false)
  const serialized = JSON.stringify(input)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    fetch('/api/projects/prepare', { method:'POST',headers:{'Content-Type':'application/json'},
      signal: controller.signal, body:JSON.stringify({...JSON.parse(serialized),owners,dates}) })
      .then(async r => { const body=await r.json(); if(!r.ok) throw new Error(body.error); return body })
      .then(data => { setReview(data); setDirty(false) })
      .catch(e => { if(e.name !== 'AbortError') {setError(e.message || 'Could not load review.');setReview(null)} })
      .finally(() => { if(!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
    // Owner/date edits are deliberately re-reviewed only when the user requests it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized, revision])
  async function save() {
    if (!review || dirty || review.issues || !review.can_save) return
    setSaving(true);setError('')
    try {
      const res=await fetch('/api/projects', { method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...input,owners,dates,review_hash:review.review_hash,request_id:requestId}) })
      const body=await res.json()
      if(!res.ok) throw new Error(body.error || 'Project was not created.')
      onCreated(body)
    } catch(e) { setError(e instanceof Error ? e.message : 'Project was not created.') }
    finally { setSaving(false) }
  }
  return <section aria-label="Review checklist and dates" className="space-y-4">
    <div>
      <h2 className="font-barlow font-bold text-xl text-fe-navy">Review checklist and dates</h2>
      <p className="text-sm text-fe-blue-gray mt-2">Existing work stays untouched. This creates fresh tasks, not copies of completion, comments, assets, or history.</p>
    </div>
    {error && <p role="alert" className="p-3 bg-red-50 text-red-800 text-sm">{error}</p>}
    {loading ? <p role="status">Preparing review…</p> : review && <>
      <div className="bg-slate-50 border border-slate-200 p-4 text-sm">
        <p className="font-bold">{input.name}</p>
        <p className="mt-1">Checklist: {review.source.name} · {review.tasks.length} tasks</p>
        <p className="mt-1">Marketing launch: {review.project.launch_date || 'Not set'} · Program start: {review.project.start_date}</p>
        <p className="mt-2">{review.issues ? `${review.issues} ${review.issues === 1 ? 'task needs' : 'tasks need'} an owner or date decision.` : 'Every task has one accountable owner and a deadline.'}</p>
        {!review.can_save && <p className="mt-2 font-bold text-fe-blue">Read-only preview: review changes here; nothing is saved to production.</p>}
      </div>
      <div className="space-y-2 max-h-[55vh] overflow-y-auto">
        {review.tasks.map(task => <div key={task.source_id} className={`p-3 border ${task.issues.length ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
          <p className="text-xs text-fe-blue-gray">{task.phase} · {task.schedule_anchor === 'fixed' ? 'Fixed deadline' : `${task.schedule_anchor === 'launch' ? 'Marketing launch' : 'Program start'} ${task.schedule_offset_days! >= 0 ? '+' : ''}${task.schedule_offset_days} days`}</p>
          <h3 className="text-sm font-bold mt-1">{task.task_name}</h3>
          <div className="grid sm:grid-cols-2 gap-3 mt-2">
            <label className="text-xs">Accountable owner
              <select aria-label={`Owner: ${task.task_name}`} className="block w-full mt-1 p-2 border bg-white text-sm"
                value={owners[task.source_id] ?? task.owner_ids[0] ?? ''}
                onChange={e=>{setOwners({...owners,[task.source_id]:e.target.value});setDirty(true)}}>
                <option value="" disabled>Choose owner</option>
                {review.people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="text-xs">Deadline {task.schedule_anchor !== 'fixed' && '(editing makes it fixed)'}
              <input type="date" aria-label={`Deadline: ${task.task_name}`} className="block w-full mt-1 p-2 border bg-white text-sm"
                value={dates[task.source_id] ?? task.due_date ?? ''}
                onChange={e=>{setDates({...dates,[task.source_id]:e.target.value});setDirty(true)}} />
            </label>
          </div>
          {task.issues.length>0 && <p className="text-xs text-amber-900 mt-2">{task.issues.join(' ')}</p>}
        </div>)}
      </div>
    </>}
    <div className="flex flex-wrap gap-3">
      <button onClick={onBack} disabled={saving} className="px-4 py-3 border text-sm">Back</button>
      <button onClick={()=>setRevision(v=>v+1)} disabled={loading || saving} className="px-4 py-3 border text-sm">Recheck changes</button>
      <button onClick={save} disabled={!review?.can_save || !!review?.issues || dirty || loading || saving}
        className="px-4 py-3 bg-fe-blue text-white text-sm font-bold disabled:opacity-40">
        {saving ? 'Creating…' : review?.can_save ? 'Create reviewed project' : 'Save unavailable in preview'}
      </button>
    </div>
    {dirty && <p role="status" className="text-sm text-amber-800">Recheck your changes before creating the project.</p>}
  </section>
}
