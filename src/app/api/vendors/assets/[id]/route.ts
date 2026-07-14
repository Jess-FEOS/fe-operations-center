import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const BUCKET = 'vendor-assets';

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
