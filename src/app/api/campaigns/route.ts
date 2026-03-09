import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*, projects(name), monthly_priorities(title)')
      .order('launch_date', { ascending: true, nullsFirst: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Resolve owner details
    const allOwnerIds = new Set<string>();
    for (const c of data || []) {
      for (const oid of c.owner_ids || []) {
        allOwnerIds.add(oid);
      }
    }

    let ownerMap = new Map<string, any>();
    if (allOwnerIds.size > 0) {
      const { data: members } = await supabase
        .from('team_members')
        .select('id, name, initials, color')
        .in('id', Array.from(allOwnerIds));

      for (const m of members || []) {
        ownerMap.set(m.id, m);
      }
    }

    const flattened = (data || []).map((c: any) => ({
      ...c,
      project_name: c.projects?.name || null,
      priority_title: c.monthly_priorities?.title || null,
      owners: (c.owner_ids || []).map((oid: string) => ownerMap.get(oid) || null).filter(Boolean),
      projects: undefined,
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
    const { project_id, priority_id, name, campaign_type, status, launch_date, goal_description, goal_metric, notes, owner_ids } = body;

    if (!name) {
      return NextResponse.json({ error: 'Missing required field: name' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        project_id: project_id || null,
        priority_id: priority_id || null,
        name,
        campaign_type: campaign_type || null,
        status: status || 'not_started',
        launch_date: launch_date || null,
        goal_description: goal_description || null,
        goal_metric: goal_metric || null,
        notes: notes || null,
        owner_ids: owner_ids || [],
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
