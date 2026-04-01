import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/** Parse YYYY-MM-DD at noon local time to avoid UTC offset issues */
function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T12:00:00');
}

/** Shift a YYYY-MM-DD date string by a number of milliseconds, return YYYY-MM-DD */
function shiftDate(dateStr: string, deltaMs: number): string {
  const d = parseDate(dateStr);
  d.setTime(d.getTime() + deltaMs);
  return d.toISOString().split('T')[0];
}

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
    if (body.status !== undefined) updates.status = body.status;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.launch_date !== undefined) updates.launch_date = body.launch_date;
    if (body.revenue_goal !== undefined) updates.revenue_goal = body.revenue_goal;
    if (body.enrollment_goal !== undefined) updates.enrollment_goal = body.enrollment_goal;
    if (body.priority_id !== undefined) updates.priority_id = body.priority_id;
    if (body.workflow_type !== undefined) updates.workflow_type = body.workflow_type;
    if (body.workflow_template_id !== undefined) updates.workflow_template_id = body.workflow_template_id;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Fetch old launch_date BEFORE updating so we can compute shift delta
    let oldLaunchDate: string | null = null;
    if (body.launch_date !== undefined && !body.workflow_template_id) {
      const { data: existing } = await supabase
        .from('projects')
        .select('launch_date')
        .eq('id', id)
        .single();
      oldLaunchDate = existing?.launch_date ?? null;
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

    // --- Activity log: launch_date change ---
    if (
      body.launch_date !== undefined &&
      body.launch_date !== oldLaunchDate
    ) {
      const oldVal = oldLaunchDate || 'unset';
      const newVal = body.launch_date || 'unset';
      const desc = oldLaunchDate
        ? `Launch date changed from ${oldVal} to ${newVal}`
        : `Launch date set to ${newVal}`;
      await supabase.from('activity_log').insert({
        project_id: id,
        action: 'launch_date_changed',
        description: desc,
        old_value: oldLaunchDate,
        new_value: body.launch_date,
      });
    }

    // --- Activity log: status change ---
    if (body.status !== undefined) {
      const { data: oldProject } = await supabase
        .from('projects')
        .select('status')
        .eq('id', id)
        .single();
      const oldStatus = oldProject?.status;
      if (oldStatus && oldStatus !== body.status) {
        await supabase.from('activity_log').insert({
          project_id: id,
          action: 'status_changed',
          description: `Status changed from ${oldStatus} to ${body.status}`,
          old_value: oldStatus,
          new_value: body.status,
        });
      }
    }

    // --- Cascade: shift all task due_dates when launch_date changes ---
    if (
      body.launch_date !== undefined &&
      body.launch_date !== null &&
      oldLaunchDate !== null &&
      body.launch_date !== oldLaunchDate &&
      !body.workflow_template_id
    ) {
      const deltaMs = parseDate(body.launch_date).getTime() - parseDate(oldLaunchDate).getTime();
      const deltaDays = Math.round(deltaMs / 86_400_000);
      console.log(`[cascade] launch_date changed: ${oldLaunchDate} -> ${body.launch_date} (delta: ${deltaDays} days)`);

      // Fetch ALL tasks for this project
      const { data: cascadeTasks, error: cascadeTasksError } = await supabase
        .from('project_tasks')
        .select('id, due_date, week_number')
        .eq('project_id', id);

      if (cascadeTasksError) {
        console.error(`[cascade] Error fetching tasks:`, cascadeTasksError.message);
      } else if (!cascadeTasks || cascadeTasks.length === 0) {
        console.log(`[cascade] No tasks found for project ${id}`);
      } else {
        console.log(`[cascade] Shifting ${cascadeTasks.length} tasks by ${deltaDays} days`);

        let earliestDueDate: string | null = null;

        for (const task of cascadeTasks) {
          const newDueDate = shiftDate(task.due_date, deltaMs);
          console.log(`[cascade] Task ${task.id}: ${task.due_date} -> ${newDueDate} (week ${task.week_number})`);

          const { error: updateError } = await supabase
            .from('project_tasks')
            .update({ due_date: newDueDate })
            .eq('id', task.id);

          if (updateError) {
            console.error(`[cascade] Failed to update task ${task.id}:`, updateError.message);
          }

          // Track earliest due_date for start_date
          if (!earliestDueDate || newDueDate < earliestDueDate) {
            earliestDueDate = newDueDate;
          }
        }

        // Update project start_date to the earliest task due_date
        if (earliestDueDate) {
          console.log(`[cascade] Updating project start_date to ${earliestDueDate}`);
          const { error: startDateError } = await supabase
            .from('projects')
            .update({ start_date: earliestDueDate })
            .eq('id', id);

          if (startDateError) {
            console.error(`[cascade] Failed to update start_date:`, startDateError.message);
          } else {
            data.start_date = earliestDueDate;
          }
        }

        console.log(`[cascade] Done. ${cascadeTasks.length} tasks shifted.`);
      }
    }

    // --- Sync: when project status changes, cascade to priority and campaigns ---
    if (body.status !== undefined) {
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
