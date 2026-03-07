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
      .eq('role_id', id)
      .limit(1);

    const { data: templateTasks } = await supabase
      .from('project_template_tasks')
      .select('id')
      .eq('role_id', id)
      .limit(1);

    const hasMembers = members && members.length > 0;
    const hasTasks = (projectTasks && projectTasks.length > 0) || (templateTasks && templateTasks.length > 0);

    if (hasMembers || hasTasks) {
      return NextResponse.json(
        {
          error: 'Role is in use',
          members_count: members?.length || 0,
          has_tasks: hasTasks,
        },
        { status: 409 }
      );
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
