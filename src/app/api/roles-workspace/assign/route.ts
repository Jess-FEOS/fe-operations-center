import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/roles-workspace/assign
 *
 * Set the holder(s) of a role, OR set the role(s) a person holds. Because work
 * is owned by the ROLE (project_tasks.vendor_role_id, and deliverables via the
 * holder's primary vendor_role_id), updating the join table here IS the cascade
 * — everything that role owns instantly resolves to the new holder.
 *
 * Two modes (pick one):
 *   1. { mode: 'role_holders', role_id, member_ids: string[] }
 *        Replace the full set of holders for a role.
 *   2. { mode: 'member_roles', member_id, role_ids: string[] }
 *        Replace the full set of roles a person holds.
 *
 * In both modes we also keep team_members.vendor_role_id (the "primary" role,
 * used to resolve deliverables) pointed at a sensible value for back-compat.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const mode = body.mode as 'role_holders' | 'member_roles';

    if (mode === 'role_holders') {
      const roleId = body.role_id as string;
      const memberIds = (body.member_ids as string[]) || [];
      if (!roleId) return NextResponse.json({ error: 'role_id required' }, { status: 400 });

      // Who held this role before? (to fix their primary if it pointed here)
      const { data: prior } = await supabase
        .from('team_member_roles')
        .select('team_member_id')
        .eq('vendor_role_id', roleId);
      const priorIds = new Set((prior || []).map((r) => r.team_member_id));

      // Replace holders: delete all rows for this role, then insert the new set.
      const { error: delErr } = await supabase
        .from('team_member_roles')
        .delete()
        .eq('vendor_role_id', roleId);
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

      if (memberIds.length) {
        const rows = memberIds.map((mid) => ({ team_member_id: mid, vendor_role_id: roleId }));
        const { error: insErr } = await supabase.from('team_member_roles').insert(rows);
        if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
      }

      // New holders: set their primary to this role if they don't already have one.
      for (const mid of memberIds) {
        const { data: m } = await supabase
          .from('team_members')
          .select('vendor_role_id')
          .eq('id', mid)
          .single();
        if (m && !m.vendor_role_id) {
          await supabase.from('team_members').update({ vendor_role_id: roleId }).eq('id', mid);
        }
      }

      // Removed holders whose primary was this role: repoint primary to any
      // remaining role they still hold, else null.
      for (const pid of Array.from(priorIds)) {
        if (memberIds.includes(pid)) continue; // still a holder
        const { data: m } = await supabase
          .from('team_members')
          .select('vendor_role_id')
          .eq('id', pid)
          .single();
        if (m && m.vendor_role_id === roleId) {
          const { data: remaining } = await supabase
            .from('team_member_roles')
            .select('vendor_role_id')
            .eq('team_member_id', pid)
            .limit(1);
          const next = remaining && remaining.length ? remaining[0].vendor_role_id : null;
          await supabase.from('team_members').update({ vendor_role_id: next }).eq('id', pid);
        }
      }

      return NextResponse.json({ success: true });
    }

    if (mode === 'member_roles') {
      const memberId = body.member_id as string;
      const roleIds = (body.role_ids as string[]) || [];
      if (!memberId) return NextResponse.json({ error: 'member_id required' }, { status: 400 });

      const { error: delErr } = await supabase
        .from('team_member_roles')
        .delete()
        .eq('team_member_id', memberId);
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

      if (roleIds.length) {
        const rows = roleIds.map((rid) => ({ team_member_id: memberId, vendor_role_id: rid }));
        const { error: insErr } = await supabase.from('team_member_roles').insert(rows);
        if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
      }

      // Keep primary in sync: if current primary is no longer held, repoint to
      // the first of the new set (or null).
      const { data: m } = await supabase
        .from('team_members')
        .select('vendor_role_id')
        .eq('id', memberId)
        .single();
      const primaryStillHeld = m && m.vendor_role_id && roleIds.includes(m.vendor_role_id);
      if (!primaryStillHeld) {
        const next = roleIds.length ? roleIds[0] : null;
        await supabase.from('team_members').update({ vendor_role_id: next }).eq('id', memberId);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "mode must be 'role_holders' or 'member_roles'" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
