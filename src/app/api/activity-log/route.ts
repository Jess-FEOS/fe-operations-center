import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('activity_log')
      .select('*, projects(name)')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const entries = (data || []).map((entry: any) => ({
      id: entry.id,
      project_id: entry.project_id,
      project_name: entry.projects?.name || 'Unknown Project',
      action: entry.action,
      description: entry.description,
      old_value: entry.old_value,
      new_value: entry.new_value,
      created_at: entry.created_at,
    }));

    return NextResponse.json(entries);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
