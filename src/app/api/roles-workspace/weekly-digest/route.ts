import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/roles-workspace/weekly-digest?window=week|all
 *
 * The role-based "what's due per person" review surface. For each PERSON:
 *   - the role(s) they hold (from team_member_roles)
 *   - every unit of work owned by any of those roles, unified across
 *     project_tasks (vendor_role_id) + vendor_deliverables (effective role)
 *   - optionally filtered to items due within this week (Mon–Sun) plus anything
 *     overdue and not done. window=all returns everything owned.
 *
 * Because ownership resolves through the roles a person holds, changing a role
 * holder automatically changes whose digest the work appears in.
 */

function weekBounds(now: Date) {
  // Monday as start of week, Sunday end (local-ish; dates are ISO date strings).
  const d = new Date(now);
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const diffToMon = (day + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diffToMon);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

const DONE_STATUSES = new Set(['done', 'approved', 'delivered', 'complete', 'completed']);

export async function GET(request: NextRequest) {
  try {
    const windowParam = new URL(request.url).searchParams.get('window') || 'week';
    const { monday, sunday } = weekBounds(new Date());

    const { data: members } = await supabase
      .from('team_members')
      .select('id, name, initials, color, role, vendor_role_id');
    const memberPrimaryRole = new Map<string, string | null>();
    for (const m of members || []) memberPrimaryRole.set(m.id, m.vendor_role_id || null);

    const { data: roles } = await supabase.from('vendor_roles').select('id, name, color');
    const roleName = new Map<string, string>();
    const roleColor = new Map<string, string>();
    for (const r of roles || []) {
      roleName.set(r.id, r.name);
      roleColor.set(r.id, r.color);
    }

    const { data: joins } = await supabase
      .from('team_member_roles')
      .select('team_member_id, vendor_role_id');
    // person -> Set(roleId); role -> Set(personId)
    const rolesByMember = new Map<string, string[]>();
    for (const j of joins || []) {
      const arr = rolesByMember.get(j.team_member_id) || [];
      arr.push(j.vendor_role_id);
      rolesByMember.set(j.team_member_id, arr);
    }

    // work by role
    const { data: projectTasks } = await supabase
      .from('project_tasks')
      .select('id, task_name, status, due_date, project_id, vendor_role_id')
      .not('vendor_role_id', 'is', null);
    const projectIds = [...new Set((projectTasks || []).map((t) => t.project_id).filter(Boolean))];
    const projectName = new Map<string, string>();
    if (projectIds.length) {
      const { data: projects } = await supabase.from('projects').select('id, name').in('id', projectIds);
      for (const p of projects || []) projectName.set(p.id, p.name);
    }

    const { data: deliverables } = await supabase
      .from('vendor_deliverables')
      .select('id, deliverable, status, due_date, project_id, vendor_id, assigned_to_id, role_id, is_archived')
      .eq('is_archived', false);
    const vendorIds = [...new Set((deliverables || []).map((d) => d.vendor_id).filter(Boolean))];
    const vendorName = new Map<string, string>();
    if (vendorIds.length) {
      const { data: vendors } = await supabase.from('vendors').select('id, name').in('id', vendorIds);
      for (const v of vendors || []) vendorName.set(v.id, v.name);
    }
    const delivProjIds = [...new Set((deliverables || []).map((d) => d.project_id).filter(Boolean))];
    const missing = delivProjIds.filter((id) => !projectName.has(id as string));
    if (missing.length) {
      const { data: projects } = await supabase.from('projects').select('id, name').in('id', missing);
      for (const p of projects || []) projectName.set(p.id, p.name);
    }

    function effRole(d: any): string | null {
      if (d.assigned_to_id) return memberPrimaryRole.get(d.assigned_to_id) || null;
      return d.role_id || null;
    }

    // roleId -> work[]
    const workByRole = new Map<string, any[]>();
    function push(roleId: string | null, item: any) {
      if (!roleId) return;
      const arr = workByRole.get(roleId) || [];
      arr.push(item);
      workByRole.set(roleId, arr);
    }
    for (const t of projectTasks || []) {
      push(t.vendor_role_id, {
        id: t.id,
        kind: 'task',
        title: t.task_name,
        context: projectName.get(t.project_id) || 'Unassigned Project',
        status: t.status,
        due_date: t.due_date || null,
      });
    }
    for (const d of deliverables || []) {
      push(effRole(d), {
        id: d.id,
        kind: 'deliverable',
        title: d.deliverable,
        context: (d.project_id && projectName.get(d.project_id)) || vendorName.get(d.vendor_id) || 'General',
        status: d.status,
        due_date: d.due_date || null,
      });
    }

    function inWindow(item: any): boolean {
      if (windowParam === 'all') return true;
      const isDone = DONE_STATUSES.has((item.status || '').toLowerCase());
      if (!item.due_date) return false;
      const due = new Date(item.due_date);
      if (isNaN(due.getTime())) return false;
      if (due >= monday && due <= sunday) return true;
      // overdue and not done
      if (due < monday && !isDone) return true;
      return false;
    }

    const people = (members || []).map((m) => {
      const myRoleIds = rolesByMember.get(m.id) || [];
      const seen = new Set<string>();
      const items: any[] = [];
      for (const rid of myRoleIds) {
        for (const w of workByRole.get(rid) || []) {
          const key = `${w.kind}:${w.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          if (inWindow(w)) items.push({ ...w, role_id: rid, role_name: roleName.get(rid) || '' });
        }
      }
      // sort: overdue first, then by due date, undated last
      items.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0;
      });
      return {
        id: m.id,
        name: m.name,
        initials: m.initials,
        color: m.color,
        roles: myRoleIds.map((rid) => ({ id: rid, name: roleName.get(rid) || '', color: roleColor.get(rid) || '#647692' })),
        item_count: items.length,
        items,
      };
    });

    // people with work first, then alphabetical
    people.sort((a, b) => {
      if (b.item_count !== a.item_count) return b.item_count - a.item_count;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      window: windowParam,
      week_start: monday.toISOString().slice(0, 10),
      week_end: sunday.toISOString().slice(0, 10),
      people,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
