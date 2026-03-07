import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .select('*');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, role, initials, color } = body;

    if (!name || !role || !initials || !color) {
      return NextResponse.json(
        { error: 'Missing required fields: name, role, initials, color' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('team_members')
      .insert({ name, role, initials, color })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
