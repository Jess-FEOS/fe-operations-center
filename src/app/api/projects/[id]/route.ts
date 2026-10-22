import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { loadOwnership, enrichOwnership } from '@/lib/ownership-server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (projectError) {
      return NextResponse.json({ error: projectError.message }, { status: 404 });
    }

    const { data: tasks, error: tasksError } = await supabase
      .from('project_tasks')
      .select('*')
      .eq('project_id', id)
      .order('phase_order', { ascending: true })
      .order('task_order', { ascending: true });

    if (tasksError) {
      return NextResponse.json({ error: tasksError.message }, { status: 500 });
    }

    // Fetch all links for this project's tasks
    const taskIds = (tasks || []).map((t: { id: string }) => t.id);
    let links: Record<string, unknown>[] = [];
    if (taskIds.length > 0) {
      const { data: linksData } = await supabase
        .from('task_links')
        .select('*')
        .in('task_id', taskIds)
        .order('created_at', { ascending: true });
      links = linksData || [];
    }

    // Fetch all dependencies for this project's tasks
    let dependencies: Record<string, unknown>[] = [];
    if (taskIds.length > 0) {
      const { data: depsData } = await supabase
        .from('task_dependencies')
        .select('*')
        .in('task_id', taskIds);
      dependencies = depsData || [];
    }

    const ownership = await loadOwnership();
    return NextResponse.json({ project, tasks: (tasks || []).map(t => enrichOwnership(t, ownership)), links, dependencies });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Changing a category must never erase active work, links, or history.
    if (body.workflow_template_id !== undefined || body.workflow_type !== undefined) {
      const { data: current, error } = await supabase.from('projects')
        .select('workflow_template_id,workflow_type').eq('id', id).single();
      if (error || !current) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
      if ((body.workflow_template_id !== undefined && body.workflow_template_id !== current.workflow_template_id) ||
          (body.workflow_type !== undefined && body.workflow_type !== current.workflow_type)) {
        return NextResponse.json({ error: 'Workflow replacement is disabled to protect existing tasks and history. Create a new project from a template instead.',
          code: 'WORKFLOW_REPLACEMENT_BLOCKED' }, { status: 409 });
      }
    }

    // Date edits must use the reviewed, atomic schedule endpoint. Even first-set
    // launch dates and start-only edits follow this path; no legacy cascade.
    if (body.start_date !== undefined || body.launch_date !== undefined) {
      const { data: current, error } = await supabase.from('projects')
        .select('start_date, launch_date').eq('id', id).single();
      if (error || !current) return NextResponse.json({ error: 'Could not read project dates.' }, { status: 500 });
      if ((body.start_date !== undefined && body.start_date !== current.start_date) ||
          (body.launch_date !== undefined && body.launch_date !== current.launch_date)) {
        return NextResponse.json({ error: 'Review the task schedule before saving new project dates.', code: 'SCHEDULE_REVIEW_REQUIRED' }, { status: 409 });
      }
    }

    let oldStatus: string | null = null;
    if (body.status !== undefined) {
      if (!['active', 'completed', 'paused', 'archived'].includes(body.status)) {
        return NextResponse.json({ error: 'Invalid project status' }, { status: 400 });
      }
      const { data: existing, error } = await supabase
        .from('projects').select('status').eq('id', id).single();
      if (error || !existing) {
        return NextResponse.json({ error: error?.message || 'Project not found' }, { status: error?.code === 'PGRST116' || !error ? 404 : 500 });
      }
      oldStatus = existing.status;
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    // Dates are written only by save_project_schedule. Even unchanged dates
    // are omitted here so metadata edits cannot race and overwrite a schedule.
    if (body.status !== undefined) updates.status = body.status;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.revenue_goal !== undefined) updates.revenue_goal = body.revenue_goal;
    if (body.enrollment_goal !== undefined) updates.enrollment_goal = body.enrollment_goal;
    if (body.priority_id !== undefined) updates.priority_id = body.priority_id;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }


    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // --- Activity log: status change ---
    if (body.status !== undefined) {
      if (oldStatus && oldStatus !== body.status) {
        await supabase.from('activity_log').insert({
          project_id: id,
          change_type: 'status_changed',
          description: `Status changed from ${oldStatus} to ${body.status}`,
          old_value: oldStatus,
          new_value: body.status,
        });
      }
    }

    // --- Sync: when project status changes, cascade to priority and campaigns ---
    // Archive/restore are visibility changes, not changes to linked work.
    if (body.status !== undefined && body.status !== 'archived' && oldStatus !== 'archived') {
      // Sync priority status if project has a priority_id
      const priorityId = data.priority_id;
      if (priorityId) {
        const statusMap: Record<string, string> = {
          active: 'in_progress',
          completed: 'done',
          paused: 'not_started',
        };
        const mappedStatus = statusMap[body.status];
        if (mappedStatus) {
          await supabase
            .from('monthly_priorities')
            .update({ status: mappedStatus })
            .eq('id', priorityId);
        }
      }

      // If project completed, mark all linked campaigns as done
      if (body.status === 'completed') {
        await supabase
          .from('campaigns')
          .update({ status: 'done' })
          .eq('project_id', id);
      }
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Delete associated tasks first
    const { error: tasksError } = await supabase
      .from('project_tasks')
      .delete()
      .eq('project_id', id);

    if (tasksError) {
      return NextResponse.json({ error: tasksError.message }, { status: 500 });
    }

    // Delete the project
    const { error: projectError } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (projectError) {
      return NextResponse.json({ error: projectError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
