import {NextResponse} from 'next/server'
import {supabase} from '@/lib/supabase'
export const dynamic='force-dynamic'

// SELECT only. No mutation endpoint or production write exception is introduced.
const selections:Record<string,string>={
  projects:'id,name,status,workflow_type,start_date,launch_date',
  team_members:'id,name,initials,color',
  project_tasks:'id,project_id,task_name,phase,phase_order,task_order,week_number,due_date,status,owner_ids,role_id,task_type,schedule_anchor,schedule_offset_days',
  marketing_content:'id,title,project_id,owner_id,scheduled_date,channels,status,copy_ready,creative_ready,source_task_id,asset_type,target_audience',
  marketing_programs:'id,project_id,marketing_start,program_start,target_audience,goal,notes',
  seminars:'id,title,seminar_date,start_time,client_name,location',
}
export async function GET(){
  if(process.env.VERCEL_ENV==='production' || (process.env.VERCEL_ENV!=='preview' && process.env.OPS_LOCAL_REVIEW!=='true'))
    return NextResponse.json({error:'The practice workspace is available only in a preview.'},{status:403})
  try{
    const records:Record<string,any[]>={}
    for(const [table,columns] of Object.entries(selections)){
      records[table]=[]
      // PostgREST defaults to a row cap: paginate, never silently use partial data.
      for(let from=0;;from+=500){
        if(from>=10000)throw Error('This dataset is too large for a temporary practice copy.')
        const {data,error}=await supabase.from(table).select(columns).order('id').range(from,from+499)
        if(error)throw error
        records[table].push(...(data||[]))
        if((data||[]).length<500)break
      }
    }
    return NextResponse.json({records,loadedAt:new Date().toISOString(),mode:'temporary-practice-copy'},{headers:{'Cache-Control':'no-store'}})
  }catch{
    return NextResponse.json({error:'Could not load a complete practice copy. No partial copy or live changes were saved. Retry.'},{status:503})
  }
}
