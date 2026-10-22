import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { loadOwnership, enrichOwnership } from '@/lib/ownership-server'
export const dynamic = 'force-dynamic'
export async function GET() {
  try {
    const ownership = await loadOwnership()
    const { data, error } = await supabase.from('project_tasks')
      .select('id,task_name,project_id,role_id,vendor_role_id,status,due_date,owner_ids,projects!inner(name,status)')
      .eq('projects.status', 'active').neq('status', 'done').order('due_date')
    if (error) throw error
    const tasks = (data || []).map(t => ({ ...enrichOwnership(t, ownership),
      project_name: (t.projects as unknown as { name: string }).name }))
    return NextResponse.json(tasks.filter(t => !t.accountable_owner_id))
  } catch {
    return NextResponse.json({ error: 'Could not load ownership alerts. Please retry.' }, { status: 500 })
  }
}
