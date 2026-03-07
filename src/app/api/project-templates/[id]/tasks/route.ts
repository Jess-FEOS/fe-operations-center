import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Add a task to a template
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const templateId = params.id;
    const body = await request.json();
    const { title, owner, week_number, description } = body;

    if (!title || !owner || week_number === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: title, owner, week_number' },
        { status: 400 }
      );
    }

    // Get next order_index for this template
    const { data: existing } = await supabase
      .from('project_template_tasks')
      .select('order_index')
      .eq('template_id', templateId)
      .order('order_index', { ascending: false })
      .limit(1);

    const nextOrder = (existing && existing.length > 0 ? existing[0].order_index : 0) + 1;

    const { data, error } = await supabase
      .from('project_template_tasks')
      .insert({
        template_id: templateId,
        title,
        owner,
        week_number,
        order_index: nextOrder,
        description: description || null,
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

// Update a task (pass task id in body)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { task_id, title, owner, week_number, order_index, description } = body;

    if (!task_id) {
      return NextResponse.json({ error: 'Missing task_id' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (owner !== undefined) updates.owner = owner;
    if (week_number !== undefined) updates.week_number = week_number;
    if (order_index !== undefined) updates.order_index = order_index;
    if (description !== undefined) updates.description = description;

    const { data, error } = await supabase
      .from('project_template_tasks')
      .update(updates)
      .eq('id', task_id)
      .eq('template_id', params.id)
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

// Delete a task (pass task_id as query param)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('task_id');

    if (!taskId) {
      return NextResponse.json({ error: 'Missing task_id query param' }, { status: 400 });
    }

    const { error } = await supabase
      .from('project_template_tasks')
      .delete()
      .eq('id', taskId)
      .eq('template_id', params.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
