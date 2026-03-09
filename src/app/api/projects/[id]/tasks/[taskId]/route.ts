import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; taskId: string } }
) {
  try {
    const { id, taskId } = params;
    const body = await request.json();

    const updates: Record<string, unknown> = {};
    if (body.status !== undefined) updates.status = body.status;
    if (body.task_name !== undefined) updates.task_name = body.task_name;
    if (body.owner_ids !== undefined) updates.owner_ids = body.owner_ids;
    if (body.role_id !== undefined) updates.role_id = body.role_id;

    // Prevent clearing role_id — tasks must always have a role
    if (body.role_id === null || body.role_id === '') {
      return NextResponse.json(
        { error: 'role_id cannot be removed. Every task must be assigned to a role.' },
        { status: 400 }
      );
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('project_tasks')
      .update(updates)
      .eq('id', taskId)
      .eq('project_id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // --- Sync: recalculate project progress when task status changes ---
    if (body.status !== undefined) {
      const { data: allTasks } = await supabase
        .from('project_tasks')
        .select('status')
        .eq('project_id', id);

      const total = allTasks?.length || 0;
      const doneTasks = allTasks?.filter((t: { status: string }) => t.status === 'done').length || 0;
      const progress = total > 0 ? Math.round((doneTasks / total) * 100) : 0;
      const allDone = total > 0 && doneTasks === total;

      const projectUpdates: Record<string, unknown> = {
        progress,
        done_tasks: doneTasks,
      };
      if (allDone) {
        projectUpdates.status = 'completed';
      }

      await supabase
        .from('projects')
        .update(projectUpdates)
        .eq('id', id);

      // If project just became completed and has a priority_id, mark priority done
      if (allDone) {
        const { data: project } = await supabase
          .from('projects')
          .select('priority_id')
          .eq('id', id)
          .single();

        if (project?.priority_id) {
          await supabase
            .from('monthly_priorities')
            .update({ status: 'done' })
            .eq('id', project.priority_id);
        }
      }
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; taskId: string } }
) {
  try {
    const { id, taskId } = params;

    const { error } = await supabase
      .from('project_tasks')
      .delete()
      .eq('id', taskId)
      .eq('project_id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
