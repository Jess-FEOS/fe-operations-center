'use client'

import { useState } from 'react'

interface DuplicateProjectModalProps {
  sourceName: string
  workflowType: string
  workflowTemplateId: string
  onClose: () => void
  onCreated: (newProject: { id: string }) => void
}

export default function DuplicateProjectModal({
  sourceName,
  workflowType,
  workflowTemplateId,
  onClose,
  onCreated,
}: DuplicateProjectModalProps) {
  const [name, setName] = useState(`${sourceName} (Copy)`)
  const [startDate, setStartDate] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!name.trim() || !startDate) return
    setCreating(true)
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        workflow_type: workflowType,
        workflow_template_id: workflowTemplateId,
        start_date: startDate,
      }),
    })
    const data = await res.json()
    setCreating(false)
    if (res.ok) {
      onCreated(data)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl border border-gray-100 shadow-xl w-full max-w-md mx-4 p-6"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-barlow font-bold text-lg text-fe-navy mb-4">Duplicate Project</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-fira font-bold text-fe-navy mb-1">Project Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue focus:border-transparent"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-fira font-bold text-fe-navy mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-gray-100 text-fe-anthracite rounded-lg text-sm font-fira hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || !startDate || creating}
            className="flex-1 px-6 py-2.5 bg-fe-blue text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-blue/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {creating ? 'Creating...' : 'Duplicate'}
          </button>
        </div>
      </div>
    </div>
  )
}
