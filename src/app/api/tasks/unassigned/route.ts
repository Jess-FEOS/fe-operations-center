import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Find active project tasks with a role but no person (empty owner_ids)
    const { data: tasks, error } = await supabase
      .from('project_tasks')
      .select('id, task_name, project_id, role_id, status, due_date, owner_ids, projects(name)')
      .or('owner_ids.eq.{},owner_ids.is.null')
      .not('role_id', 'is', null)
      .order('due_date', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also catch tasks where owner_ids is technically not null but is an empty array
    // Supabase returns [] as a real array, so we also filter on the client
    const unassigned = (tasks || []).filter((t: any) => {
      const ids = t.owner_ids;
      return !ids || ids.length === 0;
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
