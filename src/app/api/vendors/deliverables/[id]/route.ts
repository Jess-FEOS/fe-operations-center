import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/vendors/deliverables/[id] — update ANY field, incl. status,
 * comments, dates, recurring, project_id, external_link.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    const allowedFields = [
      'vendor_id', 'project_id', 'deliverable', 'recurring', 'date_assigned',
      'concepts_due', 'due_date', 'status', 'comments', 'external_link', 'sort_order',
      'is_archived', 'archived_at',
    ];

    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('vendor_deliverables')
      .update(updates)
      .eq('id', id)
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

    return NextResponse.json(flattened);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** DELETE /api/vendors/deliverables/[id]. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { error } = await supabase
      .from('vendor_deliverables')
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
