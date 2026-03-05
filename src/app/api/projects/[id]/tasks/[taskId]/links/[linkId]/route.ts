import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; taskId: string; linkId: string } }
) {
  try {
    const { linkId } = params;

    const { error } = await supabase
      .from('task_links')
      .delete()
      .eq('id', linkId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
