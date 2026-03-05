import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!from || !to) {
      return NextResponse.json(
        { error: 'Missing required query params: from, to' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('project_tasks')
      .select('*, projects(id, name, workflow_type)')
      .gte('due_date', from)
      .lte('due_date', to)
      .order('due_date', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const flattened = (data || []).map((task: any) => ({
      ...task,
      project_name: task.projects?.name || '',
      project_id: task.projects?.id || task.project_id,
      workflow_type: task.projects?.workflow_type || '',
      projects: undefined,
    }));

    return NextResponse.json(flattened);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
