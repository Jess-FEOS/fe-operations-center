import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [
      { count: total_projects },
      { count: total_tasks },
      { count: tasks_no_owner },
      { count: priorities_no_project },
      { count: projects_no_priority },
      { count: total_campaigns },
      { count: total_metrics_logged },
    ] = await Promise.all([
      supabase.from('projects').select('*', { count: 'exact', head: true }),
      supabase.from('project_tasks').select('*', { count: 'exact', head: true }),
      supabase.from('project_tasks').select('*', { count: 'exact', head: true }).eq('owner_ids', '{}'),
      supabase.from('monthly_priorities').select('*', { count: 'exact', head: true }).is('project_id', null),
      supabase.from('projects').select('*', { count: 'exact', head: true }).is('priority_id', null),
      supabase.from('campaigns').select('*', { count: 'exact', head: true }),
      supabase.from('metrics').select('*', { count: 'exact', head: true }),
    ]);

    return NextResponse.json({
      total_projects: total_projects ?? 0,
      total_tasks: total_tasks ?? 0,
      tasks_no_owner: tasks_no_owner ?? 0,
      priorities_no_project: priorities_no_project ?? 0,
      projects_no_priority: projects_no_priority ?? 0,
      total_campaigns: total_campaigns ?? 0,
      total_metrics_logged: total_metrics_logged ?? 0,
      last_checked: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
