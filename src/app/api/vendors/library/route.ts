import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const BUCKET = 'vendor-assets';

/**
 * GET /api/vendors/library?q=&project_id=&vendor_id=&include_archived=false
 * Returns every asset flattened with vendor / deliverable / project context for
 * the Asset Library page. Filtering is done in JS after flattening.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim().toLowerCase();
    const projectId = searchParams.get('project_id');
    const vendorId = searchParams.get('vendor_id');
    const includeArchived = searchParams.get('include_archived') === 'true';

    let query = supabase
      .from('vendor_assets')
      .select('*, vendors(name,color), vendor_deliverables(deliverable, project_id, projects(name)), projects(name)')
      .order('created_at', { ascending: false });

    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let rows = (data || []).map((a: any) => {
      const public_url = a.storage_path
        ? supabase.storage.from(BUCKET).getPublicUrl(a.storage_path).data.publicUrl
        : a.external_url || null;
      const deliverable_name = a.vendor_deliverables?.deliverable || null;
      const project_name = a.projects?.name || a.vendor_deliverables?.projects?.name || null;
      const project_id_effective = a.project_id || a.vendor_deliverables?.project_id || null;
      return {
        ...a,
        public_url,
        vendor_name: a.vendors?.name || null,
        vendor_color: a.vendors?.color || null,
        deliverable_name,
        project_name,
        project_id_effective,
        vendors: undefined,
        vendor_deliverables: undefined,
        projects: undefined,
      };
    });

    if (projectId) {
      if (projectId === 'none') {
        rows = rows.filter((r: any) => !r.project_id_effective);
      } else {
        rows = rows.filter((r: any) => r.project_id_effective === projectId);
      }
    }

    if (vendorId) {
      rows = rows.filter((r: any) => r.vendor_id === vendorId);
    }

    if (q) {
      rows = rows.filter((r: any) =>
        [r.file_name, r.deliverable_name, r.project_name, r.vendor_name, r.notes]
          .some((v: any) => (v || '').toString().toLowerCase().includes(q))
      );
    }

    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
