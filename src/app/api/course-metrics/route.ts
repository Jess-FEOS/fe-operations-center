import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('course_metrics')
      .select('*, projects(id, name, workflow_type, start_date)')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const flattened = (data || []).map((m: any) => ({
      ...m,
      project_name: m.projects?.name || '',
      project_workflow_type: m.projects?.workflow_type || '',
      project_start_date: m.projects?.start_date || '',
      projects: undefined,
    }));

    return NextResponse.json(flattened);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id, enrollment_count, revenue, email_open_rate, email_click_rate, notes } = body;

    if (!project_id) {
      return NextResponse.json({ error: 'Missing required field: project_id' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('course_metrics')
      .insert({
        project_id,
        enrollment_count: enrollment_count || 0,
        revenue: revenue || 0,
        email_open_rate: email_open_rate || null,
        email_click_rate: email_click_rate || null,
        notes: notes || null,
      })
      .select('*, projects(id, name, workflow_type, start_date)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const flattened = {
      ...data,
      project_name: (data as any).projects?.name || '',
      project_workflow_type: (data as any).projects?.workflow_type || '',
      project_start_date: (data as any).projects?.start_date || '',
      projects: undefined,
    };

    return NextResponse.json(flattened, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
