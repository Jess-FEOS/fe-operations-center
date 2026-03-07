import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET: Search/filter project tasks
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get('role_id');
    const projectId = searchParams.get('project_id');
    const keyword = searchParams.get('keyword');

    let query = supabase
      .from('project_tasks')
      .select('id, task_name, project_id, owner_ids, role_id, status')
      .order('task_order', { ascending: true });

    if (roleId) query = query.eq('role_id', roleId);
    if (projectId) query = query.eq('project_id', projectId);

    const { data: tasks, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let filtered = tasks || [];

    // Client-side keyword filter (Supabase ilike on task_name)
    if (keyword) {
      const kw = keyword.toLowerCase();
      filtered = filtered.filter((t: any) => t.task_name.toLowerCase().includes(kw));
    }

    // Fetch project names for all matching tasks
    const projectIds = [...new Set(filtered.map((t: any) => t.project_id))];
    let projectMap: Record<string, string> = {};
    if (projectIds.length > 0) {
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name')
        .in('id', projectIds);
      (projects || []).forEach((p: any) => { projectMap[p.id] = p.name; });
    }

    const enriched = filtered.map((t: any) => ({
      ...t,
      project_name: projectMap[t.project_id] || 'Unknown',
    }));

    return NextResponse.json(enriched);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Bulk update tasks
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { task_ids, role_id, owner_id } = body;

    if (!task_ids || !Array.isArray(task_ids) || task_ids.length === 0) {
      return NextResponse.json({ error: 'No task IDs provided' }, { status: 400 });
    }

    if (role_id === undefined && owner_id === undefined) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    let updatedCount = 0;

    // If assigning a role, bulk update role_id (cannot clear it)
    if (role_id !== undefined) {
      if (!role_id) {
        return NextResponse.json({ error: 'Cannot remove role from tasks. Every task must have a role.' }, { status: 400 });
      }
      const { error } = await supabase
        .from('project_tasks')
        .update({ role_id })
        .in('id', task_ids);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      updatedCount = task_ids.length;
    }

    // If assigning a person, replace owner_ids with [owner_id]
    if (owner_id !== undefined) {
      const newOwnerIds = owner_id ? [owner_id] : [];
      const { error } = await supabase
        .from('project_tasks')
        .update({ owner_ids: newOwnerIds })
        .in('id', task_ids);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      updatedCount = task_ids.length;
    }

    return NextResponse.json({ updated: updatedCount });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
