import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data: roles, error } = await supabase
      .from('roles')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch team members with role assignments
    const { data: members } = await supabase
      .from('team_members')
      .select('id, name, initials, color, role_id');

    // Count active project tasks per role
    const { data: projectTaskCounts } = await supabase
      .from('project_tasks')
      .select('role_id');

    // Count template tasks per role
    const { data: templateTaskCounts } = await supabase
      .from('project_template_tasks')
      .select('role_id');

    const enriched = (roles || []).map(role => {
      const holders = (members || []).filter((m: any) => m.role_id === role.id);
      const projectCount = (projectTaskCounts || []).filter((t: any) => t.role_id === role.id).length;
      const templateCount = (templateTaskCounts || []).filter((t: any) => t.role_id === role.id).length;

      return {
        ...role,
        holders,
        project_task_count: projectCount,
        template_task_count: templateCount,
      };
    });

    return NextResponse.json(enriched);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, color } = body;

    if (!name) {
      return NextResponse.json({ error: 'Missing required field: name' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('roles')
      .insert({ name, description: description || null, color: color || '#6366f1' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
