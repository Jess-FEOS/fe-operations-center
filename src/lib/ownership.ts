export interface Person {
  id: string; name: string; role_id?: string | null; vendor_role_id?: string | null
  initials?: string; color?: string; role?: string
}
export interface RoleJoin { team_member_id: string; vendor_role_id: string }
export interface OwnedWork {
  owner_ids?: string[] | null; assigned_to_id?: string | null
  role_id?: string | null; vendor_role_id?: string | null
}
export interface Ownership {
  owner_ids: string[]; accountable_owner_id: string | null
  vendor_role_id: string | null; source: 'person' | 'role' | 'legacy' | 'unassigned'
  issue: string | null
}

/** Read-time resolution only. Never reassign stored commitments as a side effect. */
export function resolveOwnership(work: OwnedWork, people: Person[], joins: RoleJoin[], vendor = false): Ownership {
  const explicit = work.assigned_to_id ? [work.assigned_to_id] : (work.owner_ids || [])
  let ids: string[] = [], source: Ownership['source'] = 'unassigned'
  let role = vendor ? work.role_id || null : work.vendor_role_id || null
  if (explicit.length) {
    ids = [...new Set(explicit)].filter(id => people.some(p => p.id === id))
    source = 'person'
    role = ids.length === 1 ? people.find(p => p.id === ids[0])?.vendor_role_id || role : role
  } else if (role) {
    ids = [...new Set(joins.filter(j => j.vendor_role_id === role).map(j => j.team_member_id))]
      .filter(id => people.some(p => p.id === id))
    source = 'role'
  } else if (!vendor && work.role_id) {
    ids = people.filter(p => p.role_id === work.role_id).map(p => p.id)
    source = 'legacy'
    if (ids.length === 1) role = people.find(p => p.id === ids[0])?.vendor_role_id || null
  }
  const missing = explicit.some(id => !people.some(p => p.id === id))
  const issue = missing ? 'Assigned person is no longer available. Confirm an owner.' :
    ids.length > 1 ? 'Multiple owners: choose one accountable owner.' :
    ids.length === 0 ? 'No accountable owner assigned.' : null
  return { owner_ids: ids, accountable_owner_id: issue ? null : ids[0], vendor_role_id: role, source, issue }
}

export function isOpenWork(status: string | null | undefined) {
  return !['done', 'approved', 'delivered', 'complete', 'completed', 'cancelled', 'canceled'].includes((status || '').toLowerCase())
}

/** Name aliases are exact and explicit; ambiguous first names never guess. */
export function matchTemplateOwner(name: string, people: Person[]): Person | null {
  const key = name.trim().toLowerCase()
  const exact = people.filter(p => p.name.toLowerCase() === key)
  if (exact.length === 1) return exact[0]
  const first = people.filter(p => p.name.split(' ')[0].toLowerCase() === key ||
    (key === 'jess' && p.name.split(' ')[0].toLowerCase() === 'jessica'))
  return first.length === 1 ? first[0] : null
}
