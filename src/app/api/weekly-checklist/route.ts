import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get('week_start');

    if (!weekStart) {
      return NextResponse.json({ error: 'week_start is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('weekly_checklist')
      .select('*')
      .eq('week_start', weekStart)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { week_start, description, assigned_to } = body;

    if (!week_start || !description) {
      return NextResponse.json({ error: 'week_start and description are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('weekly_checklist')
      .insert({
        week_start,
        description,
        assigned_to: assigned_to || null,
        is_done: false,
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
