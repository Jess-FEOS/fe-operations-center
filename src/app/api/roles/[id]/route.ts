import { NextRequest, NextResponse } from 'next/server';
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
    if (body.description !== undefined) updates.description = body.description;
    if (body.color !== undefined) updates.color = body.color;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('roles')
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

    // Check for active usage
    const { data: members } = await supabase
      .from('team_members')
      .select('id')
      .eq('role_id', id);

    const { data: projectTasks } = await supabase
      .from('project_tasks')
      .select('id')
      .eq('role_id', id);

    const { data: templateTasks } = await supabase
      .from('project_template_tasks')
      .select('id')
      .eq('role_id', id);

    const hasMembers = members && members.length > 0;
    const projectTaskCount = projectTasks?.length || 0;
    const templateTaskCount = templateTasks?.length || 0;
    const totalTaskCount = projectTaskCount + templateTaskCount;

    // Parse optional reassignment target from request body
    let reassignToRoleId: string | null = null;
    try {
      const body = await request.json();
      reassignToRoleId = body.reassign_to_role_id || null;
    } catch {
      // No body is fine
    }

    // If tasks exist and no reassignment target provided, block deletion
    if (totalTaskCount > 0 && !reassignToRoleId) {
      return NextResponse.json(
        {
          error: 'Role has tasks assigned',
          project_task_count: projectTaskCount,
          template_task_count: templateTaskCount,
          total_task_count: totalTaskCount,
          members_count: members?.length || 0,
        },
        { status: 409 }
      );
    }

    // If members exist and no task reassignment needed, still block
    if (hasMembers && !reassignToRoleId) {
      return NextResponse.json(
        {
          error: 'Role is in use',
          members_count: members?.length || 0,
          project_task_count: projectTaskCount,
          template_task_count: templateTaskCount,
          total_task_count: totalTaskCount,
        },
        { status: 409 }
      );
    }

    // Reassign tasks to the target role if provided
    if (reassignToRoleId) {
      if (projectTaskCount > 0) {
        await supabase
          .from('project_tasks')
          .update({ role_id: reassignToRoleId })
          .eq('role_id', id);
      }
      if (templateTaskCount > 0) {
        await supabase
          .from('project_template_tasks')
          .update({ role_id: reassignToRoleId })
          .eq('role_id', id);
      }
      // Reassign members too
      if (hasMembers) {
        await supabase
          .from('team_members')
          .update({ role_id: reassignToRoleId })
          .eq('role_id', id);
      }
    }

    const { error } = await supabase
      .from('roles')
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
