import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const SEED_DATA = [
  // March
  { month: '2026-03', title: 'Launch Enterprise Intern', status: 'done', goal: null, target_date: null, sort_order: 1 },
  { month: '2026-03', title: 'Prep Cohort Intern launch marketing Apr 8', status: 'in_progress', goal: null, target_date: null, sort_order: 2 },
  { month: '2026-03', title: 'Start Modeling Academy groundwork', status: 'not_started', goal: null, target_date: null, sort_order: 3 },
  { month: '2026-03', title: 'Invest with AI groundwork', status: 'not_started', goal: null, target_date: null, sort_order: 4 },
  // April
  { month: '2026-04', title: 'Enroll Intern Academy cohort & enterprise', status: 'not_started', goal: null, target_date: null, sort_order: 1 },
  { month: '2026-04', title: 'Finalize Modeling Academy program', status: 'not_started', goal: null, target_date: null, sort_order: 2 },
  { month: '2026-04', title: 'Prep Invest with AI first recording', status: 'not_started', goal: null, target_date: null, sort_order: 3 },
  // May
  { month: '2026-05', title: 'Launch Modeling Academy May 18', status: 'not_started', goal: '50+ sold', target_date: '2026-05-18', sort_order: 1 },
  { month: '2026-05', title: 'Execute Intern Cohort starts May 28', status: 'not_started', goal: null, target_date: '2026-05-28', sort_order: 2 },
  { month: '2026-05', title: 'Launch AI Accelerator early June', status: 'not_started', goal: '100 paying students', target_date: '2026-06-01', sort_order: 3 },
];

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

    return NextResponse.json(data || []);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Seed endpoint
    if (body.action === 'seed') {
      // Check if data already exists
      const { data: existing } = await supabase
        .from('monthly_priorities')
        .select('id')
        .limit(1);

      if (existing && existing.length > 0) {
        return NextResponse.json({ message: 'Data already seeded' });
      }

      const { data, error } = await supabase
        .from('monthly_priorities')
        .insert(SEED_DATA)
        .select();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data, { status: 201 });
    }

    // Normal insert
    const { title, month, status, goal, target_date, sort_order } = body;
    if (!title || !month) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('monthly_priorities')
      .insert({ title, month, status: status || 'not_started', goal: goal || null, target_date: target_date || null, sort_order: sort_order || 0 })
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
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'Missing required fields: id, status' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('monthly_priorities')
      .update({ status })
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
