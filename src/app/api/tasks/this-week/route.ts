import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const dayOfWeek = now.getDay();
    // Calculate Monday: Sunday (0) needs to go back 6 days, Monday (1) stays, etc.
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const mondayStr = monday.toISOString().split('T')[0];
    const sundayStr = sunday.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('project_tasks')
      .select('*, projects(name, workflow_type)')
      .gte('due_date', mondayStr)
      .lte('due_date', sundayStr);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Flatten the projects join into project_name and workflow_type
    const flattened = (data || []).map((task: any) => ({
      ...task,
      project_name: task.projects?.name || '',
      workflow_type: task.projects?.workflow_type || '',
      projects: undefined,
    }));

    return NextResponse.json(flattened);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
