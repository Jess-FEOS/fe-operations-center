import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; taskId: string } }
) {
  try {
    const { taskId } = params;

    const { data, error } = await supabase
      .from('task_links')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; taskId: string } }
) {
  try {
    const { taskId } = params;
    const body = await request.json();
    const { label, url } = body;

    if (!label || !url) {
      return NextResponse.json(
        { error: 'Missing required fields: label, url' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('task_links')
      .insert({ task_id: taskId, label, url })
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
