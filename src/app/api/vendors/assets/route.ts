import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const BUCKET = 'vendor-assets';

function toPublicUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * POST /api/vendors/assets — two modes, detected by content-type header:
 *
 * (a) multipart/form-data: upload a File to Supabase Storage bucket 'vendor-assets'
 *     at `${vendor_id}/${Date.now()}_${safeName}`, then insert a vendor_assets row
 *     with storage_path + file_type (mime) + file_size + file_name. Optional
 *     deliverable_id. Returns the row plus a public_url.
 *
 * (b) application/json: { vendor_id, deliverable_id?, file_name, external_url }
 *     inserts a link-only asset row.
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    // ── Mode A: multipart file upload ────────────────────────────────────
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const vendorId = formData.get('vendor_id') as string | null;
      const deliverableId = formData.get('deliverable_id') as string | null;
      const projectId = formData.get('project_id') as string | null;
      const notes = formData.get('notes') as string | null;
      const versionRaw = formData.get('version') as string | null;
      const isCurrentRaw = formData.get('is_current') as string | null;
      const uploadedBy = formData.get('uploaded_by') as string | null;
      const file = formData.get('file') as File | null;

      const version = versionRaw ? parseInt(versionRaw, 10) || 1 : 1;
      const isCurrent = isCurrentRaw === null ? true : isCurrentRaw !== 'false';

      if (!vendorId) {
        return NextResponse.json({ error: 'Missing required field: vendor_id' }, { status: 400 });
      }
      if (!file || typeof (file as any).arrayBuffer !== 'function') {
        return NextResponse.json({ error: 'Missing required file' }, { status: 400 });
      }

      const safeName = (file.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${vendorId}/${Date.now()}_${safeName}`;
      const buf = await file.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, Buffer.from(buf), { contentType: file.type || 'application/octet-stream' });

      if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 500 });
      }

      // Demote existing current versions for this deliverable so only the newest is current.
      if (deliverableId && isCurrent) {
        await supabase.from('vendor_assets').update({ is_current: false }).eq('deliverable_id', deliverableId);
      }

      const { data, error } = await supabase
        .from('vendor_assets')
        .insert({
          vendor_id: vendorId,
          deliverable_id: deliverableId || null,
          project_id: projectId || null,
          file_name: file.name || safeName,
          storage_path: path,
          external_url: null,
          file_type: file.type || null,
          file_size: file.size || null,
          uploaded_by: uploadedBy || null,
          notes: notes || null,
          version,
          is_current: isCurrent,
        })
        .select()
        .single();

      if (error) {
        // Roll back the uploaded object if the DB insert fails.
        await supabase.storage.from(BUCKET).remove([path]);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ ...data, public_url: toPublicUrl(path) }, { status: 201 });
    }

    // ── Mode B: JSON link-only asset ─────────────────────────────────────
    const body = await request.json();
    const { vendor_id, deliverable_id, project_id, file_name, external_url, uploaded_by, notes } = body;
    const version = body.version ?? 1;
    const is_current = body.is_current ?? true;

    if (!vendor_id || !file_name || !external_url) {
      return NextResponse.json(
        { error: 'Missing required fields: vendor_id, file_name, external_url' },
        { status: 400 }
      );
    }

    // Demote existing current versions for this deliverable so only the newest is current.
    if (deliverable_id && is_current) {
      await supabase.from('vendor_assets').update({ is_current: false }).eq('deliverable_id', deliverable_id);
    }

    const { data, error } = await supabase
      .from('vendor_assets')
      .insert({
        vendor_id,
        deliverable_id: deliverable_id || null,
        project_id: project_id || null,
        file_name,
        storage_path: null,
        external_url,
        file_type: 'link',
        file_size: null,
        uploaded_by: uploaded_by || null,
        notes: notes || null,
        version,
        is_current,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ...data, public_url: external_url }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
