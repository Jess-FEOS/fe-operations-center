import { supabase } from '@/lib/supabase'
import { resolveOwnership, Person, RoleJoin, OwnedWork } from '@/lib/ownership'

export async function loadOwnership() {
  const [members, joins] = await Promise.all([
    supabase.from('team_members').select('id,name,initials,color,role,role_id,vendor_role_id'),
    supabase.from('team_member_roles').select('team_member_id,vendor_role_id'),
  ])
  if (members.error || joins.error) throw new Error('Could not load current ownership. Please retry.')
  return { people: (members.data || []) as Person[], joins: (joins.data || []) as RoleJoin[] }
}
export function enrichOwnership<T extends OwnedWork>(task: T, data: Awaited<ReturnType<typeof loadOwnership>>) {
  const resolved = resolveOwnership(task, data.people, data.joins)
  return { ...task, resolved_owner_ids: resolved.owner_ids, accountable_owner_id: resolved.accountable_owner_id,
    ownership_issue: resolved.issue, resolved_vendor_role_id: resolved.vendor_role_id }
}
