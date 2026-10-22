import { NextRequest, NextResponse } from 'next/server'
import { loadWorkspace } from '@/lib/workspace-server'
import { shiftDays } from '@/lib/project-schedule'
export const dynamic = 'force-dynamic'
export async function GET(request: NextRequest) {
  try {
    const window = request.nextUrl.searchParams.get('window') || 'week'
    const data = await loadWorkspace(false)
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Phoenix', year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date())
    const day = new Date(today + 'T00:00:00Z').getUTCDay()
    const monday = shiftDays(today, -(day + 6) % 7), sunday = shiftDays(monday, 6)
    const inWindow = (w: { due_date: string | null }) => window === 'all' || (!!w.due_date && w.due_date <= sunday)
    const visible = data.work.filter(inWindow)
    const people = data.people.map(p => {
      const items = visible.filter(w => w.accountable_owner_id === p.id)
        .map(w => ({ ...w, role_name: data.groups.find(r => r.id === w.role_id)?.name || '' }))
        .sort((a,b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'))
      return { ...p, roles: data.groups.filter(g => g.holders.some((h: {id:string}) => h.id === p.id)).map(g => ({ id:g.id,name:g.name,color:g.color })),
        item_count: items.length, items }
    }).sort((a,b) => b.item_count-a.item_count || a.name.localeCompare(b.name))
    // Unresolved commitments stay visible, rather than being assigned to every role holder.
    const unresolved = visible.filter(w => !w.accountable_owner_id)
    if (unresolved.length) people.push({ id:'unassigned',name:'Ownership needs review',initials:'?',color:'#B45309',
      roles:[],item_count:unresolved.length,items:unresolved.map(w=>({...w,role_name:''})) })
    return NextResponse.json({ window,week_start:monday,week_end:sunday,total_items:visible.length,people })
  } catch { return NextResponse.json({ error:'Could not load the complete weekly review. Please retry.' }, {status:500}) }
}
