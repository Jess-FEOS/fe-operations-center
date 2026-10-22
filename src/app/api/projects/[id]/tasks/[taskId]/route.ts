import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { loadOwnership, enrichOwnership } from '@/lib/ownership-server';
import { validDate } from '@/lib/project-schedule';
import { validCompanyTaskKind } from '@/lib/company-calendar';
import { resolveOwnership } from '@/lib/ownership';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id, taskId } = await params;
    const body = await request.json();
    const ownership = await loadOwnership();
    if (body.owner_ids !== undefined && (!Array.isArray(body.owner_ids) || body.owner_ids.length !== 1 ||
      !ownership.people.some(p => p.id === body.owner_ids[0]))) {
      return NextResponse.json({ error: 'Choose exactly one accountable owner.' }, { status: 400 });
    }
    if (body.status !== undefined && !['not_started','in_progress','done','blocked'].includes(body.status)) {
      return NextResponse.json({ error: 'Invalid task status.' }, { status: 400 });
    }
    if (body.due_date !== undefined && !validDate(body.due_date)) {
      return NextResponse.json({ error: 'A valid deadline is required.' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (body.company_calendar_kind !== undefined) {
      if (!validCompanyTaskKind(body.company_calendar_kind))
        return NextResponse.json({ error:'Choose a client deliverable, client session, or not shown.' }, { status:400 });
      const { data: current, error } = await supabase.from('project_tasks').select('*').eq('id', taskId).eq('project_id', id).single();
      if (error || !current) return NextResponse.json({ error:'Task not found.' }, { status:404 });
      if (!Object.prototype.hasOwnProperty.call(current,'company_calendar_kind'))
        return NextResponse.json({ error:'Company calendar task settings require the approved database update.' }, { status:503 });
      if (body.company_calendar_kind !== null) {
        const { data: project, error: projectError } = await supabase.from('projects').select('*').eq('id', id).single();
        if (projectError || !project) return NextResponse.json({ error:'Could not read project.' }, { status:500 });
        if (!project.is_enterprise) return NextResponse.json({ error:'Set this project up as an enterprise engagement first.' }, { status:400 });
        const resolved = resolveOwnership({...current, ...(body.owner_ids !== undefined ? {owner_ids:body.owner_ids} : {})}, ownership.people, ownership.joins);
        if (!resolved.accountable_owner_id)
          return NextResponse.json({ error:'Choose one accountable owner before adding a client commitment to the calendar.' }, { status:400 });
      }
      updates.company_calendar_kind = body.company_calendar_kind;
    }
    if (body.status !== undefined) updates.status = body.status;
    if (body.task_name !== undefined) updates.task_name = body.task_name;
    if (body.owner_ids !== undefined) {
      updates.owner_ids = body.owner_ids;
      updates.vendor_role_id = ownership.people.find(p => p.id === body.owner_ids[0])?.vendor_role_id || null;
    }
    if (body.role_id !== undefined) updates.role_id = body.role_id;
    if (body.due_date !== undefined) {
      updates.due_date = body.due_date;
      // Only an actual manual date change detaches the task from its anchor.
      const { data: current, error } = await supabase.from('project_tasks')
        .select('due_date').eq('id', taskId).eq('project_id', id).single();
      if (error || !current) return NextResponse.json({ error: 'Could not read task deadline.' }, { status: 500 });
      if (current.due_date !== body.due_date) {
        updates.schedule_anchor = 'fixed';
        updates.schedule_offset_days = null;
      }
    }
    // on_hold is not a column in the current schema. Keep the existing blocked status instead.
    if (body.on_hold === true && body.status !== 'done') updates.status = 'blocked';
    if (body.follow_up_date !== undefined) updates.follow_up_date = body.follow_up_date;
    if (body.phase !== undefined) updates.phase = body.phase;

    // Prevent clearing role_id — tasks must always have a role
    if (body.role_id === null || body.role_id === '') {
      return NextResponse.json(
        { error: 'role_id cannot be removed. Every task must be assigned to a role.' },
        { status: 400 }
      );
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('project_tasks')
      .update(updates)
      .eq('id', taskId)
      .eq('project_id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Progress is derived on read. Task completion does not silently change
    // project visibility, priority state, or archived history.
    return NextResponse.json(enrichOwnership(data, ownership));
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id, taskId } = await params;

    const { error } = await supabase
      .from('project_tasks')
      .delete()
      .eq('id', taskId)
      .eq('project_id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
