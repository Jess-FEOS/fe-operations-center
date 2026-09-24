import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { isMarketingRequirement, MarketingRequirement } from '@/lib/marketing-requirements'

export const dynamic = 'force-dynamic'

// Read-only projection of project tasks. No copied tasks, assets, or new tables.
export async function GET() {
  try {
    const { data: roles, error: roleError } = await supabase.from('roles').select('id, name')
    if (roleError) throw roleError
    const roleNames = new Map((roles || []).map(r => [r.id, r.name]))
    const requirements: MarketingRequirement[] = []
    // Avoid silently truncating requirements at Supabase's default row limit.
    const pageSize = 500
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase.from('project_tasks')
        .select('id, project_id, task_name, phase, due_date, status, owner_ids, role_id')
        .order('id').range(offset, offset + pageSize - 1)
      if (error) throw error
      for (const task of data || []) {
        const row: MarketingRequirement = {
          id: task.id, project_id: task.project_id, task_name: task.task_name,
          phase: task.phase || '', due_date: task.due_date, status: task.status,
          owner_ids: task.owner_ids || [], role_name: roleNames.get(task.role_id) || null,
        }
        if (isMarketingRequirement(row)) requirements.push(row)
      }
      if (!data || data.length < pageSize) break
    }
    return NextResponse.json(requirements)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Could not load project marketing requirements.' }, { status: 500 })
  }
}
