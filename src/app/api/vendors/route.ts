import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/vendors
 * Returns all vendors ordered by sort_order, name. Each vendor is returned with
 * its deliverables (project name flattened -> project_name, ordered by sort_order)
 * and its assets (public URL resolved for uploaded files).
 * Shape: { ...vendor, deliverables: [...], assets: [...] }
 */
export async function GET() {
  try {
    const { data: vendors, error: vendorsError } = await supabase
      .from('vendors')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (vendorsError) {
      return NextResponse.json({ error: vendorsError.message }, { status: 500 });
    }

    const result = await Promise.all(
      (vendors || []).map(async (vendor: any) => {
        // Deliverables for this vendor, join project name.
        const { data: deliverables } = await supabase
          .from('vendor_deliverables')
          .select('*, projects(name)')
          .eq('vendor_id', vendor.id)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true });

        const flatDeliverables = (deliverables || []).map((d: any) => ({
          ...d,
          project_name: d.projects?.name || null,
          projects: undefined,
        }));

        // Assets for this vendor.
        const { data: assets } = await supabase
          .from('vendor_assets')
          .select('*')
          .eq('vendor_id', vendor.id)
          .order('created_at', { ascending: false });

        const flatAssets = (assets || []).map((a: any) => ({
          ...a,
          public_url: a.storage_path
            ? supabase.storage.from('vendor-assets').getPublicUrl(a.storage_path).data.publicUrl
            : a.external_url || null,
        }));

        return {
          ...vendor,
          deliverables: flatDeliverables,
          assets: flatAssets,
        };
      })
    );

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/vendors — create a vendor. Requires name.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, contact_name, contact_email, external_folder_url, color, notes, sort_order } = body;

    if (!name) {
      return NextResponse.json({ error: 'Missing required field: name' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('vendors')
      .insert({
        name,
        contact_name: contact_name || null,
        contact_email: contact_email || null,
        external_folder_url: external_folder_url || null,
        color: color || '#647692',
        notes: notes || null,
        sort_order: sort_order ?? 0,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ...data, deliverables: [], assets: [] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
