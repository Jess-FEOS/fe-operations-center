export type CompanyTaskKind = 'deliverable' | 'session' | null
export interface CompanyProject {
  id: string; name: string; status: string
  start_date: string | null; launch_date: string | null
  is_enterprise?: boolean
  enterprise_client_label?: string | null
  enterprise_owner_id?: string | null
}
export interface CompanyTask {
  id: string; project_id: string; task_name: string; due_date: string
  status: string; company_calendar_kind?: CompanyTaskKind
  owner_ids?: string[]
}
export interface CompanyCommitment {
  type: 'milestone' | 'enterprise'; id: string; date: string
  project_id: string; project_name: string; label: string
  kind: 'launch' | 'start' | 'deliverable' | 'session'
  client_label: string | null; owner_ids: string[]; status?: string
}
export function validCompanyTaskKind(value: unknown): value is CompanyTaskKind {
  return value === null || value === 'deliverable' || value === 'session'
}
// Derive events from original records. No event copies, inference from task names,
// marketing assets, internal deadlines, or private commercial fields.
export function companyCommitments(projects: CompanyProject[], tasks: CompanyTask[], filters: {
  from: string; to: string; projectId?: string | null; ownerId?: string | null
}): CompanyCommitment[] {
  const active = projects.filter(p => p.status === 'active' && (!filters.projectId || p.id === filters.projectId))
  const byId = new Map(active.map(p => [p.id, p]))
  const events: CompanyCommitment[] = []
  const inRange = (date: string | null): date is string => !!date && date >= filters.from && date <= filters.to
  for (const p of active) {
    if (filters.ownerId && p.enterprise_owner_id !== filters.ownerId) continue
    const common = { project_id:p.id, project_name:p.name, client_label:p.enterprise_client_label || null,
      owner_ids:p.enterprise_owner_id ? [p.enterprise_owner_id] : [] }
    if (inRange(p.launch_date)) events.push({ ...common, type:'milestone', id:`launch-${p.id}`,
      date:p.launch_date, kind:'launch', label:`Marketing launch: ${p.name}` })
    if (inRange(p.start_date)) events.push({ ...common, type:'milestone', id:`start-${p.id}`,
      date:p.start_date, kind:'start', label:`${p.is_enterprise ? 'Client kickoff' : 'Program start'}: ${p.name}` })
  }
  for (const t of tasks) {
    const p = byId.get(t.project_id)
    if (!p?.is_enterprise || t.status === 'done' || !t.company_calendar_kind ||
      !validCompanyTaskKind(t.company_calendar_kind) || !inRange(t.due_date)) continue
    if (filters.ownerId && !t.owner_ids?.includes(filters.ownerId)) continue
    events.push({ type:'enterprise', id:t.id, date:t.due_date, project_id:p.id, project_name:p.name,
      label:t.task_name, kind:t.company_calendar_kind, client_label:p.enterprise_client_label || null,
      owner_ids:t.owner_ids || [], status:t.status })
  }
  return events.sort((a,b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label))
}
