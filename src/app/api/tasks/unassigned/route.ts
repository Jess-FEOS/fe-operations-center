import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // A task is ASSIGNED if it has a non-empty owner_ids OR a role_id that
    // resolves to a current team member. "Unassigned" (truly orphaned) means
    // empty owner_ids AND (no role_id, or a role_id that maps to no current member).
    const [tasksRes, membersRes] = await Promise.all([
      supabase
        .from('project_tasks')
        .select('id, task_name, project_id, role_id, status, due_date, owner_ids, projects(name)')
        .or('owner_ids.eq.{},owner_ids.is.null')
        .order('due_date', { ascending: true }),
      supabase
        .from('team_members')
        .select('role_id'),
    ]);

    if (tasksRes.error) {
      return NextResponse.json({ error: tasksRes.error.message }, { status: 500 });
    }

    // Set of role_ids currently held by a team member — same as the project
    // detail page's team.find(m => m.role_id === task.role_id) resolution.
    const memberRoleIds = new Set(
      (membersRes.data || []).map((m: any) => m.role_id).filter(Boolean)
    );

    // Keep only truly orphaned tasks: empty owner_ids AND no resolving role.
    const unassigned = (tasksRes.data || []).filter((t: any) => {
      const ids = t.owner_ids;
      const hasOwner = ids && ids.length > 0;
      if (hasOwner) return false;
      return !t.role_id || !memberRoleIds.has(t.role_id);
    });

    const enriched = unassigned.map((t: any) => ({
      id: t.id,
      task_name: t.task_name,
      project_id: t.project_id,
      project_name: (t.projects as any)?.name || 'Unknown',
      role_id: t.role_id,
      status: t.status,
      due_date: t.due_date,
    }));

    return NextResponse.json(enriched);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
