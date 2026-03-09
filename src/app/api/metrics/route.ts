import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const project_id = searchParams.get('project_id');
    const campaign_id = searchParams.get('campaign_id');
    const metric_name = searchParams.get('metric_name');

    let query = supabase
      .from('metrics')
      .select('*, projects(name), campaigns(name), monthly_priorities(title)')
      .order('metric_date', { ascending: false });

    if (project_id) {
      query = query.eq('project_id', project_id);
    }
    if (campaign_id) {
      query = query.eq('campaign_id', campaign_id);
    }
    if (metric_name) {
      query = query.eq('metric_name', metric_name);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const flattened = (data || []).map((m: any) => ({
      ...m,
      project_name: m.projects?.name || null,
      campaign_name: m.campaigns?.name || null,
      priority_title: m.monthly_priorities?.title || null,
      projects: undefined,
      campaigns: undefined,
      monthly_priorities: undefined,
    }));

    return NextResponse.json(flattened);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id, campaign_id, priority_id, metric_name, metric_value, metric_date, notes } = body;

    if (!metric_name || metric_value === undefined || !metric_date) {
      return NextResponse.json(
        { error: 'Missing required fields: metric_name, metric_value, metric_date' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('metrics')
      .insert({
        project_id: project_id || null,
        campaign_id: campaign_id || null,
        priority_id: priority_id || null,
        metric_name,
        metric_value,
        metric_date,
        notes: notes || null,
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
