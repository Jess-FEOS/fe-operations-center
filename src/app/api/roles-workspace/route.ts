import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/roles-workspace
 *
 * The single role-based source of truth for the Team page and the weekly
 * "what's due per person" digest. For every vendor_role it returns:
 *   - the role (id, name, color, description, sort_order)
 *   - holders: the people who hold this role (from the team_member_roles join)
 *   - work: every unit of work the role OWNS, unified across the two systems:
 *       * project_tasks   matched by project_tasks.vendor_role_id
 *       * vendor_deliverables matched by EFFECTIVE role
 *         (assigned person's primary vendor_role_id, else the deliverable's role_id)
 *     each work item carries { id, kind, title, context (project/vendor name),
 *     status, due_date } so the UI can render one unified list grouped by project.
 *
 * Work is owned by the ROLE. The person is resolved by "who holds the role now",
 * so changing a holder on the Team page reassigns everything automatically.
 */
export async function GET() {
  try {
    // --- roles -------------------------------------------------------------
    const { data: roles, error: rolesError } = await supabase
      .from('vendor_roles')
      .select('id, name, color, description, sort_order')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (rolesError) return NextResponse.json({ error: rolesError.message }, { status: 500 });

    // --- people + multi-role join -----------------------------------------
    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select('id, name, initials, color, role, vendor_role_id');
    if (membersError) return NextResponse.json({ error: membersError.message }, { status: 500 });

    const { data: joins, error: joinError } = await supabase
      .from('team_member_roles')
      .select('team_member_id, vendor_role_id');
    if (joinError) return NextResponse.json({ error: joinError.message }, { status: 500 });

    // member id -> primary vendor_role_id (for deliverable effective-role calc)
    const memberPrimaryRole = new Map<string, string | null>();
    for (const m of members || []) memberPrimaryRole.set(m.id, m.vendor_role_id || null);

    const memberById = new Map<string, any>();
    for (const m of members || []) memberById.set(m.id, m);

    // role id -> holder members (via join table, source of truth for cascade)
    const holdersByRole = new Map<string, any[]>();
    for (const j of joins || []) {
      const mem = memberById.get(j.team_member_id);
      if (!mem) continue;
      const arr = holdersByRole.get(j.vendor_role_id) || [];
      arr.push({ id: mem.id, name: mem.name, initials: mem.initials, color: mem.color, role: mem.role });
      holdersByRole.set(j.vendor_role_id, arr);
    }

    // --- project tasks (by vendor_role_id) --------------------------------
    const { data: projectTasks, error: ptError } = await supabase
      .from('project_tasks')
      .select('id, task_name, status, due_date, project_id, vendor_role_id')
      .not('vendor_role_id', 'is', null);
    if (ptError) return NextResponse.json({ error: ptError.message }, { status: 500 });

    // project names
    const projectIds = [...new Set((projectTasks || []).map((t) => t.project_id).filter(Boolean))];
    const projectName = new Map<string, string>();
    if (projectIds.length) {
      const { data: projects } = await supabase.from('projects').select('id, name').in('id', projectIds);
      for (const p of projects || []) projectName.set(p.id, p.name);
    }

    // --- vendor deliverables (by effective role) --------------------------
    const { data: deliverables, error: delivError } = await supabase
      .from('vendor_deliverables')
      .select('id, deliverable, status, due_date, project_id, vendor_id, assigned_to_id, role_id, is_archived')
      .eq('is_archived', false);
    if (delivError) return NextResponse.json({ error: delivError.message }, { status: 500 });

    // vendor names for context when a deliverable has no project
    const vendorIds = [...new Set((deliverables || []).map((d) => d.vendor_id).filter(Boolean))];
    const vendorName = new Map<string, string>();
    if (vendorIds.length) {
      const { data: vendors } = await supabase.from('vendors').select('id, name').in('id', vendorIds);
      for (const v of vendors || []) vendorName.set(v.id, v.name);
    }
    // deliverables can also reference a project directly
    const delivProjectIds = [...new Set((deliverables || []).map((d) => d.project_id).filter(Boolean))];
    const missingProjIds = delivProjectIds.filter((id) => !projectName.has(id as string));
    if (missingProjIds.length) {
      const { data: projects } = await supabase.from('projects').select('id, name').in('id', missingProjIds);
      for (const p of projects || []) projectName.set(p.id, p.name);
    }

    function effectiveRoleId(d: any): string | null {
      if (d.assigned_to_id) return memberPrimaryRole.get(d.assigned_to_id) || null;
      return d.role_id || null;
    }

    // --- assemble per-role -------------------------------------------------
    const result = (roles || []).map((role: any) => {
      const roleProjectTasks = (projectTasks || [])
        .filter((t) => t.vendor_role_id === role.id)
        .map((t) => ({
          id: t.id,
          kind: 'task' as const,
          title: t.task_name,
          context: projectName.get(t.project_id) || 'Unassigned Project',
          project_id: t.project_id || null,
          status: t.status,
          due_date: t.due_date || null,
        }));

      const roleDeliverables = (deliverables || [])
        .filter((d) => effectiveRoleId(d) === role.id)
        .map((d) => ({
          id: d.id,
          kind: 'deliverable' as const,
          title: d.deliverable,
          context: (d.project_id && projectName.get(d.project_id)) || vendorName.get(d.vendor_id) || 'General',
          project_id: d.project_id || null,
          status: d.status,
          due_date: d.due_date || null,
        }));

      const work = [...roleProjectTasks, ...roleDeliverables];

      return {
        id: role.id,
        name: role.name,
        color: role.color,
        description: role.description ?? null,
        sort_order: role.sort_order ?? 0,
        holders: holdersByRole.get(role.id) || [],
        task_count: roleProjectTasks.length,
        deliverable_count: roleDeliverables.length,
        work_count: work.length,
        work,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
