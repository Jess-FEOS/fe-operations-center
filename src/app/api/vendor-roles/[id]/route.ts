import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const BUCKET = 'vendor-assets';

/**
 * GET /api/vendor-roles/[id]?include_archived=false
 * Returns the role, its member team_members, and the deliverables whose
 * EFFECTIVE role matches (assigned person's vendor_role_id, else manual role_id),
 * each flattened with vendor/project/person joins and its vendor_assets.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('include_archived') === 'true';

    const { data: role, error: roleError } = await supabase
      .from('vendor_roles')
      .select('*')
      .eq('id', id)
      .single();

    if (roleError) {
      return NextResponse.json({ error: roleError.message }, { status: 500 });
    }

    const { data: members } = await supabase
      .from('team_members')
      .select('id, name, initials, color, role, vendor_role_id');

    const memberById = new Map<string, any>();
    for (const m of members || []) memberById.set(m.id, m);

    let delivQuery = supabase
      .from('vendor_deliverables')
      .select('*, vendors(name, color), projects(name)')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (!includeArchived) {
      delivQuery = delivQuery.eq('is_archived', false);
    }

    const { data: deliverables, error: delivError } = await delivQuery;

    if (delivError) {
      return NextResponse.json({ error: delivError.message }, { status: 500 });
    }

    function effectiveRoleId(d: any): string | null {
      if (d.assigned_to_id) return memberById.get(d.assigned_to_id)?.vendor_role_id || null;
      return d.role_id || null;
    }

    const matched = (deliverables || []).filter((d: any) => effectiveRoleId(d) === id);
    const matchedIds = matched.map((d: any) => d.id);

    // Assets for all matched deliverables in one query.
    let assetsByDeliverable = new Map<string, any[]>();
    if (matchedIds.length > 0) {
      const { data: assets } = await supabase
        .from('vendor_assets')
        .select('*')
        .in('deliverable_id', matchedIds)
        .order('version', { ascending: false })
        .order('created_at', { ascending: false });

      for (const a of assets || []) {
        const flatAsset = {
          id: a.id,
          deliverable_id: a.deliverable_id,
          file_name: a.file_name,
          file_type: a.file_type,
          file_size: a.file_size,
          version: a.version,
          is_current: a.is_current,
          notes: a.notes,
          public_url: a.storage_path
            ? supabase.storage.from(BUCKET).getPublicUrl(a.storage_path).data.publicUrl
            : a.external_url || null,
        };
        const list = assetsByDeliverable.get(a.deliverable_id) || [];
        list.push(flatAsset);
        assetsByDeliverable.set(a.deliverable_id, list);
      }
    }

    const flatDeliverables = matched.map((d: any) => {
      const assignee = d.assigned_to_id ? memberById.get(d.assigned_to_id) : null;
      const claimer = d.claimed_by_id ? memberById.get(d.claimed_by_id) : null;
      const approver = d.approved_by_id ? memberById.get(d.approved_by_id) : null;
      return {
        ...d,
        vendor_name: d.vendors?.name || null,
        vendor_color: d.vendors?.color || null,
        project_name: d.projects?.name || null,
        assigned_to_name: assignee?.name || null,
        assigned_to_initials: assignee?.initials || null,
        assigned_to_color: assignee?.color || null,
        claimed_by_name: claimer?.name || null,
        approved_by_name: approver?.name || null,
        assets: assetsByDeliverable.get(d.id) || [],
        vendors: undefined,
        projects: undefined,
      };
    });

    return NextResponse.json({
      id: role.id,
      name: role.name,
      color: role.color,
      description: role.description ?? null,
      sort_order: role.sort_order ?? 0,
      members: (members || [])
        .filter((m: any) => m.vendor_role_id === id)
        .map((m: any) => ({ id: m.id, name: m.name, initials: m.initials, color: m.color, role: m.role })),
      deliverables: flatDeliverables,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/vendor-roles/[id] — update role fields.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    const allowedFields = ['name', 'color', 'description', 'sort_order'];
    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (field in body) updates[field] = body[field];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('vendor_roles')
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
