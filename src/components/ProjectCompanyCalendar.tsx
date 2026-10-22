'use client'
import { useState } from 'react'
import type { CompanyProject } from '@/lib/company-calendar'

export default function ProjectCompanyCalendar({ project, people, onSaved }: {
  project:CompanyProject; people:{id:string;name:string}[]; onSaved:(patch:Pick<CompanyProject,'is_enterprise'|'enterprise_client_label'|'enterprise_owner_id'>)=>void
}) {
  const [enterprise,setEnterprise] = useState(!!project.is_enterprise)
  const [label,setLabel] = useState(project.enterprise_client_label || '')
  const [owner,setOwner] = useState(project.enterprise_owner_id || '')
  const [saving,setSaving] = useState(false)
  const [error,setError] = useState('')
  const [saved,setSaved] = useState(false)
  const available = Object.prototype.hasOwnProperty.call(project,'is_enterprise')
  async function save() {
    setSaving(true); setError(''); setSaved(false)
    try {
      const res = await fetch(`/api/projects/${project.id}`, {method:'PATCH',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({is_enterprise:enterprise,enterprise_client_label:label.trim() || null,enterprise_owner_id:owner || null})})
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Settings were not saved.')
      onSaved({is_enterprise:data.is_enterprise,enterprise_client_label:data.enterprise_client_label,enterprise_owner_id:data.enterprise_owner_id}); setSaved(true)
    } catch(e) { setError(e instanceof Error ? e.message : 'Settings were not saved.') }
    finally { setSaving(false) }
  }
  return <details className="border border-fe-line bg-white mb-5" open={project.is_enterprise || undefined}>
    <summary className="cursor-pointer p-4 font-barlow font-bold text-fe-navy">
      Company calendar {project.is_enterprise ? '· Enterprise engagement' : '· Project settings'}
    </summary>
    <div className="px-4 pb-4 space-y-3 text-sm">
      <p className="text-fe-blue-gray">One project per engagement or workstream. Dates and selected commitments feed the Company view without duplicate entries.</p>
      {!available && <p role="status" className="bg-amber-50 border border-amber-200 p-3 text-amber-900">
        Enterprise settings need the proposed database update before they can be saved. Existing project dates and seminars still work.
      </p>}
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={enterprise} onChange={e=>{setEnterprise(e.target.checked);setSaved(false)}} />
        This is an enterprise client engagement
      </label>
      {enterprise && <div className="grid sm:grid-cols-2 gap-3">
        <label>Client display label
          <input className="fe-input mt-1" value={label} maxLength={160} onChange={e=>{setLabel(e.target.value);setSaved(false)}} placeholder="Approved client or engagement label" />
        </label>
        <label>Engagement owner
          <select className="fe-input mt-1" value={owner} onChange={e=>{setOwner(e.target.value);setSaved(false)}}>
            <option value="">Choose one owner</option>
            {people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </div>}
      <p className="text-fe-blue-gray">Program start{enterprise ? ' / client kickoff' : ''}: <strong>{project.start_date || 'Not set'}</strong>. Marketing launch: <strong>{project.launch_date || 'Not set'}</strong>. Change these through the existing project date review.</p>
      {enterprise && <p className="text-fe-blue-gray">After saving, edit a task and choose “Client deliverable” or “Client session” under Company calendar. Ordinary tasks stay off the calendar; completed tasks disappear from upcoming commitments.</p>}
      <p className="text-xs text-amber-900">This app has open access. Use approved display labels; do not add contracts, pricing, private client details or raw emails.</p>
      {error && <p role="alert" className="text-fe-red">{error}</p>}
      {saved && <p role="status" className="text-green-800">Company calendar settings saved.</p>}
      <button onClick={save} disabled={!available || saving || (enterprise && (!owner || !label.trim()))}
        className="px-4 py-2 bg-fe-blue text-white font-bold disabled:opacity-40">
        {saving ? 'Saving…' : 'Save calendar settings'}
      </button>
    </div>
  </details>
}
