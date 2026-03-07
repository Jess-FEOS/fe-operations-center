import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Fetch all project_tasks where this member is in owner_ids
    const { data: tasks, error } = await supabase
      .from('project_tasks')
      .select('id, task_name, status, due_date, project_id, owner_ids')
      .contains('owner_ids', [id]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get project names for context
    const projectIds = [...new Set((tasks || []).map(t => t.project_id))];
    let projectNames: Record<string, string> = {};
    if (projectIds.length > 0) {
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name')
        .in('id', projectIds);

      if (projects) {
        projects.forEach((p: { id: string; name: string }) => {
          projectNames[p.id] = p.name;
        });
      }
    }

    const enriched = (tasks || []).map(t => ({
      ...t,
      project_name: projectNames[t.project_id] || 'Unknown Project',
    }));

    return NextResponse.json(enriched);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
