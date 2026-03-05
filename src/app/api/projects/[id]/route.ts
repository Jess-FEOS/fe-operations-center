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

    return NextResponse.json({ project, tasks: tasks || [], links, dependencies });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.start_date !== undefined) updates.start_date = body.start_date;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.workflow_type !== undefined) updates.workflow_type = body.workflow_type;
    if (body.workflow_template_id !== undefined) updates.workflow_template_id = body.workflow_template_id;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // If workflow template is changing, regenerate tasks
    let newTasks = null;
    if (body.workflow_template_id) {
      // Get the project's start_date (use provided or fetch existing)
      let startDate = body.start_date;
      if (!startDate) {
        const { data: existing } = await supabase
          .from('projects')
          .select('start_date')
          .eq('id', id)
          .single();
        startDate = existing?.start_date;
      }

      // Delete existing tasks
      const { error: deleteError } = await supabase
        .from('project_tasks')
        .delete()
        .eq('project_id', id);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      // Fetch new template tasks
      const { data: templateTasks, error: templateError } = await supabase
        .from('template_tasks')
        .select('*')
        .eq('workflow_template_id', body.workflow_template_id);

      if (templateError) {
        return NextResponse.json({ error: templateError.message }, { status: 500 });
      }

      // Generate new project tasks
      if (templateTasks && templateTasks.length > 0) {
        const startDateObj = new Date(startDate);
        const projectTasks = templateTasks.map((task: Record<string, unknown>) => {
          const dueDate = new Date(startDateObj.getTime() + (task.week_offset as number) * 7 * 24 * 60 * 60 * 1000);
          return {
            project_id: id,
            phase: task.phase,
            phase_order: task.phase_order,
            task_name: task.task_name,
            task_order: task.task_order,
            due_date: dueDate.toISOString().split('T')[0],
            week_number: (task.week_offset as number) + 1,
            status: 'not_started',
            owner_ids: task.owner_ids,
          };
        });

        const { data: inserted, error: insertError } = await supabase
          .from('project_tasks')
          .insert(projectTasks)
          .select();

        if (insertError) {
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }
        newTasks = inserted;
      }
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

    // Return tasks alongside project when workflow changed
    if (newTasks !== null) {
      return NextResponse.json({ project: data, tasks: newTasks });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

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
