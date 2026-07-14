import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/vendors/deliverables — create a deliverable.
 * Requires vendor_id + deliverable.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      vendor_id, project_id, deliverable, recurring, date_assigned,
      concepts_due, due_date, status, comments, external_link, sort_order,
    } = body;

    if (!vendor_id || !deliverable) {
      return NextResponse.json(
        { error: 'Missing required fields: vendor_id, deliverable' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('vendor_deliverables')
      .insert({
        vendor_id,
        project_id: project_id || null,
        deliverable,
        recurring: recurring ?? false,
        date_assigned: date_assigned || null,
        concepts_due: concepts_due || null,
        due_date: due_date || null,
        status: status || 'not_started',
        comments: comments || null,
        external_link: external_link || null,
        sort_order: sort_order ?? 0,
      })
      .select('*, projects(name)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const flattened = {
      ...data,
      project_name: (data as any).projects?.name || null,
      projects: undefined,
    };

    return NextResponse.json(flattened, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
