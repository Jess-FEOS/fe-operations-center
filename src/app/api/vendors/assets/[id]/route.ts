import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const BUCKET = 'vendor-assets';

/**
 * PATCH /api/vendors/assets/[id] — update allowed fields (archive, versioning,
 * notes, project, deliverable, current flag). Resolves public_url in response.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    const allowedFields = [
      'deliverable_id', 'project_id', 'file_name', 'notes',
      'is_archived', 'archived_at', 'version', 'is_current',
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
      .from('vendor_assets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const public_url = data.storage_path
      ? supabase.storage.from(BUCKET).getPublicUrl(data.storage_path).data.publicUrl
      : data.external_url || null;

    return NextResponse.json({ ...data, public_url });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/vendors/assets/[id] — remove the asset row, and if it was an
 * uploaded file (storage_path set) also remove the object from storage.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Look up the storage path first (if any) so we can clean up storage.
    const { data: asset } = await supabase
      .from('vendor_assets')
      .select('storage_path')
      .eq('id', id)
      .single();

    if (asset?.storage_path) {
      await supabase.storage.from(BUCKET).remove([asset.storage_path]);
    }

    const { error } = await supabase.from('vendor_assets').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
