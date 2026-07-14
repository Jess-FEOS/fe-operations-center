import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/** PATCH /api/vendors/[id] — update vendor fields. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    const allowedFields = [
      'name', 'contact_name', 'contact_email', 'external_folder_url',
      'color', 'notes', 'sort_order',
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
      .from('vendors')
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

/** DELETE /api/vendors/[id] — cascade FK removes child deliverables & assets. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Best-effort: remove any uploaded storage objects for this vendor before
    // the DB rows cascade away (storage is not cascaded by the FK).
    const { data: assets } = await supabase
      .from('vendor_assets')
      .select('storage_path')
      .eq('vendor_id', id);

    const paths = (assets || [])
      .map((a: any) => a.storage_path)
      .filter((p: string | null): p is string => !!p);

    if (paths.length > 0) {
      await supabase.storage.from('vendor-assets').remove(paths);
    }

    const { error } = await supabase.from('vendors').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
