import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/vendor-roles
 * Returns all vendor_roles ordered by sort_order, name. Each role is attached
 * with its member team_members and a count of non-archived deliverables whose
 * EFFECTIVE role matches (assigned person's vendor_role_id, else manual role_id).
 */
export async function GET() {
  try {
    const { data: roles, error: rolesError } = await supabase
      .from('vendor_roles')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (rolesError) {
      return NextResponse.json({ error: rolesError.message }, { status: 500 });
    }

    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select('id, name, initials, color, role, vendor_role_id');

    if (membersError) {
      return NextResponse.json({ error: membersError.message }, { status: 500 });
    }

    const { data: deliverables, error: delivError } = await supabase
      .from('vendor_deliverables')
      .select('id, assigned_to_id, role_id, is_archived')
      .eq('is_archived', false);

    if (delivError) {
      return NextResponse.json({ error: delivError.message }, { status: 500 });
    }

    const memberRole = new Map<string, string | null>();
    for (const m of members || []) {
      memberRole.set(m.id, m.vendor_role_id || null);
    }

    function effectiveRoleId(d: any): string | null {
      if (d.assigned_to_id) return memberRole.get(d.assigned_to_id) || null;
      return d.role_id || null;
    }

    const result = (roles || []).map((role: any) => ({
      id: role.id,
      name: role.name,
      color: role.color,
      description: role.description ?? null,
      sort_order: role.sort_order ?? 0,
      members: (members || [])
        .filter((m: any) => m.vendor_role_id === role.id)
        .map((m: any) => ({ id: m.id, name: m.name, initials: m.initials, color: m.color, role: m.role })),
      deliverable_count: (deliverables || []).filter((d: any) => effectiveRoleId(d) === role.id).length,
    }));

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/vendor-roles — create a role. Requires name.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, color, description, sort_order } = body;

    if (!name) {
      return NextResponse.json({ error: 'Missing required field: name' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('vendor_roles')
      .insert({
        name,
        color: color || '#647692',
        description: description || null,
        sort_order: sort_order ?? 0,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ...data, members: [], deliverable_count: 0 }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
