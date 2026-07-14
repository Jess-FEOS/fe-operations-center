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

    // Optional activity descriptor — pulled out so it isn't written as a column.
    const activity = body.activity as
      | { action: string; actor_id?: string | null; actor_name?: string | null; detail?: string | null }
      | undefined;

    const allowedFields = [
      'vendor_id', 'project_id', 'deliverable', 'recurring', 'date_assigned',
      'concepts_due', 'due_date', 'status', 'comments', 'external_link', 'sort_order',
      'is_archived', 'archived_at',
      // Role workspace: assignment, claim, approval, manual role tag.
      'assigned_to_id', 'claimed_by_id', 'claimed_at',
      'approved_by_id', 'approved_at', 'review_state', 'role_id',
      // Ready signal + request-changes tracking.
      'ready_at', 'ready_by_id', 'changes_requested_at', 'changes_requested_by_id',
    ];

    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0 && !activity) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    let data: any;
    if (Object.keys(updates).length > 0) {
      const res = await supabase
        .from('vendor_deliverables')
        .update(updates)
        .eq('id', id)
        .select('*, projects(name)')
        .single();
      if (res.error) {
        return NextResponse.json({ error: res.error.message }, { status: 500 });
      }
      data = res.data;
    } else {
      const res = await supabase
        .from('vendor_deliverables')
        .select('*, projects(name)')
        .eq('id', id)
        .single();
      if (res.error) {
        return NextResponse.json({ error: res.error.message }, { status: 500 });
      }
      data = res.data;
    }

    // Best-effort activity log write (never blocks the update).
    if (activity?.action) {
      try {
        await supabase.from('vendor_deliverable_activity').insert({
          deliverable_id: id,
          action: activity.action,
          actor_id: activity.actor_id || null,
          actor_name: activity.actor_name || null,
          detail: activity.detail || null,
        });
      } catch (_) {
        /* non-fatal */
      }
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
