import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; taskId: string } }
) {
  try {
    const { taskId } = params;
    const body = await request.json();
    const { depends_on_task_id } = body;

    if (!depends_on_task_id) {
      return NextResponse.json(
        { error: 'Missing required field: depends_on_task_id' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('task_dependencies')
      .insert({ task_id: taskId, depends_on_task_id })
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; taskId: string } }
) {
  try {
    const { taskId } = params;
    const { searchParams } = new URL(request.url);
    const dependsOnId = searchParams.get('depends_on_task_id');

    if (!dependsOnId) {
      return NextResponse.json(
        { error: 'Missing query param: depends_on_task_id' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('task_dependencies')
      .delete()
      .eq('task_id', taskId)
      .eq('depends_on_task_id', dependsOnId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
