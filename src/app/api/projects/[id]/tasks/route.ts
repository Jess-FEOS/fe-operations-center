import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { task_name, phase, phase_order, owner_ids, role_id } = body;

    if (!task_name || !phase) {
      return NextResponse.json(
        { error: 'Missing required fields: task_name, phase' },
        { status: 400 }
      );
    }

    if (!role_id) {
      return NextResponse.json(
        { error: 'role_id is required. Every task must be assigned to a role.' },
        { status: 400 }
      );
    }

    // Get the max task_order in this phase to append at the end
    const { data: existing } = await supabase
      .from('project_tasks')
      .select('task_order')
      .eq('project_id', id)
      .eq('phase', phase)
      .order('task_order', { ascending: false })
      .limit(1);

    const nextOrder = existing && existing.length > 0 ? existing[0].task_order + 1 : 1;

    // Get the project's start_date for due_date calculation
    const { data: project } = await supabase
      .from('projects')
      .select('start_date')
      .eq('id', id)
      .single();

    const startDate = project?.start_date || new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('project_tasks')
      .insert({
        project_id: id,
        task_name,
        phase,
        phase_order: phase_order || 1,
        task_order: nextOrder,
        due_date: startDate,
        week_number: 1,
        status: 'not_started',
        owner_ids: owner_ids || [],
        role_id,
      })
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
