import {UpdateBatch,UpdateProposal,validInputDate} from './update-intake'
import {scheduledDate,validateDates,validRule} from './project-schedule'

// Pure, isolated practice-workspace engine. No database/network imports.
// Null/omitted proposal fields never erase an existing value.
export const TABLES=['projects','team_members','project_tasks','marketing_content','marketing_programs','seminars'] as const
export type Table=typeof TABLES[number]
export type RecordRow=Record<string,any> & {id:string}
export type Records=Record<Table,RecordRow[]>
export interface Change {table:Table;id:string;title:string;before:RecordRow|null;after:RecordRow;reason:string}
export interface Receipt {id:string;intent:string;reviewer:string;at:string;changes:Change[];sources:{title:string;evidence:string;source_ref:string|null}[];undone:boolean}
export interface Workspace {records:Records;version:number;loadedAt:string;history:Receipt[]}
export interface Resolution {
  action?:'create'|'update'|'clarify';projectId?:string;ownerId?:string;targetId?:string
  date?:string;status?:string;phase?:string;acknowledged?:boolean
  programFields?:{goal?:string;target_audience?:string;notes?:string}
}
export interface ReviewRow {index:number;title:string;outcome:'ready'|'duplicate'|'blocked';issues:string[];targetId:string|null}
export interface ReviewPlan {version:number;rows:ReviewRow[];changes:Change[];issues:string[];signature:string}
const clone=<T,>(v:T):T=>JSON.parse(JSON.stringify(v))
const norm=(v:any)=>String(v??'').trim().replace(/\s+/g,' ').toLowerCase()
function canonical(value:any):string {
  if(value===undefined)return 'null'
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']'
  if(value && typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}'
  return JSON.stringify(value)
}
const same=(a:any,b:any)=>canonical(a)===canonical(b)
const areaTable:Record<string,Table>={marketing:'marketing_content',project_task:'project_tasks',project_dates:'projects',program:'marketing_programs',seminar:'seminars'}
const nameOf=(r:RecordRow)=>r.title || r.task_name || r.name || 'Marketing program'
export function tableFor(area:string):Table {return areaTable[area]}
export function newWorkspace(records:Records,loadedAt:string):Workspace {
  for(const table of TABLES)if(!Array.isArray(records[table]) || new Set(records[table].map(r=>r.id)).size!==records[table].length)throw Error('Invalid practice-copy records.')
  return {records:clone(records),version:0,loadedAt,history:[]}
}
function resolveNamed(rows:RecordRow[],name:string|null,choice:string|undefined):RecordRow|undefined {
  if(choice!==undefined)return rows.find(r=>r.id===choice)
  const hits=rows.filter(r=>norm(r.name)===norm(name))
  return hits.length===1?hits[0]:undefined
}
export function resolvedProject(w:Workspace,p:UpdateProposal,r:Resolution) {return resolveNamed(w.records.projects,p.project,r.projectId)}
export function resolvedOwner(w:Workspace,p:UpdateProposal,r:Resolution) {return resolveNamed(w.records.team_members,p.owner,r.ownerId)}
export function candidates(w:Workspace,p:UpdateProposal,r:Resolution):RecordRow[] {
  const project=resolvedProject(w,p,r)
  if(p.area==='project_dates')return project?[project]:[]
  if(p.area==='seminar')return w.records.seminars
  return w.records[tableFor(p.area)].filter(x=>x.project_id===(project?.id || null))
}
function statusFor(area:string,value:string|null|undefined):string|undefined {
  if(!value?.trim())return undefined
  const key=norm(value).replaceAll('_',' ')
  const maps:Record<string,Record<string,string>>={
    marketing:{idea:'idea',planned:'idea','not started':'idea',draft:'drafted',drafted:'drafted',scheduled:'scheduled',posted:'posted',published:'posted'},
    project_task:{'not started':'not_started',todo:'not_started','in progress':'in_progress',done:'done',completed:'done',blocked:'blocked'},
  }
  const status=maps[area]?.[key]
  if(!status)throw Error(area==='marketing'?'Use Idea, Drafted, Scheduled or Posted. Done alone does not prove publication.':'Use Not started, In progress, Done or Blocked.')
  return status
}
export function reviewBatch(w:Workspace,batch:UpdateBatch,resolutions:Record<number,Resolution>,selected:number[]):ReviewPlan {
  const rows:ReviewRow[]=[],changes:Change[]=[],issues:string[]=[]
  const chosen=[...new Set(selected)].sort((a,b)=>a-b)
  if(chosen.some(i=>!Number.isInteger(i)||i<0||i>=batch.updates.length))throw Error('Invalid selected proposals.')
  const put=(table:Table,before:RecordRow|null,after:RecordRow,reason:string)=>{
    if(before && same(before,after))return false
    const found=changes.find(c=>c.table===table && c.id===after.id)
    if(found){
      for(const key of Object.keys(after)){
        if(same(after[key],before?.[key]))continue
        if(!same(found.after[key],found.before?.[key]) && !same(found.after[key],after[key]))
          throw Error(`Conflicting changes to ${nameOf(after)} (${key}). Keep one decision in this batch.`)
        found.after[key]=after[key]
      }
      found.reason+='; '+reason
    }else changes.push({table,id:after.id,title:nameOf(after),before:clone(before),after:clone(after),reason})
    return true
  }
  const newKeys=new Set<string>()
  for(const index of chosen){
    const p=batch.updates[index],r=resolutions[index] || {},row:ReviewRow={index,title:p.title,outcome:'blocked',issues:[],targetId:null}
    rows.push(row)
    // Stage each proposal independently; a failed row must not leave partial changes.
    const checkpoint=clone(changes)
    try{
      const action=r.action || p.action
      if(action==='clarify')throw Error('Choose Create or Update only after resolving this tentative decision.')
      if(!r.acknowledged)throw Error('Check the supporting evidence and questions, then confirm this item.')
      const project=resolvedProject(w,p,r),owner=resolvedOwner(w,p,r)
      if(p.area!=='seminar' && !project && !(p.area==='marketing' && r.projectId==='unlinked'))throw Error('Choose one existing project, or explicitly choose unlinked for marketing.')
      if(project && project.status!=='active')throw Error('This project is not active. Restore or resume it separately before importing work.')
      if(p.owner && !owner && !['seminar','project_dates','program'].includes(p.area))throw Error('The named owner did not match exactly. Choose one team member.')
      const date=r.date===undefined?p.date:r.date || null
      if(date && !validInputDate(date))throw Error('Choose a real YYYY-MM-DD date.')
      const table=tableFor(p.area),available=candidates(w,p,r)
      const hits=p.area==='project_dates'||p.area==='program'?available:available.filter(x=>norm(nameOf(x))===norm(p.title))
      let target:RecordRow|undefined
      if(r.targetId && r.targetId!=='auto' && r.targetId!=='new'){
        target=available.find(x=>x.id===r.targetId)
        if(!target)throw Error('The selected record no longer belongs to this project or area.')
      }else if(r.targetId!=='new'){
        if(hits.length>1)throw Error('Several records match. Choose the exact existing record.')
        target=hits[0]
      }
      if(action==='update' && !target && p.area!=='program')throw Error('No exact existing record matched. Select one; updates never silently create replacements.')
      if(p.area==='project_dates' && !target)throw Error('Select an existing project.')
      row.targetId=target?.id || null
      const creating=!target
      const after:RecordRow=target?clone(target):{id:`practice-${w.version}-${index}-${table}`}
      if(p.area==='marketing' || p.area==='project_task'){
        const status=statusFor(p.area,r.status===undefined?p.status:r.status)
        const task=p.area==='project_task',field=task?'task_name':'title',dateField=task?'due_date':'scheduled_date'
        if(creating && !owner)throw Error('Choose one accountable owner.')
        if(creating && !date)throw Error('Choose a date for new work.')
        if(date && p.date_type!==(task?'due':'post'))throw Error(`Correct the date type to ${task?'due':'post'} in the input.`)
        if(creating)Object.assign(after,{[field]:p.title,project_id:project?.id || null,status:status || (task?'not_started':'idea')})
        if(status)after.status=status
        if(owner)Object.assign(after,task?{owner_ids:[owner.id]}:{owner_id:owner.id})
        if(date)after[dateField]=date
        if(task){
          if(target?.status==='done' && (after.status!=='done' || after.due_date!==target.due_date))throw Error('Completed tasks are protected. Reopen or reschedule them separately.')
          if(creating){
            const phase=r.phase?.trim() || 'Imported commitments'
            const siblings=[...w.records.project_tasks,...changes.filter(c=>c.table==='project_tasks' && !c.before).map(c=>c.after)].filter(t=>t.project_id===project!.id)
            const phaseRows=siblings.filter(t=>t.phase===phase)
            Object.assign(after,{phase,phase_order:phaseRows[0]?.phase_order || Math.max(0,...siblings.map(t=>t.phase_order||0))+1,
              task_order:Math.max(0,...phaseRows.map(t=>t.task_order||0))+index+1,week_number:0,role_id:null,task_type:'operational'})
          }
          if(creating || (date && date!==target?.due_date))Object.assign(after,{schedule_anchor:'fixed',schedule_offset_days:null})
        }else{
          if(creating)Object.assign(after,{copy_ready:false,creative_ready:false,source_task_id:null,channels:[]})
          for(const key of ['copy_ready','creative_ready'] as const)if(typeof p[key]==='boolean')after[key]=p[key]
          if(p.platforms.length){
            const channels=[...new Set(p.platforms)].sort()
            after.channels=target && same([...(target.channels || [])].sort(),channels)?target.channels:channels
          }
          if(creating && !after.channels.length)throw Error('Select at least one marketing platform in the input.')
          if(target?.status==='posted' && after.status!=='posted')throw Error('Published assets are protected from status regression. Edit them separately.')
          if(['scheduled','posted'].includes(after.status) && !after.scheduled_date)throw Error('Scheduled or Posted work requires a confirmed post date.')
        }
      }else if(p.area==='project_dates'){
        if(!date || !['marketing_launch','program_start'].includes(p.date_type || ''))throw Error('Choose a date and specify Marketing launch or Program start.')
        after[p.date_type==='marketing_launch'?'launch_date':'start_date']=date
      }else if(p.area==='seminar'){
        if(p.date_type!=='seminar' || !date)throw Error('A seminar date is required.')
        if(creating)after.title=p.title
        after.seminar_date=date
        // Existing seminar schema has no owner/project relationship. Do not invent it.
        if(p.project || p.owner)throw Error('Seminars do not store owners/projects. Use a project task for a client commitment, or remove these unsupported fields.')
      }else if(p.area==='program'){
        const fields=r.programFields || p.program_fields || {}
        let count=0
        for(const key of ['goal','target_audience','notes'] as const){
          if(fields[key]?.trim()){if(fields[key]!.length>4000)throw Error('Program fields must be under 4,000 characters.');after[key]=fields[key]!.trim();count++}
        }
        if(!count)throw Error('Enter the exact audience, goal or notes to save. Narrative titles are not guessed into fields.')
        after.project_id=project!.id
      }
      if(target && action==='create' && (!r.targetId || r.targetId==='auto') && !same(target,after))
        throw Error('An existing item matches but differs. Choose that record explicitly to update it, or choose a separate new item.')
      if(creating){
        const key=canonical([table,after.project_id,norm(nameOf(after)),after.scheduled_date || after.due_date || after.seminar_date,after.channels])
        if(newKeys.has(key))throw Error('Two selected proposals create the same item. Keep only one.')
        newKeys.add(key)
      }
      row.outcome=put(table,target||null,after,p.title)?'ready':'duplicate'
    }catch(e){
      changes.splice(0,changes.length,...checkpoint)
      row.issues.push(e instanceof Error?e.message:'Invalid proposal.')
    }
  }
  // Merge both project anchors before validation. Cascade only saved rules:
  // no legacy rule guesses, no moving fixed or completed tasks.
  for(const c of [...changes].filter(c=>c.table==='projects')){
    try{
      validateDates({start_date:c.after.start_date,launch_date:c.after.launch_date || null})
      for(const task of w.records.project_tasks.filter(t=>t.project_id===c.id && t.status!=='done' && t.schedule_anchor && t.schedule_anchor!=='fixed')){
        const rule={anchor:task.schedule_anchor,offset_days:task.schedule_offset_days}
        if(!validRule(rule))throw Error(`Invalid saved schedule rule for ${task.task_name}. Fix it before importing dates.`)
        const date=scheduledDate(rule,{start_date:c.after.start_date,launch_date:c.after.launch_date || null},task.due_date)
        if(!date)throw Error(`Missing anchor for ${task.task_name}.`)
        put('project_tasks',task,{...task,due_date:date},`Saved ${rule.anchor} rule follows ${c.title}`)
      }
    }catch(e){issues.push(e instanceof Error?e.message:'Cannot safely reschedule this project.')}
  }
  for(const row of rows)for(const issue of row.issues)issues.push(`${row.title}: ${issue}`)
  const signature=canonical({version:w.version,records:w.records,batch,resolutions,chosen,changes,issues})
  return {version:w.version,rows,changes,issues,signature}
}
export function applyBatch(w:Workspace,batch:UpdateBatch,resolutions:Record<number,Resolution>,selected:number[],
  reviewed:ReviewPlan,approval:{confirmed:boolean;reviewer:string},key:string,at:string):Workspace {
  if(!approval.confirmed || !approval.reviewer.trim())throw Error('Confirm the displayed changes and enter a reviewer label.')
  const intent=canonical({batch,resolutions,selected:[...selected].sort((a,b)=>a-b),reviewer:approval.reviewer.trim()})
  const prior=w.history.find(h=>h.id===key)
  if(prior){if(prior.intent!==intent || prior.undone)throw Error('This batch key has already been used. Prepare a new review.');return w}
  const fresh=reviewBatch(w,batch,resolutions,selected)
  if(fresh.signature!==reviewed.signature || fresh.version!==reviewed.version)throw Error('The practice copy or decisions changed. Review the latest changes again.')
  if(fresh.issues.length || !fresh.changes.length)throw Error('Resolve all selected issues or deselect blocked items before applying.')
  const next=clone(w)
  for(const c of fresh.changes){
    const target=next.records[c.table].findIndex(r=>r.id===c.id)
    if(c.before){if(target<0 || !same(next.records[c.table][target],c.before))throw Error('A target changed. Nothing was applied.');next.records[c.table][target]=clone(c.after)}
    else {if(target>=0)throw Error('A new record already exists. Nothing was applied.');next.records[c.table].push(clone(c.after))}
  }
  next.version++
  next.history.push({id:key,intent,reviewer:approval.reviewer.trim(),at,changes:clone(fresh.changes),
    sources:selected.map(i=>({title:batch.updates[i].title,evidence:batch.updates[i].evidence,source_ref:batch.updates[i].source_ref})),undone:false})
  return next
}
export function undoLatest(w:Workspace,id:string):Workspace {
  const latest=[...w.history].reverse().find(h=>!h.undone)
  if(!latest || latest.id!==id)throw Error('Undo the most recent applied batch first.')
  const next=clone(w)
  for(const c of [...latest.changes].reverse()){
    const index=next.records[c.table].findIndex(r=>r.id===c.id)
    if(index<0 || !same(next.records[c.table][index],c.after))throw Error('A record changed after this batch. Nothing was undone.')
    if(c.before)next.records[c.table][index]=clone(c.before)
    else next.records[c.table].splice(index,1)
  }
  next.history.find(h=>h.id===id)!.undone=true;next.version++
  return next
}
