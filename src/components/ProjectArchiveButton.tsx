'use client'

import { useRef, useState } from 'react'

interface Props {
  project: { id: string; name: string; status: string }
  onChanged: (status: string) => void
}

/** Changes only lifecycle status; never deletes or modifies tasks/assets. */
export default function ProjectArchiveButton({ project, onChanged }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const restoring = project.status === 'archived'
  const action = restoring ? 'Restore' : 'Archive'

  const close = () => {
    if (saving) return
    dialog.current?.close()
    trigger.current?.focus()
  }
  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const status = restoring ? 'active' : 'archived'
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not update project.')
      dialog.current?.close()
      trigger.current?.focus()
      onChanged(status)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update project. Please retry.')
    } finally { setSaving(false) }
  }

  return (
    <>
      <button ref={trigger} type="button" onClick={() => { setError(''); dialog.current?.showModal() }}
        aria-label={`${action} ${project.name}`}
        className="px-3 py-1.5 text-sm text-fe-navy border border-gray-200 font-fira hover:bg-gray-50 transition-colors">
        {action}
      </button>
      <dialog ref={dialog} aria-labelledby={`archive-title-${project.id}`}
        onCancel={(event) => { event.preventDefault(); close() }}
        className="w-[calc(100%-2rem)] max-w-md p-6 border border-gray-200 backdrop:bg-black/40 text-fe-anthracite font-fira">
        <h2 id={`archive-title-${project.id}`} className="font-barlow font-bold text-xl text-fe-navy mb-3">
          {action} {project.name}?
        </h2>
        <p className="text-sm leading-relaxed mb-3">
          {restoring
            ? 'This project will return to Active and appear in Projects and Marketing Strategy again.'
            : 'This project will move to Archived and be hidden from the default Projects and Marketing Strategy views. You can restore it at any time.'}
        </p>
        <p className="text-sm leading-relaxed text-fe-blue-gray mb-5">
          Tasks, dates, assets and history stay intact. Existing marketing assets remain in the Pipeline and Calendar.
        </p>
        {error && <p role="alert" className="text-sm text-red-700 mb-4">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" autoFocus disabled={saving} onClick={close}
            className="px-3 py-2 border border-gray-200 text-sm disabled:opacity-50">Cancel</button>
          <button type="button" disabled={saving} onClick={save}
            className="px-3 py-2 bg-fe-navy text-white text-sm disabled:opacity-50">
            {saving ? 'Saving…' : `${action} project`}
          </button>
        </div>
      </dialog>
    </>
  )
}
