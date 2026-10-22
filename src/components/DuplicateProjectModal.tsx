'use client'
import { useState } from 'react'
import ProjectCreationReview from './ProjectCreationReview'
export default function DuplicateProjectModal({ sourceId, sourceName, onClose, onCreated }: {
  sourceId: string; sourceName: string; workflowType?: string; workflowTemplateId?: string
  onClose: () => void; onCreated: (p: { id: string }) => void
}) {
  const [name,setName]=useState(`${sourceName} (Copy)`)
  const [startDate,setStartDate]=useState('')
  const [launchDate,setLaunchDate]=useState('')
  const [review,setReview]=useState(false)
  return <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-3" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-label="Copy project checklist"
      className="bg-white border shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-5 sm:p-6" onClick={e=>e.stopPropagation()}>
      <div className="flex justify-between gap-3 mb-4"><h2 className="font-barlow text-xl font-bold">Copy project checklist</h2><button aria-label="Close copy dialog" onClick={onClose} className="px-3 py-2 border">Close</button></div>
      {review ? <ProjectCreationReview input={{source_project_id:sourceId,name,start_date:startDate,launch_date:launchDate||null}} onCreated={onCreated} onBack={()=>setReview(false)} /> : <>
        <p className="text-sm text-fe-blue-gray mb-4">Copies this project&apos;s actual checklist, not a different workflow template. All copied tasks start as not started; custom deadlines need a new date.</p>
        <div className="space-y-4">
          <label className="block text-sm">Project name<input value={name} onChange={e=>setName(e.target.value)} className="block w-full p-3 border mt-1" /></label>
          <label className="block text-sm">Marketing launch<input type="date" value={launchDate} onChange={e=>setLaunchDate(e.target.value)} className="block w-full p-3 border mt-1" /></label>
          <label className="block text-sm">Program start<input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="block w-full p-3 border mt-1" /></label>
        </div>
        <button onClick={()=>setReview(true)} disabled={!name.trim()||!startDate} className="mt-5 px-4 py-3 bg-fe-blue text-white font-bold text-sm disabled:opacity-40">Review copied checklist</button>
      </>}
    </div>
  </div>
}
