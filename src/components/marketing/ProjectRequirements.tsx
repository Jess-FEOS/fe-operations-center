'use client'

import { useState } from 'react'
import Link from 'next/link'
import { fmtLong, toISO } from '@/lib/marketing'
import { MarketingRequirement, requirementCounts } from '@/lib/marketing-requirements'
import { STATUS_LABELS, TaskStatus } from '@/lib/types'

export default function ProjectRequirements({ projectId, tasks, team, loading, error }: {
  projectId: string
  tasks: MarketingRequirement[]
  team: { id: string; name: string }[]
  loading: boolean
  error: string | null
}) {
  const [showCompleted, setShowCompleted] = useState(false)
  const today = toISO(new Date())
  const counts = requirementCounts(tasks, today)
  const visible = tasks.filter(t => showCompleted || t.status !== 'done').sort((a, b) =>
    Number(a.status === 'done') - Number(b.status === 'done')
    || (a.due_date || '9999').localeCompare(b.due_date || '9999')
    || a.task_name.localeCompare(b.task_name))

  return (
    <div className="px-5 py-4 border-b border-fe-line bg-fe-offwhite/50" data-testid={`requirements-${projectId}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-barlow font-bold text-base text-fe-navy">Project marketing requirements</h3>
        <Link href={`/projects/${projectId}`} className="text-xs font-bold text-fe-blue hover:underline">Manage in Projects →</Link>
      </div>
      <p className="text-xs text-fe-blue-gray mt-1">
        Pulled from marketing-owned tasks and Market phases, including Pre-Launch. Task deadlines are not post dates.
        Requirements do not create assets or count toward the asset plan.
      </p>
      {loading ? <p role="status" className="text-xs text-fe-blue-gray mt-3">Loading project requirements…</p> :
        error ? <p className="text-xs text-fe-red mt-3">Requirements unavailable. Use Refresh project requirements above to retry.</p> : (
        <>
          <div className="flex items-center gap-3 flex-wrap mt-3 text-xs">
            <span className="font-bold text-fe-navy">{counts.open} open</span>
            {counts.overdue > 0 && <span className="text-fe-red font-bold">{counts.overdue} overdue</span>}
            {counts.blocked > 0 && <span className="text-fe-red font-bold">{counts.blocked} blocked</span>}
            <label className="inline-flex items-center gap-1.5 text-fe-blue-gray cursor-pointer">
              <input type="checkbox" checked={showCompleted} onChange={e => setShowCompleted(e.target.checked)} />
              Show completed ({counts.done})
            </label>
          </div>
          {visible.length === 0 ? <p className="text-xs text-fe-blue-gray mt-3">{tasks.length ? 'No open marketing requirements.' : 'No tasks currently match the marketing role or phases.'}</p> : (
            <div className="mt-3 max-h-80 overflow-auto border border-fe-line bg-white">
              <table className="w-full text-xs min-w-[560px]">
                <thead className="text-left bg-fe-offwhite text-fe-blue-gray sticky top-0">
                  <tr>{['Requirement', 'Task deadline', 'Owner / role', 'Task status'].map(h => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {visible.map(t => {
                    const overdue = t.status !== 'done' && !!t.due_date && t.due_date < today
                    const owners = t.owner_ids.map(id => team.find(m => m.id === id)?.name || 'Unknown member')
                    return (
                      <tr key={t.id} className="border-t border-fe-line align-top" data-testid={`requirement-${t.id}`}>
                        <td className="px-3 py-2 text-fe-navy max-w-xs">
                          <span className="font-medium">{t.task_name}</span>
                          <span className="block text-[10px] text-fe-blue-gray mt-0.5">{t.phase}</span>
                        </td>
                        <td className={`px-3 py-2 whitespace-nowrap ${overdue ? 'text-fe-red' : 'text-fe-blue-gray'}`}>
                          {t.due_date ? fmtLong(t.due_date) : 'No deadline'}
                          {overdue && <span className="block text-[10px] font-bold">Overdue</span>}
                        </td>
                        <td className="px-3 py-2 text-fe-blue-gray">
                          {owners.length ? owners.join(', ') : t.role_name ? `Role: ${t.role_name}` : 'Unassigned'}
                        </td>
                        <td className={`px-3 py-2 whitespace-nowrap ${t.status === 'blocked' ? 'text-fe-red font-bold' : 'text-fe-blue-gray'}`}>
                          {STATUS_LABELS[t.status as TaskStatus] || t.status}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
