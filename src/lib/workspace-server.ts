import { supabase } from '@/lib/supabase'
import { loadOwnership } from '@/lib/ownership-server'
import { isOpenWork, resolveOwnership } from '@/lib/ownership'
export async function loadWorkspace(includeHistory = false) {
  const ownership = await loadOwnership()
  const [roles, projects, tasks, deliverables, vendors] = await Promise.all([
    supabase.from('vendor_roles').select('*').order('sort_order').order('name'),
    supabase.from('projects').select('id,name,status'),
    supabase.from('project_tasks').select('id,task_name,status,due_date,project_id,vendor_role_id,role_id,owner_ids'),
    supabase.from('vendor_deliverables').select('id,deliverable,status,due_date,project_id,vendor_id,assigned_to_id,role_id,is_archived').eq('is_archived', false),
    supabase.from('vendors').select('id,name'),
  ])
  if ([roles,projects,tasks,deliverables,vendors].some(r => r.error)) throw new Error('Could not load complete work data.')
  const byProject = new Map((projects.data || []).map(p => [p.id,p]))
  const vendorNames = new Map((vendors.data || []).map(v => [v.id,v.name]))
  const visible = (t: { project_id?: string | null; status?: string | null }) =>
    includeHistory || (isOpenWork(t.status) && (!t.project_id || byProject.get(t.project_id)?.status === 'active'))
  const work = [
    ...(tasks.data || []).filter(visible).map(t => ({
      id: t.id, kind: 'task' as const, title: t.task_name, context: byProject.get(t.project_id)?.name || 'General',
      project_id: t.project_id, status: t.status, due_date: t.due_date,
      ownership: resolveOwnership(t, ownership.people, ownership.joins),
    })),
    ...(deliverables.data || []).filter(visible).map(d => ({
      id: d.id, kind: 'deliverable' as const, title: d.deliverable,
      context: (d.project_id && byProject.get(d.project_id)?.name) || vendorNames.get(d.vendor_id) || 'General',
      project_id: d.project_id, status: d.status, due_date: d.due_date,
      ownership: resolveOwnership(d, ownership.people, ownership.joins, true),
    })),
  ].map(w => ({ ...w, owner_ids: w.ownership.owner_ids, accountable_owner_id: w.ownership.accountable_owner_id,
    ownership_issue: w.ownership.issue, role_id: w.ownership.vendor_role_id || 'unassigned' }))
  const resultRoles = [...(roles.data || [])]
  if (work.some(w => !resultRoles.some(r => r.id === w.role_id))) {
    resultRoles.push({ id: 'unassigned', name: 'Ownership needs review', color: '#B45309', description: 'No operating role could be resolved.', sort_order: 999 })
  }
  const groups = resultRoles.map(role => {
    const items = work.filter(w => w.role_id === role.id)
    return { ...role, holders: ownership.people.filter(p => ownership.joins.some(j => j.vendor_role_id === role.id && j.team_member_id === p.id)),
      task_count: items.filter(w => w.kind === 'task').length, deliverable_count: items.filter(w => w.kind === 'deliverable').length,
      work_count: items.length, work: items }
  })
  return { groups, work, people: ownership.people, joins: ownership.joins }
}
