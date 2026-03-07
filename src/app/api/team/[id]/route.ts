import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.role !== undefined) updates.role = body.role;
    if (body.initials !== undefined) updates.initials = body.initials;
    if (body.color !== undefined) updates.color = body.color;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('team_members')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
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

    // Check for reassignment data in the request body
    let reassignments: { taskId: string; newOwnerId: string }[] = [];
    try {
      const body = await request.json();
      reassignments = body.reassignments || [];
    } catch {
      // No body is fine if there are no tasks to reassign
    }

    // Process reassignments: update owner_ids arrays in project_tasks
    for (const r of reassignments) {
      // Fetch the current task
      const { data: task } = await supabase
        .from('project_tasks')
        .select('owner_ids')
        .eq('id', r.taskId)
        .single();

      if (task) {
        const newOwnerIds = (task.owner_ids || [])
          .filter((oid: string) => oid !== id)
          .concat(r.newOwnerId);

        // Deduplicate
        const unique = [...new Set(newOwnerIds)];

        await supabase
          .from('project_tasks')
          .update({ owner_ids: unique })
          .eq('id', r.taskId);
      }
    }

    // Remove this member from any remaining project_tasks owner_ids
    const { data: remainingTasks } = await supabase
      .from('project_tasks')
      .select('id, owner_ids')
      .contains('owner_ids', [id]);

    if (remainingTasks) {
      for (const task of remainingTasks) {
        const filtered = (task.owner_ids || []).filter((oid: string) => oid !== id);
        await supabase
          .from('project_tasks')
          .update({ owner_ids: filtered })
          .eq('id', task.id);
      }
    }

    // Delete the team member
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
