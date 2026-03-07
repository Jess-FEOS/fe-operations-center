import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .select('*, roles(id, name, description, color)');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Flatten the role join into the member object
    const enriched = (data || []).map((m: any) => ({
      ...m,
      role_data: m.roles || null,
      roles: undefined,
    }));

    return NextResponse.json(enriched);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, role, initials, color, role_id } = body;

    if (!name || !role || !initials || !color) {
      return NextResponse.json(
        { error: 'Missing required fields: name, role, initials, color' },
        { status: 400 }
      );
    }

    const insert: Record<string, unknown> = { name, role, initials, color };
    if (role_id) insert.role_id = role_id;

    const { data, error } = await supabase
      .from('team_members')
      .insert(insert)
      .select('*, roles(id, name, description, color)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const enriched = {
      ...data,
      role_data: (data as any).roles || null,
      roles: undefined,
    };

    return NextResponse.json(enriched, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
