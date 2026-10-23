'use client'
import {useEffect,useMemo,useRef,useState} from 'react'
import {UpdateBatch} from '@/lib/update-intake'
import {applyBatch,bulkResolve,candidates,changeDestination,editedProposal,REVIEW_PLATFORMS,newWorkspace,Records,Resolution,resolvedOwner,resolvedProject,reviewBatch,ReviewPlan,undoLatest,Workspace,Change} from '@/lib/update-review'
import {ASSET_TYPES} from '@/lib/marketing'
import {addProposedProject,ReviewEditorState} from '@/lib/saved-review'
import type {RecordRow} from '@/lib/update-review'

const empty:UpdateBatch={version:1,updates:[],questions:[]}
const label=(v:any)=>v===null||v===undefined?'Not set':Array.isArray(v)?v.join(', '):String(v)
function fields(c:Change){return Object.keys(c.after).filter(k=>k!=='id' && JSON.stringify(c.before?.[k])!==JSON.stringify(c.after[k]))}
const fieldLabels:Record<string,string>={owner_id:'Owner',owner_ids:'Owner',project_id:'Project',scheduled_date:'Post date',due_date:'Due date',launch_date:'Marketing launch',start_date:'Program start',seminar_date:'Seminar date',task_name:'Task',task_id:'Task',comment:'Description / instructions',caption:'Caption / description',schedule_anchor:'Schedule rule',schedule_offset_days:'Days from anchor',target_audience:'Audience',copy_ready:'Copy ready',creative_ready:'Creative ready'}
const technical=new Set(['source_task_id','role_id','phase_order','task_order','week_number','team_member_id'])
function ChangeList({changes,w}:{changes:Change[];w:Workspace}){
  const display=(key:string,value:any)=>{
    if(key==='owner_id'||key==='owner_ids')return (Array.isArray(value)?value:[value]).filter(Boolean).map(id=>w.records.team_members.find(t=>t.id===id)?.name || id).join(', ')||'Not set'
    if(key==='project_id')return w.records.projects.find(p=>p.id===value)?.name || 'Unlinked'
    if(key==='task_id')return w.records.project_tasks.find(p=>p.id===value)?.task_name || changes.find(c=>c.table==='project_tasks' && c.id===value)?.after.task_name || value || 'Not set'
    return label(value)
  }
  return <div className="space-y-3">{changes.map(c=><div key={c.table+c.id} className="border border-fe-line bg-white p-3 min-w-0 [overflow-wrap:anywhere]">
    <h4 className="font-bold text-sm">{c.before?'Update':'Create'}: {c.title}</h4>
    <p className="text-xs text-slate-600 mt-1">{c.table.replaceAll('_',' ')} · {c.reason}</p>
    <dl className="mt-2 space-y-1 text-sm">{fields(c).filter(key=>!technical.has(key)).map(key=><div key={key} className="grid sm:grid-cols-[160px_1fr_1fr] gap-1 sm:gap-3 border-t border-slate-100 pt-2">
      <dt className="font-medium">{fieldLabels[key] || key.replaceAll('_',' ')}</dt>
      <dd><span className="text-xs text-slate-500">Before: </span>{display(key,c.before?.[key])}</dd>
      <dd><span className="text-xs text-slate-500">After: </span>{display(key,c.after[key])}</dd>
    </div>)}</dl>
    {fields(c).some(key=>technical.has(key)) && <details className="text-xs text-slate-600 mt-3"><summary>Record defaults and links</summary>{fields(c).filter(key=>technical.has(key)).map(key=><p key={key} className="mt-1">{key.replaceAll('_',' ')}: {display(key,c.before?.[key])} → {display(key,c.after[key])}</p>)}</details>}
  </div>)}</div>
}
export default function UpdateApproval({batch,selected,savedReview}:{batch:UpdateBatch|null;selected:Set<number>;savedReview?:{initial:ReviewEditorState;proposedProject:RecordRow;onChange:(state:ReviewEditorState)=>void}}){
  const [w,setW]=useState<Workspace|null>(savedReview?.initial.workspace||null),[loading,setLoading]=useState(false),[error,setError]=useState('')
  const [resolutions,setResolutions]=useState<Record<number,Resolution>>(savedReview?.initial.resolutions||{})
  const [bulkItems,setBulkItems]=useState<Set<number>>(new Set())
  const [bulkProject,setBulkProject]=useState(''),[bulkOwner,setBulkOwner]=useState(''),[bulkDate,setBulkDate]=useState('')
  const [reviewed,setReviewed]=useState<ReviewPlan|null>(null),[reviewer,setReviewer]=useState(''),[confirmed,setConfirmed]=useState(false)
  const [message,setMessage]=useState(''),[view,setView]=useState(savedReview?.initial.view||'Changes'),[undoId,setUndoId]=useState<string|null>(null),[resetting,setResetting]=useState(false)
  const controller=useRef<AbortController|null>(null),batchKey=useRef('')
  const indices=useMemo(()=>[...selected].sort((a,b)=>a-b),[selected])
  const plan=useMemo(()=>w?reviewBatch(w,batch || empty,resolutions,batch?indices:[]):null,[w,batch,resolutions,indices])
  const signature=plan?.signature
  useEffect(()=>{if(!savedReview)setResolutions({});setBulkItems(new Set());setReviewed(null);setConfirmed(false);setMessage('')},[batch])
  useEffect(()=>{setReviewed(null);setConfirmed(false)},[signature])
  useEffect(()=>()=>controller.current?.abort(),[])
  useEffect(()=>{if(savedReview&&!savedReview.initial.workspace)void load()},[])
  useEffect(()=>{savedReview?.onChange({workspace:w,resolutions,view})},[w,resolutions,view,savedReview?.onChange])
  async function load(){
    controller.current?.abort();controller.current=new AbortController()
    const request=controller.current
    setLoading(true);setError('')
    try{
      const response=await fetch('/api/updates/workspace',{cache:'no-store',signal:controller.current.signal})
      const data=await response.json()
      if(!response.ok)throw Error(data.error || 'Could not load the practice copy.')
      if(request.signal.aborted)return
      const prepared=savedReview?addProposedProject(data.records,savedReview.proposedProject):{records:data.records,projectId:null}
      if(savedReview)setResolutions(prev=>Object.fromEntries(Object.entries(prev).map(([i,r])=>[i,{...r,acknowledged:false,...(r.projectId===savedReview.proposedProject.id?{projectId:prepared.projectId!}:{})}])))
      setW(newWorkspace(prepared.records as Records,data.loadedAt));setResetting(false);setUndoId(null);setMessage('Practice copy loaded. Production records are untouched.')
    }catch(e){if(!(e instanceof Error && e.name==='AbortError'))setError(e instanceof Error?e.message:'Could not load the practice copy.')}
    finally{if(controller.current===request)setLoading(false)}
  }
  function resolve(i:number,patch:Partial<Resolution>){
    setResolutions(prev=>({...prev,[i]:{...prev[i],...patch}}));setReviewed(null);setConfirmed(false);setError('')
    if(patch.disposition==='hold'||patch.disposition==='skip')setBulkItems(prev=>{const next=new Set(prev);next.delete(i);return next})
  }
  function applyBulk(){
    if(!batch)return
    setResolutions(prev=>bulkResolve(batch,prev,[...bulkItems].filter(i=>selected.has(i)),{projectId:bulkProject,ownerId:bulkOwner,date:bulkDate}))
    setReviewed(null);setConfirmed(false);setError('')
    setMessage('Bulk edits staged for review. Held/skipped items were left alone. Confirm the edited items before applying.')
    setBulkProject('');setBulkOwner('');setBulkDate('');setBulkItems(new Set())
  }
  function apply(){
    if(!w || !batch || !reviewed)return
    try{
      const next=applyBatch(w,batch,resolutions,indices,reviewed,{confirmed,reviewer},batchKey.current,new Date().toISOString())
      setW(next);setReviewed(null);setConfirmed(false);setError('');setView(reviewed.changes.some(c=>c.table==='marketing_content')?'Marketing':'Projects')
      setMessage(`Applied ${reviewed.changes.length} record changes to the practice copy only. Nothing was saved to production.`)
    }catch(e){setError(e instanceof Error?e.message:'Nothing was applied.')}
  }
  function undo(){
    if(!w || !undoId)return
    try{setW(undoLatest(w,undoId));setUndoId(null);setReviewed(null);setConfirmed(false);setMessage('Batch undone in the practice copy. Production was not changed.');setError('')}
    catch(e){setError(e instanceof Error?e.message:'Nothing was undone.')}
  }
  const active=w?.records.projects.filter(p=>p.status==='active') || []
  const latest=w?[...w.history].reverse().find(h=>!h.undone):undefined
  return <section aria-label="Approve and apply practice workspace" className="mt-6 border border-fe-line bg-slate-50 p-4 sm:p-5 [overflow-wrap:anywhere]">
    <h2 className="font-barlow font-bold text-xl">Edit, approve and apply</h2>
    <p className="text-sm mt-2 text-slate-700"><strong>Practice copy only.</strong> Matching, applying and undo operate on an isolated copy, not on the live database. Results below share that copy. Your main Projects, Pipeline, Strategy and Calendar pages remain unchanged.</p>
    <p className="text-sm mt-2 text-slate-600">{savedReview?'This named draft, its edits and practice results save in this browser. They survive refresh but do not sync to teammates. Approvals are cleared when reopened.':'Refresh or leave Import updates to discard the copy and its history. Other teammates cannot see these practice changes.'} Loading a copy does not send its records to AI.</p>
    {savedReview&&<p className="text-sm mt-2 text-slate-600">Proposed project: {savedReview.proposedProject.name} exists in the practice copy only unless an active live project with that name already exists. No project is created in production.</p>}
    {!w && <button disabled={loading} onClick={load} className="mt-4 px-4 py-2 bg-fe-blue text-white text-sm font-bold disabled:opacity-50">{loading?'Loading complete copy…':'Load practice copy'}</button>}
    {error && <p role="alert" className="p-3 text-sm bg-red-50 text-red-800 border border-red-200 mt-3">{error}</p>}
    {message && <p role="status" className="p-3 text-sm bg-blue-50 text-fe-navy border border-blue-200 mt-3">{message}</p>}
    {w && <>
      <div className="flex flex-wrap gap-3 items-center mt-4 text-xs text-slate-600">
        <span>Copy loaded {new Date(w.loadedAt).toLocaleString()} · Revision {w.version} · {w.records.projects.length} projects · {w.records.marketing_content.length} assets</span>
        <button onClick={()=>setResetting(!resetting)} className="underline text-fe-blue">Reset practice copy</button>
      </div>
      {resetting && <div className="mt-3 p-3 bg-amber-50 border border-amber-200 text-sm">
        <p>This will discard all practice changes and history, then load a fresh copy of current records.</p>
        <button onClick={load} disabled={loading} className="mt-2 border border-fe-navy px-3 py-2 mr-2">Confirm reset</button>
        <button onClick={()=>setResetting(false)} className="underline">Keep current copy</button>
      </div>}
      <div role="group" aria-label="Practice results view" className="flex flex-wrap gap-2 mt-4">
        {['Changes','Projects','Marketing','Calendar','History'].map(tab=><button key={tab} onClick={()=>setView(tab)} aria-pressed={view===tab} className={`px-3 py-2 border text-sm ${view===tab?'bg-fe-navy text-white border-fe-navy':'bg-white border-fe-line'}`}>{tab}</button>)}
      </div>
      {view==='Changes' && <div className="mt-4">
        {!batch?.updates.length?<p className="text-sm">Prepare an update batch above, then select the proposals you want to match and apply here.</p>:<>
          <p className="text-sm mb-3">{indices.length} proposals · {plan?.rows.filter(r=>r.outcome==='ready').length} ready · {plan?.rows.filter(r=>r.outcome==='duplicate').length} already match · {plan?.rows.filter(r=>r.outcome==='blocked').length} need review · {plan?.rows.filter(r=>r.outcome==='held').length} held · {plan?.rows.filter(r=>r.outcome==='skipped').length} skipped</p>
          <p className="text-sm text-slate-600 mb-4">Correct the details here, without editing JSON or uploading again. Original excerpts stay unchanged. Hold keeps an item for later {savedReview?'in this browser-saved draft':'in this session'}; Skip leaves it out of this batch. Neither is deleted.</p>
          <section aria-label="Bulk edit proposals" className="bg-blue-50 border border-blue-200 p-4 mb-5">
            <div className="flex flex-wrap justify-between gap-2 items-center">
              <h3 className="text-sm font-bold">Edit several at once ({[...bulkItems].filter(i=>selected.has(i)).length} selected)</h3>
              <div className="flex gap-3 text-sm"><button onClick={()=>setBulkItems(new Set(indices.filter(i=>!['hold','skip'].includes(resolutions[i]?.disposition||''))))} className="underline text-fe-blue">Select included items</button><button onClick={()=>setBulkItems(new Set())} className="underline">Clear selection</button></div>
            </div>
            <div className="grid md:grid-cols-3 gap-3 mt-3 text-sm">
              <label>Project<select aria-label="Bulk project" value={bulkProject} onChange={e=>setBulkProject(e.target.value)} className="fe-input mt-1"><option value="">No change</option>{active.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
              <label>Accountable owner<select aria-label="Bulk owner" value={bulkOwner} onChange={e=>setBulkOwner(e.target.value)} className="fe-input mt-1"><option value="">No change</option>{w.records.team_members.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
              <label>Same post / due / seminar date<input aria-label="Bulk date" type="date" value={bulkDate} onChange={e=>setBulkDate(e.target.value)} className="fe-input mt-1" /></label>
            </div>
            <p className="text-xs text-slate-600 mt-2">Only checked, included items are changed. Owner applies to assets/tasks; project does not apply to seminars. This never moves program launch/start dates.</p>
            <button onClick={applyBulk} disabled={!bulkItems.size || !(bulkProject||bulkOwner||bulkDate)} className="px-3 py-2 mt-3 bg-fe-blue text-white text-sm font-bold disabled:opacity-40">Stage bulk edits</button>
          </section>
          {batch.questions.length>0 && <p className="text-sm mb-3 text-amber-900">Review the batch questions above. Hold any item whose source, date or commitment remains uncertain.</p>}
          <button onClick={()=>{setResolutions(prev=>{const next={...prev};for(const i of indices)if(!['hold','skip'].includes(next[i]?.disposition||''))next[i]={...next[i],acknowledged:true};return next});setReviewed(null);setConfirmed(false)}} className="text-sm underline text-fe-blue mb-3">I checked the evidence and questions for all included items</button>
          <div className="space-y-4">{indices.map(i=>{
            const original=batch.updates[i],r=resolutions[i] || {},p=editedProposal(original,r),row=plan?.rows.find(x=>x.index===i)
            const project=resolvedProject(w,p,r),owner=resolvedOwner(w,p,r)
            const current=candidates(w,p,r).find(x=>r.targetId && !['auto','new'].includes(r.targetId)?x.id===r.targetId:(x.title||x.task_name||'').trim().toLowerCase()===original.title.trim().toLowerCase())
            const paused=r.disposition==='hold'||r.disposition==='skip'
            return <fieldset id={`review-proposal-${i}`} key={i} className="border border-fe-line bg-white p-4 min-w-0 scroll-mt-24">
              <legend className="text-sm font-bold px-1">{i+1}. {p.title || 'Untitled item'}</legend>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" aria-label={`Bulk select proposal ${i+1}`} checked={bulkItems.has(i)} disabled={paused} onChange={e=>setBulkItems(prev=>{const next=new Set(prev);e.target.checked?next.add(i):next.delete(i);return next})} />Select for bulk edits</label>
                <label className="text-sm">Include in this batch<select aria-label={`Disposition for proposal ${i+1}`} value={r.disposition||'include'} onChange={e=>resolve(i,{disposition:e.target.value as Resolution['disposition'],acknowledged:false})} className="fe-input mt-1"><option value="include">Include for review</option><option value="hold">Hold for later</option><option value="skip">Skip this item</option></select></label>
              </div>
              <p className="text-xs text-slate-600 mb-3">{p.area.replaceAll('_',' ')} · {paused?'Excluded from apply; edits are retained':row?.outcome==='duplicate'?'Already matches: no change needed':row?.outcome==='ready'?'Ready for before/after review':'Needs review'}</p>
              <p className="text-sm mb-2">{project?.name || (r.projectId==='unlinked'?'Intentionally unlinked':'Project not confirmed')} · {p.area==='program'?'Strategy field; no task owner or deadline':`${owner?.name || 'Owner not confirmed'} · ${r.date??p.date??'Date not confirmed'}`}</p>
              <details open={i===indices[0]}><summary aria-label={`Edit proposal ${i+1}`} className="cursor-pointer text-sm font-bold text-fe-blue mb-3">Edit details and check source</summary>
              <div className="grid md:grid-cols-[2fr_1fr] gap-3 text-sm mb-3">
                <label>{['program','project_dates'].includes(p.area)?'Change label (does not rename the project)':'Title'}<input aria-label={`Title for proposal ${i+1}`} maxLength={500} value={r.title===undefined?original.title:r.title} onChange={e=>resolve(i,{title:e.target.value,...((r.action||p.action)==='update' && current?{targetId:current.id}:{}),acknowledged:false})} className="fe-input mt-1" /></label>
                <label>Destination<select aria-label={`Destination for proposal ${i+1}`} value={p.area} onChange={e=>resolve(i,changeDestination(r,e.target.value as typeof p.area))} className="fe-input mt-1">
                  <option value="marketing">Marketing asset</option><option value="project_task">Operational project task</option><option value="seminar">Seminar</option><option value="program">Program strategy</option><option value="project_dates">Project launch / start date</option>
                </select></label>
              </div>
              <p className="text-xs text-slate-600 mb-3">{p.area==='marketing'?'Feeds Pipeline, Strategy and Marketing Calendar through one shared asset.':p.area==='project_task'?'Feeds the project checklist, not the marketing publishing calendar.':p.area==='seminar'?'Feeds the Company calendar. Seminars do not store project or owner relationships.':p.area==='program'?'Updates program planning. No asset or calendar event is created.':'Updates project milestones and previews affected task dates using existing scheduling rules.'}</p>
              {p.area==='seminar' && (original.project||original.owner) && <label className="flex gap-2 text-sm mb-3"><input type="checkbox" aria-label={`Confirm seminar relationships for proposal ${i+1}`} checked={r.area==='seminar'} onChange={e=>resolve(i,{area:e.target.checked?'seminar':undefined,acknowledged:false})} /><span>Use a seminar without project/owner relationships. Choose Operational project task instead if those relationships are required.</span></label>}
              <div className="grid md:grid-cols-3 gap-3 text-sm">
                <label>Action<select aria-label={`Action for ${p.title}`} value={r.action || p.action} onChange={e=>resolve(i,{action:e.target.value as Resolution['action'],acknowledged:false})} className="fe-input mt-1">
                  <option value="create">Create</option><option value="update">Update</option><option value="clarify">Unresolved decision</option>
                </select></label>
                {p.area!=='seminar' && <label>Project<select aria-label={`Project for ${p.title}`} value={r.projectId || project?.id || ''} onChange={e=>resolve(i,{projectId:e.target.value,targetId:'auto',acknowledged:false})} className="fe-input mt-1">
                  <option value="">Choose project</option>{p.area==='marketing' && <option value="unlinked">Intentionally unlinked</option>}
                  {w.records.projects.map(project=><option key={project.id} value={project.id}>{project.name}{project.status!=='active'?` (${project.status})`:''}</option>)}
                </select></label>}
                {['marketing','project_task'].includes(p.area) && <label>Accountable owner<select aria-label={`Owner for ${p.title}`} value={r.ownerId || owner?.id || ''} onChange={e=>resolve(i,{ownerId:e.target.value,acknowledged:false})} className="fe-input mt-1">
                  <option value="">Keep existing / choose for new work</option>{w.records.team_members.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                </select></label>}
                {!['project_dates','program'].includes(p.area) && <label>Existing record<select aria-label={`Record for ${p.title}`} value={r.targetId || 'auto'} onChange={e=>resolve(i,{targetId:e.target.value,acknowledged:false})} className="fe-input mt-1">
                  <option value="auto">Exact-title match only</option><option value="new">Create a separate new item</option>
                  {candidates(w,p,r).map(x=><option key={x.id} value={x.id}>{x.title || x.task_name} · {x.scheduled_date || x.due_date || x.seminar_date || 'undated'} · {x.id.slice(-6)}</option>)}
                </select></label>}
                {p.area!=='program' && <label>Date meaning<select aria-label={`Date meaning for proposal ${i+1}`} value={p.date_type||''} onChange={e=>resolve(i,{dateType:e.target.value as Resolution['dateType'],acknowledged:false})} className="fe-input mt-1">
                  <option value="">Choose date meaning</option>
                  {(p.area==='marketing'?['post']:p.area==='project_task'?['due']:p.area==='seminar'?['seminar']:['marketing_launch','program_start']).map(type=><option key={type} value={type}>{type.replaceAll('_',' ')}</option>)}
                </select></label>}
                {p.area!=='program' && <label>Date ({p.date_type?.replaceAll('_',' ') || 'type missing'})
                  <input aria-label={`Date for ${p.title}`} type="date" value={r.date===undefined?p.date || '':r.date} onChange={e=>resolve(i,{date:e.target.value,acknowledged:false})} className="fe-input mt-1" />
                </label>}
                {['marketing','project_task'].includes(p.area) && <label>Status
                  <select aria-label={`Status for ${p.title}`} value={r.status===undefined?p.status || '':r.status} onChange={e=>resolve(i,{status:e.target.value,acknowledged:false})} className="fe-input mt-1">
                    <option value="">Keep existing / default for new work</option>
                    {p.status && <option value={p.status}>From source: {p.status}</option>}
                    {(p.area==='marketing'?['idea','ready','drafted','scheduled','posted']:['not_started','in_progress','done','blocked']).filter(s=>s!==p.status).map(s=><option key={s} value={s}>{s.replaceAll('_',' ')}</option>)}
                  </select>
                </label>}
                {p.area==='project_task' && <label>Phase for a new task<input aria-label={`Phase for ${p.title}`} value={r.phase || ''} onChange={e=>resolve(i,{phase:e.target.value,acknowledged:false})} placeholder="Imported commitments" className="fe-input mt-1" /></label>}
              </div>
              {['marketing','project_task','seminar'].includes(p.area) && <label className="block mt-3 text-sm">Description / instructions (optional)
                <textarea aria-label={`Description for proposal ${i+1}`} maxLength={4000} value={r.description??(p.area==='marketing'?current?.caption:p.area==='seminar'?current?.notes:'')??''} onChange={e=>resolve(i,{description:e.target.value,acknowledged:false})} className="fe-input mt-1 h-24" />
                <span className="block text-xs text-slate-600 mt-1">{p.area==='project_task'?'Saved as an additional task comment; existing comments are preserved.':p.area==='marketing'?'Saved in the asset’s caption / description field. Not required for email reminders.':'Saved as seminar notes.'} Blank means keep existing; this editor does not erase existing text.</span>
              </label>}
              {p.area==='marketing' && <div className="mt-3 border-t border-fe-line pt-3">
                <fieldset><legend className="text-sm font-medium">Platforms</legend><div className="flex flex-wrap gap-x-4 gap-y-2 mt-2">{REVIEW_PLATFORMS.map(channel=><label key={channel} className="flex gap-2 items-center text-sm"><input type="checkbox" aria-label={`${channel} for proposal ${i+1}`} checked={p.platforms.includes(channel)} onChange={e=>resolve(i,{platforms:e.target.checked?[...p.platforms,channel]:p.platforms.filter(c=>c!==channel),acknowledged:false})} />{channel}</label>)}</div></fieldset>
                <div className="grid md:grid-cols-2 gap-3 text-sm mt-3">
                  <label>Asset type<select aria-label={`Asset type for proposal ${i+1}`} value={r.assetType??current?.asset_type??''} onChange={e=>resolve(i,{assetType:e.target.value,acknowledged:false})} className="fe-input mt-1"><option value="">Keep existing / not specified</option>{ASSET_TYPES.map(type=><option key={type.key} value={type.key}>{type.label}</option>)}</select></label>
                  <label>Target audience<input aria-label={`Audience for proposal ${i+1}`} maxLength={4000} value={r.targetAudience??current?.target_audience??''} onChange={e=>resolve(i,{targetAudience:e.target.value,acknowledged:false})} className="fe-input mt-1" /></label>
                  {(['copyReady','creativeReady'] as const).map(key=><label key={key}>{key==='copyReady'?'Copy ready':'Creative ready'}<select aria-label={`${key} for proposal ${i+1}`} value={r[key]===undefined?'':String(r[key])} onChange={e=>resolve(i,{[key]:e.target.value===''?undefined:e.target.value==='true',acknowledged:false})} className="fe-input mt-1"><option value="">Use source / keep existing</option><option value="true">Yes</option><option value="false">No</option></select></label>)}
                </div>
              </div>}
              {p.area==='program' && <div className="grid sm:grid-cols-3 gap-3 mt-3 text-sm">{(['goal','target_audience','notes'] as const).map(key=><label key={key}>{key.replaceAll('_',' ')}
                <textarea aria-label={`${key} for ${p.title}`} maxLength={4000} value={(r.programFields || p.program_fields)?.[key] || ''}
                  onChange={e=>resolve(i,{programFields:{...(r.programFields || p.program_fields),[key]:e.target.value},acknowledged:false})} className="fe-input mt-1 h-24" />
              </label>)}</div>}
              <p className="text-xs font-bold text-slate-600 mt-4">Original source (unchanged)</p>
              <blockquote className="border-l-2 border-fe-line pl-3 text-sm mt-1 whitespace-pre-wrap">{p.evidence}</blockquote>
              <p className="text-xs text-slate-600 mt-1">{p.source_ref || 'No source reference supplied'}</p>
              {p.questions.length>0 && <details className="text-sm mt-2"><summary>Original questions ({p.questions.length})</summary><ul className="list-disc pl-5 mt-1">{p.questions.map((q,j)=><li key={j}>{q}</li>)}</ul></details>}
              <label className="flex gap-2 text-sm mt-3 items-start"><input type="checkbox" disabled={paused} aria-label={`Confirm evidence for ${p.title}`} checked={!!r.acknowledged} onChange={e=>resolve(i,{acknowledged:e.target.checked})} className="mt-1" /><span>I checked the source and confirmed my corrected details, including any decisions added during this review.</span></label>
              </details>
              {!!row?.issues.length && <ul className="text-sm text-amber-900 mt-2 list-disc pl-5">{row.issues.map((issue,j)=><li key={j}>{issue}</li>)}</ul>}
            </fieldset>
          })}</div>
          {!!plan?.issues.filter(issue=>!plan.rows.some(row=>issue.startsWith(row.title+':'))).length && <p role="alert" className="text-sm text-red-800 mt-3">{plan.issues.filter(issue=>!plan.rows.some(row=>issue.startsWith(row.title+':'))).join(' ')}</p>}
          <button onClick={()=>{setReviewed(plan);setConfirmed(false);batchKey.current=crypto.randomUUID()}} disabled={!plan || !!plan.issues.length || !plan.changes.length} className="mt-4 px-4 py-2 bg-fe-blue text-white font-bold text-sm disabled:opacity-40">Review selected changes</button>
          <p className="text-xs text-slate-600 mt-2">Resolve items needing review or mark them Hold/Skip. Already-matching items are skipped. Blank fields never clear existing values. Any edit requires a fresh approval.</p>
          {reviewed && <section aria-label="Final batch approval" className="mt-5 border-t border-fe-line pt-4">
            <h3 className="font-bold text-lg">Before you apply: {reviewed.changes.length} record changes</h3>
            <p className="text-sm text-slate-600 mt-2 mb-3">This includes related task dates affected by saved project scheduling rules. Completed and fixed-date tasks are protected; unknown legacy rules are not guessed.</p>
            <ChangeList changes={reviewed.changes} w={w} />
            <label className="block text-sm mt-4">Reviewer label (not authentication)<input aria-label="Reviewer label" value={reviewer} onChange={e=>{setReviewer(e.target.value);setConfirmed(false)}} maxLength={120} className="fe-input mt-1 max-w-sm" placeholder="Who reviewed this batch?" /></label>
            <label className="flex gap-2 text-sm mt-3"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} /><span>I approve these exact changes to the temporary practice copy only.</span></label>
            <div className="flex flex-wrap gap-3 mt-3">
              <button onClick={apply} disabled={!confirmed || !reviewer.trim()} className="px-4 py-2 bg-fe-blue text-white text-sm font-bold disabled:opacity-40">Approve and apply to practice copy</button>
              <button onClick={()=>{setReviewed(null);setConfirmed(false)}} className="px-4 py-2 border border-fe-line text-sm">Back to matching</button>
            </div>
          </section>}
        </>}
      </div>}
      {view==='Projects' && <div className="mt-4 space-y-4">{active.map(project=>{
        const tasks=w.records.project_tasks.filter(t=>t.project_id===project.id),program=w.records.marketing_programs.find(m=>m.project_id===project.id)
        return <section key={project.id} className="border border-fe-line bg-white p-4">
          <h3 className="font-bold">{project.name}</h3>
          <p className="text-sm mt-2">Marketing launch: {project.launch_date || 'Not set'} · Program start: {project.start_date} · Tasks: {tasks.filter(t=>t.status==='done').length}/{tasks.length} done</p>
          {program && <p className="text-sm mt-2">Audience: {program.target_audience || 'Not set'} · Goal: {program.goal || 'Not set'} · Notes: {program.notes || 'Not set'}</p>}
          {program && <p className="text-xs mt-2 text-slate-600">Strategy window: {program.marketing_start || project.launch_date || 'Not set'} to {program.program_start || project.start_date}. Explicit strategy date overrides are preserved.</p>}
          <details className="mt-3 text-sm"><summary>Project commitments ({tasks.length})</summary><ul className="mt-2 space-y-2">{tasks.map(task=><li key={task.id}>{task.task_name} · {task.due_date} · {task.status?.replaceAll('_',' ')} · {(task.owner_ids || []).map((id:string)=>w.records.team_members.find(t=>t.id===id)?.name || id).join(', ') || 'Unassigned'}{w.records.task_comments.filter(c=>c.task_id===task.id).map(c=><p key={c.id} className="text-slate-600 text-xs whitespace-pre-wrap mt-1">{c.comment}</p>)}</li>)}</ul></details>
        </section>
      })}</div>}
      {view==='Marketing' && <div className="mt-4 space-y-2">
        <p className="text-sm text-slate-600 mb-3">These same practice assets feed the marketing entries in the Calendar tab. They have not been added to the live Pipeline.</p>
        {!w.records.marketing_content.length && <p className="text-sm">No assets in the practice copy.</p>}
        {w.records.marketing_content.map(asset=><div key={asset.id} className="border border-fe-line bg-white p-3 text-sm">
          <h3 className="font-bold">{asset.title}</h3><p className="mt-1">{w.records.projects.find(p=>p.id===asset.project_id)?.name || 'Unlinked'} · {asset.scheduled_date || 'Needs a post date'} · {(asset.channels || []).join(', ')} · {asset.status}</p>
          <p className="text-xs text-slate-600 mt-1">Owner: {w.records.team_members.find(t=>t.id===asset.owner_id)?.name || 'Unassigned'}</p>
          {asset.caption && <p className="mt-2 whitespace-pre-wrap">{asset.caption}</p>}
          {(asset.asset_type||asset.target_audience) && <p className="text-xs mt-2">Type: {asset.asset_type||'Not set'} · Audience: {asset.target_audience||'Not set'}</p>}
        </div>)}
      </div>}
      {view==='Calendar' && <div className="mt-4">
        <p className="text-sm text-slate-600 mb-3">A dated list from the same practice copy: marketing posts, program milestones and seminars. Operational task deadlines stay under Projects.</p>
        {[
          ...w.records.marketing_content.filter(a=>a.scheduled_date).map(a=>({id:a.id,date:a.scheduled_date,title:a.title,type:'Marketing',detail:(a.channels||[]).join(', ')})),
          ...active.flatMap(p=>[{id:p.id+'launch',date:p.launch_date,title:p.name,type:'Marketing launch',detail:''},{id:p.id+'start',date:p.start_date,title:p.name,type:'Program start',detail:''}]).filter(e=>e.date),
          ...w.records.seminars.map(s=>({id:s.id,date:s.seminar_date,title:s.title || 'Seminar',type:'Seminar',detail:s.client_name || ''})),
        ].sort((a,b)=>a.date.localeCompare(b.date)).map(event=><div key={event.id} className="grid sm:grid-cols-[110px_150px_1fr] gap-1 sm:gap-3 p-3 border-b border-fe-line text-sm bg-white">
          <span>{event.date}</span><span className="text-slate-600">{event.type}</span><span>{event.title}{event.detail?` · ${event.detail}`:''}</span>
        </div>)}
      </div>}
      {view==='History' && <div className="mt-4 space-y-3">
        <p className="text-sm text-slate-600">{savedReview?'Browser-saved practice history.':'Session-only review history.'} Reviewer labels are self-entered, not verified identities.</p>
        {!w.history.length && <p className="text-sm">No batches applied in this practice copy.</p>}
        {[...w.history].reverse().map(h=><section key={h.id} className="border border-fe-line bg-white p-4 text-sm">
          <h3 className="font-bold">{h.undone?'Undone':'Applied'} · {h.changes.length} changes · {h.reviewer}</h3><p className="text-xs text-slate-600 mt-1">{new Date(h.at).toLocaleString()}</p>
          <details className="mt-3"><summary>Changes and supporting evidence</summary><div className="mt-2"><ChangeList changes={h.changes} w={w}/>{h.sources.map((s,i)=><blockquote key={i} className="border-l-2 border-fe-line pl-3 mt-3">{s.title}: {s.evidence}<p className="text-xs mt-1">{s.source_ref || 'No source reference supplied'}</p></blockquote>)}</div></details>
          {latest?.id===h.id && <button onClick={()=>setUndoId(undoId===h.id?null:h.id)} className="underline text-fe-blue mt-3">Review undo</button>}
          {undoId===h.id && <div className="mt-3 p-3 bg-amber-50 border border-amber-200">
            <p>Undo all {h.changes.length} changes in this batch: remove its new records and restore its updated records to the Before values shown above. Later changes block undo.</p>
            <button onClick={undo} className="px-3 py-2 border border-fe-navy mt-2">Confirm undo in practice copy</button>
          </div>}
        </section>)}
      </div>}
    </>}
  </section>
}
