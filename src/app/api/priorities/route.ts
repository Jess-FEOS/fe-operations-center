import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const SEED_DATA = [
  // March
  { month: '2026-03', title: 'Launch Enterprise Intern', status: 'done', goal: null, target_date: null, sort_order: 1 },
  { month: '2026-03', title: 'Prep Cohort Intern - launch marketing April 8th', status: 'in_progress', goal: null, target_date: null, sort_order: 2 },
  { month: '2026-03', title: 'Start getting serious about Modeling - decks, marketing, recording prep', status: 'not_started', goal: null, target_date: null, sort_order: 3 },
  { month: '2026-03', title: 'Do groundwork for Invest with AI', status: 'not_started', goal: null, target_date: null, sort_order: 4 },
  // April
  { month: '2026-04', title: 'Enroll Intern Academy - cohort & enterprise', status: 'not_started', goal: null, target_date: null, sort_order: 1 },
  { month: '2026-04', title: 'Finalize Modeling Academy program', status: 'not_started', goal: null, target_date: null, sort_order: 2 },
  { month: '2026-04', title: 'Prep Invest with AI - first recording second half of April', status: 'not_started', goal: null, target_date: null, sort_order: 3 },
  // May
  { month: '2026-05', title: 'Launch Modeling Academy', status: 'not_started', goal: '50+ sold', target_date: '2026-05-18', sort_order: 1 },
  { month: '2026-05', title: 'Execute Intern Cohort - start date May 28', status: 'not_started', goal: null, target_date: '2026-05-28', sort_order: 2 },
  { month: '2026-05', title: 'Do groundwork for June AI Accelerator launch', status: 'not_started', goal: '100 paying students', target_date: null, sort_order: 3 },
];

async function enrichPrioritiesWithProjects(priorities: any[]) {
  if (!priorities || priorities.length === 0) return priorities;

  // Get project IDs linked to these priorities
  const projectIds = priorities
    .map((p) => p.project_id)
    .filter(Boolean);

  if (projectIds.length === 0) {
    return priorities.map((p) => ({
      ...p,
      project_name: null,
      project_status: null,
      project_progress: null,
    }));
  }

  // Fetch linked projects
  const { data: linkedProjects } = await supabase
    .from('projects')
    .select('id, name, status')
    .in('id', projectIds);

  // Fetch task counts for progress calculation
  const { data: allTasks } = await supabase
    .from('project_tasks')
    .select('project_id, status')
    .in('project_id', projectIds);

  const projectMap = new Map<string, any>();
  for (const proj of linkedProjects || []) {
    const tasks = (allTasks || []).filter((t) => t.project_id === proj.id);
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === 'done').length;
    projectMap.set(proj.id, {
      name: proj.name,
      status: proj.status,
      progress: total > 0 ? Math.round((done / total) * 100) : 0,
    });
  }

  return priorities.map((p) => {
    const proj = p.project_id ? projectMap.get(p.project_id) : null;
    return {
      ...p,
      project_name: proj?.name || null,
      project_status: proj?.status || null,
      project_progress: proj?.progress ?? null,
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');

    let query = supabase
      .from('monthly_priorities')
      .select('*')
      .order('sort_order', { ascending: true });

    if (month) {
      query = query.eq('month', month);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Auto-seed if table is empty
    if (!data || data.length === 0) {
      const { data: seeded, error: seedError } = await supabase
        .from('monthly_priorities')
        .insert(SEED_DATA)
        .select();

      if (seedError) {
        return NextResponse.json({ error: seedError.message }, { status: 500 });
      }

      let result = seeded || [];
      if (month) {
        result = result.filter((p: any) => p.month === month);
      }
      return NextResponse.json(await enrichPrioritiesWithProjects(result));
    }

    return NextResponse.json(await enrichPrioritiesWithProjects(data));
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, month, status, goal, target_date, project_id } = body;

    if (!title || !month) {
      return NextResponse.json({ error: 'Missing required fields: title, month' }, { status: 400 });
    }

    // Get next sort_order for this month
    const { data: existing } = await supabase
      .from('monthly_priorities')
      .select('sort_order')
      .eq('month', month)
      .order('sort_order', { ascending: false })
      .limit(1);

    const nextOrder = (existing && existing.length > 0 ? existing[0].sort_order : 0) + 1;

    const { data, error } = await supabase
      .from('monthly_priorities')
      .insert({
        title,
        month,
        status: status || 'not_started',
        goal: goal || null,
        target_date: target_date || null,
        sort_order: nextOrder,
        project_id: project_id || null,
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

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (body.status !== undefined) updates.status = body.status;
    if (body.title !== undefined) updates.title = body.title;
    if (body.month !== undefined) updates.month = body.month;
    if (body.goal !== undefined) updates.goal = body.goal;
    if (body.target_date !== undefined) updates.target_date = body.target_date;
    if (body.project_id !== undefined) updates.project_id = body.project_id;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('monthly_priorities')
      .update(updates)
      .eq('id', id)
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

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 });
    }

    const { error } = await supabase
      .from('monthly_priorities')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
