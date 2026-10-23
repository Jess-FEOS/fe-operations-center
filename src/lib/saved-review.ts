import {parseUpdateBatch,UpdateBatch,validInputDate} from './update-intake'
import {newWorkspace,RecordRow,Records,Resolution,TABLES,Workspace} from './update-review'
import {gunzipSync,strFromU8} from 'fflate'

export const SAVED_REVIEW_KEY='fe-preview:social-strategy:v1'
export const MAX_SAVED_REVIEW=1_500_000
export const RESULT_VIEWS=['Changes','Projects','Marketing','Calendar','History']
export interface ReviewEditorState {workspace:Workspace|null;resolutions:Record<number,Resolution>;view:string}
export interface SavedReviewSeed {
  version:1;id:'social-strategy';revision:string;title:string;batch:UpdateBatch
  resolutions:Record<number,Resolution>;proposedProject:RecordRow;notes:string[]
}
export interface SavedReviewDocument {version:1;seedRevision:string;seed:SavedReviewSeed;savedAt:string;editor:ReviewEditorState}
const object=(x:any)=>x && typeof x==='object' && !Array.isArray(x)
const str=(x:any,max=4000)=>typeof x==='string' && x.length<=max
const error=()=>{throw Error('The saved review is invalid or incompatible. Your stored copy has not been overwritten.')}
export function reviewEnabled(env:Record<string,string|undefined>) {
  return env.VERCEL_ENV==='preview' || (!env.VERCEL_ENV && env.OPS_LOCAL_REVIEW==='true')
}
export function cleanResolutions(value:any,count:number):Record<number,Resolution> {
  if(!object(value))return error()
  const result:Record<number,Resolution>={}
  for(const [key,item] of Object.entries(value)){
    const i=Number(key),r=item as any
    if(!/^(0|[1-9]\d*)$/.test(key)||i>=count||!object(r))return error()
    const out:Resolution={}
    for(const [field,v] of Object.entries(r)){
      if(field==='acknowledged')continue // Never restore approval from storage.
      if(['projectId','ownerId','targetId','status','phase','title','description','assetType','targetAudience'].includes(field)){
        if(!str(v,field==='title'?500:4000))return error()
      }else if(field==='date'){
        if(!str(v,10)||(v!==''&&!validInputDate(v as string)))return error()
      }else if(field==='action'){
        if(!['create','update','clarify'].includes(v as string))return error()
      }else if(field==='area'){
        if(!['marketing','project_task','project_dates','seminar','program'].includes(v as string))return error()
      }else if(field==='dateType'){
        if(v!==null&&!['post','due','marketing_launch','program_start','seminar'].includes(v as string))return error()
      }else if(field==='disposition'){
        if(!['include','hold','skip'].includes(v as string))return error()
      }else if(field==='platforms'){
        if(!Array.isArray(v)||v.length>7||v.some(x=>!str(x,40)))return error()
      }else if(field==='copyReady'||field==='creativeReady'){
        if(typeof v!=='boolean')return error()
      }else if(field==='programFields'){
        if(!object(v)||Object.entries(v as any).some(([k,x])=>!['goal','target_audience','notes'].includes(k)||!str(x)))return error()
      }else return error()
      ;(out as any)[field]=v
    }
    result[i]={...out,acknowledged:false}
  }
  return result
}
function validRow(row:any) {
  if(!object(row)||!str(row.id,200)||!row.id)return false
  return Object.entries(row).every(([k,v])=>{
    if(v===null)return true
    if(['channels','owner_ids'].includes(k))return Array.isArray(v)&&v.every(x=>str(x,200))
    if(['copy_ready','creative_ready'].includes(k))return typeof v==='boolean'
    if(['phase_order','task_order','week_number','schedule_offset_days'].includes(k))return typeof v==='number'&&Number.isFinite(v)
    return str(v,20000)
  })
}
function readWorkspace(value:any):Workspace|null {
  if(value===null)return null
  if(!object(value)||!Number.isSafeInteger(value.version)||value.version<0||!str(value.loadedAt,60)||!Array.isArray(value.history)||value.history.length>150)return error()
  if(!object(value.records)||TABLES.some(t=>!Array.isArray(value.records[t])||value.records[t].length>12000||value.records[t].some((r:any)=>!validRow(r))))return error()
  const w=newWorkspace(value.records,value.loadedAt)
  for(const h of value.history){
    if(!object(h)||!str(h.id,200)||!str(h.intent,MAX_SAVED_REVIEW)||!str(h.reviewer,200)||!str(h.at,60)||typeof h.undone!=='boolean'||!Array.isArray(h.changes)||!Array.isArray(h.sources))return error()
    for(const c of h.changes)if(!object(c)||!TABLES.includes(c.table)||!str(c.id,200)||!str(c.title,500)||!str(c.reason)||!validRow(c.after)||(c.before!==null&&!validRow(c.before)))return error()
    for(const s of h.sources)if(!object(s)||!str(s.title,500)||!str(s.evidence,4000)||(s.source_ref!==null&&!str(s.source_ref,1000)))return error()
  }
  return {...w,version:value.version,history:value.history}
}
export function parseSavedSeed(value:any):SavedReviewSeed {
  if(!object(value)||value.version!==1||value.id!=='social-strategy'||!str(value.revision,100)||!value.revision||!str(value.title,200))return error()
  const batch=parseUpdateBatch(JSON.stringify(value.batch))
  const p=value.proposedProject
  if(!validRow(p)||!p.id.startsWith('practice-project-')||!str(p.name,200)||!p.name||p.status!=='active'||p.start_date!==null||p.launch_date!==null)return error()
  if(!Array.isArray(value.notes)||value.notes.length>25||value.notes.some((n:any)=>!str(n)))return error()
  return {version:1,id:'social-strategy',revision:value.revision,title:value.title,batch,
    resolutions:cleanResolutions(value.resolutions,batch.updates.length),proposedProject:p,notes:value.notes}
}
export function parseSavedDocument(text:string,seed:SavedReviewSeed):SavedReviewDocument {
  if(text.length>MAX_SAVED_REVIEW)return error()
  const d=JSON.parse(text)
  if(!object(d)||d.version!==1||d.seedRevision!==seed.revision||!str(d.savedAt,80)||!object(d.editor)||!RESULT_VIEWS.includes(d.editor.view))return error()
  if(JSON.stringify(parseSavedSeed(d.seed))!==JSON.stringify(seed))return error()
  return {version:1,seedRevision:d.seedRevision,seed,savedAt:d.savedAt,editor:{
    workspace:readWorkspace(d.editor.workspace),
    resolutions:cleanResolutions(d.editor.resolutions,seed.batch.updates.length),view:d.editor.view}}
}
export function serializeSavedDocument(seed:SavedReviewSeed,editor:ReviewEditorState,savedAt:string) {
  const text=JSON.stringify({version:1,seedRevision:seed.revision,seed,savedAt,editor:{...editor,resolutions:cleanResolutions(editor.resolutions,seed.batch.updates.length)}})
  if(text.length>MAX_SAVED_REVIEW)throw Error('This practice history is too large to save. Export a backup before resetting the practice copy.')
  return text
}
// Initial private draft travels in a URL fragment, never in an HTTP request.
// Fragments are not access control: anyone given the full link can read its data.
export function seedFromFragment(hash:string):SavedReviewSeed|null {
  if(!hash.startsWith('#review='))return null
  const encoded=hash.slice(8)
  if(!encoded||encoded.length>60000||!/^[A-Za-z0-9_-]+$/.test(encoded))return error()
  const data=Uint8Array.from(atob(encoded.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0))
  if(data.length<18)return error()
  const size=new DataView(data.buffer).getUint32(data.length-4,true)
  if(size>200000||!size)return error()
  return parseSavedSeed(JSON.parse(strFromU8(gunzipSync(data,{out:new Uint8Array(size)}))))
}
export function addProposedProject(records:Records,project:RecordRow) {
  const copy=JSON.parse(JSON.stringify(records)) as Records
  const matches=copy.projects.filter(p=>p.name?.trim().toLowerCase()===project.name.trim().toLowerCase())
  if(matches.length>1 || matches.some(p=>p.status!=='active'))throw Error('The proposed project name matches an inactive or ambiguous live project. Resolve this before loading a new practice copy.')
  const id=matches[0]?.id||project.id
  if(!matches.length&&!copy.projects.some(p=>p.id===project.id))copy.projects.push({...project})
  return {records:copy,projectId:id}
}
