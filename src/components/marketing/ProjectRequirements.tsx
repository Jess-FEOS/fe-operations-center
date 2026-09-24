'use client'

import Link from 'next/link'
import { ContentItem, fmtLong, toISO } from '@/lib/marketing'
import { MarketingRequirement, requirementCounts, isMarketingRequirement } from '@/lib/marketing-requirements'
import { STATUS_LABELS, TaskStatus } from '@/lib/types'

export default function ProjectRequirements({ projectId, tasks, items, team, loading, error, onCreate, onOpen }: {
  projectId: string
  tasks: MarketingRequirement[]
  items: ContentItem[]
  team: { id: string; name: string }[]
  loading: boolean
  error: string | null
  onCreate: (task: MarketingRequirement) => void
  onOpen: (item: ContentItem) => void
}) {
  const today = toISO(new Date())
  const linked = new Map(items.filter(i => i.source_task_id).map(i => [i.source_task_id!, i]))
  const counts = requirementCounts(tasks, today, new Set(linked.keys()))
  const visible = tasks.filter(isMarketingRequirement).sort((a, b) =>
    Number(linked.has(a.id)) - Number(linked.has(b.id))
    || (a.due_date || '9999').localeCompare(b.due_date || '9999')
    || a.task_name.localeCompare(b.task_name))
  // No empty flags or completed-task toggle for programs such as AI Accelerator.
  if (!loading && !error && visible.length === 0) return null

  return (
    <div className="px-5 py-4 border-b border-fe-line bg-fe-offwhite/50" data-testid={`requirements-${projectId}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-barlow font-bold text-base text-fe-navy">Content requirements from Projects</h3>
        <Link href={`/projects/${projectId}`} className="text-xs font-bold text-fe-blue hover:underline">Manage in Projects →</Link>
      </div>
      <p className="text-xs text-fe-blue-gray mt-1">
        Open content tasks only. Completed tasks, sales pages, setup and other operational work stay in Projects.
        Create an asset to review its post date and add it to the Pipeline and Calendar.
      </p>
      {loading ? <p role="status" className="text-xs text-fe-blue-gray mt-3">Loading project requirements…</p> :
        error ? <p className="text-xs text-fe-red mt-3">Requirements unavailable. Use Refresh project requirements above to retry.</p> : (
        <>
          <div className="flex items-center gap-3 flex-wrap mt-3 text-xs">
            <span className="font-bold text-fe-navy">{counts.open} to plan</span>
            {visible.length > counts.open && <span className="text-fe-blue-gray">{visible.length - counts.open} linked to assets</span>}
            {counts.overdue > 0 && <span className="text-fe-red font-bold">{counts.overdue} past task deadline</span>}
            {counts.blocked > 0 && <span className="text-fe-red font-bold">{counts.blocked} blocked</span>}
          </div>
          {visible.length > 0 && (
            <div className="mt-3 max-h-80 overflow-auto border border-fe-line bg-white">
              <table className="w-full text-xs min-w-[670px]">
                <thead className="text-left bg-fe-offwhite text-fe-blue-gray sticky top-0">
                  <tr>{['Requirement', 'Task deadline', 'Owner / role', 'Task status', 'Asset'].map(h => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {visible.map(t => {
                    const asset = linked.get(t.id)
                    const overdue = !asset && !!t.due_date && t.due_date < today
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
                        <td className="px-3 py-2 whitespace-nowrap">
                          <button onClick={() => asset ? onOpen(asset) : onCreate(t)}
                            data-testid={`requirement-action-${t.id}`} className="text-fe-blue font-bold hover:underline">
                            {asset ? 'Open asset' : '+ Create asset'}
                          </button>
                          {asset && <span className="block text-[10px] text-fe-blue-gray">Post: {asset.scheduled_date ? fmtLong(asset.scheduled_date) : 'Undated'}</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-[10px] text-fe-blue-gray md:hidden">Scroll the table sideways to see asset actions.</p>
        </>
      )}
    </div>
  )
}
