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
    if (body.role_id !== undefined) updates.role_id = body.role_id;
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

    // Get the member's name for template task matching
    const { data: member } = await supabase
      .from('team_members')
      .select('name')
      .eq('id', id)
      .single();

    const firstName = member ? member.name.split(' ')[0].toLowerCase() : '';

    // Parse reassignment data from the body
    let projectReassignments: { taskId: string; newOwnerId: string }[] = [];
    let templateReassignments: { taskId: string; newOwnerName: string }[] = [];
    try {
      const body = await request.json();
      projectReassignments = body.projectReassignments || [];
      templateReassignments = body.templateReassignments || [];
    } catch {
      // No body is fine if there are no tasks to reassign
    }

    // 1. Process project task reassignments (UUID-based owner_ids)
    for (const r of projectReassignments) {
      const { data: task } = await supabase
        .from('project_tasks')
        .select('owner_ids')
        .eq('id', r.taskId)
        .single();

      if (task) {
        const newOwnerIds = (task.owner_ids || [])
          .filter((oid: string) => oid !== id)
          .concat(r.newOwnerId);
        const unique = [...new Set(newOwnerIds)];

        await supabase
          .from('project_tasks')
          .update({ owner_ids: unique })
          .eq('id', r.taskId);
      }
    }

    // 2. Process template task reassignments (name-based owner string)
    for (const r of templateReassignments) {
      const { data: task } = await supabase
        .from('project_template_tasks')
        .select('owner')
        .eq('id', r.taskId)
        .single();

      if (task && firstName) {
        // Replace this person's name in the owner string with the new owner name
        const parts = task.owner.split(/\s*\+\s*/);
        const newParts = parts.map((p: string) =>
          p.trim().toLowerCase() === firstName ? r.newOwnerName : p.trim()
        );
        // Deduplicate (in case new owner was already listed)
        const unique = [...new Set(newParts)];
        const newOwner = unique.join(' + ');

        await supabase
          .from('project_template_tasks')
          .update({ owner: newOwner })
          .eq('id', r.taskId);
      }
    }

    // 3. Clean up any remaining project_tasks that still reference this member
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

    // 4. Clean up any remaining template tasks that reference this person by name
    if (firstName) {
      const { data: allTemplateTasks } = await supabase
        .from('project_template_tasks')
        .select('id, owner');

      if (allTemplateTasks) {
        for (const task of allTemplateTasks) {
          const parts = (task.owner as string).split(/\s*\+\s*/);
          if (parts.some((p: string) => p.trim().toLowerCase() === firstName)) {
            const filtered = parts.filter((p: string) => p.trim().toLowerCase() !== firstName);
            const newOwner = filtered.length > 0 ? filtered.join(' + ') : 'Unassigned';
            await supabase
              .from('project_template_tasks')
              .update({ owner: newOwner })
              .eq('id', task.id);
          }
        }
      }
    }

    // 5. Delete the team member
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
