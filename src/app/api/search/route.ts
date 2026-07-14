import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Global search across projects, tasks, and campaigns.
// Returns a flat list of result items the top-nav search box renders.
export async function GET(request: NextRequest) {
  try {
    const q = (request.nextUrl.searchParams.get('q') || '').trim();
    if (q.length < 2) {
      return NextResponse.json({ projects: [], tasks: [], campaigns: [] });
    }

    const like = `%${q}%`;

    const [projectsRes, tasksRes, campaignsRes] = await Promise.all([
      supabase
        .from('projects')
        .select('id, name, workflow_type, status')
        .ilike('name', like)
        .limit(6),
      supabase
        .from('project_tasks')
        .select('id, task_name, status, project_id, projects(name)')
        .ilike('task_name', like)
        .limit(8),
      supabase
        .from('campaigns')
        .select('id, name, status, campaign_type, project_id, projects(name)')
        .ilike('name', like)
        .limit(6),
    ]);

    const projects = (projectsRes.data || []).map((p: any) => ({
      id: p.id,
      label: p.name,
      status: p.status,
      workflow_type: p.workflow_type,
      href: `/projects/${p.id}`,
    }));

    const tasks = (tasksRes.data || []).map((t: any) => ({
      id: t.id,
      label: t.task_name,
      status: t.status,
      project_name: t.projects?.name || '',
      href: `/projects/${t.project_id}`,
    }));

    const campaigns = (campaignsRes.data || []).map((c: any) => ({
      id: c.id,
      label: c.name,
      status: c.status,
      campaign_type: c.campaign_type,
      project_name: c.projects?.name || '',
      href: `/marketing`,
    }));

    return NextResponse.json({ projects, tasks, campaigns });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
