'use client'
import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import UpdateApproval from '@/components/UpdateApproval'
import {editedProposal} from '@/lib/update-review'
import {MAX_SAVED_REVIEW,parseSavedDocument,parseSavedSeed,ReviewEditorState,SAVED_REVIEW_KEY,SavedReviewSeed,seedFromFragment,serializeSavedDocument} from '@/lib/saved-review'

export default function SavedSocialReview(){
  const [seed,setSeed]=useState<SavedReviewSeed|null>(null),[initial,setInitial]=useState<ReviewEditorState|null>(null)
  const [editor,setEditor]=useState<ReviewEditorState|null>(null),[error,setError]=useState(''),[status,setStatus]=useState('Loading saved review…')
  const [paused,setPaused]=useState(false),[reset,setReset]=useState(false),[generation,setGeneration]=useState(0),[filter,setFilter]=useState('all')
  const expected=useRef<string|null>(null),ready=useRef(false),blocked=useRef(false),latest=useRef<ReviewEditorState|null>(null),seedRef=useRef<SavedReviewSeed|null>(null)
  const [storageFailure,setStorageFailure]=useState(false)
  const [recovery,setRecovery]=useState<{seed:SavedReviewSeed;editor:ReviewEditorState}|null>(null)
  const indices=useMemo(()=>new Set(seed?.batch.updates.map((_,i)=>i)||[]),[seed])
  const save=useCallback((state:ReviewEditorState)=>{
    if(!ready.current||blocked.current||!seedRef.current)return
    try{
      const current=localStorage.getItem(SAVED_REVIEW_KEY)
      if(current!==expected.current){blocked.current=true;setPaused(true);setStatus('Saving paused: another tab changed this draft.');return}
      const text=serializeSavedDocument(seedRef.current,state,new Date().toISOString())
      if(current){
        const before=JSON.parse(current),after=JSON.parse(text)
        before.savedAt=after.savedAt
        if(JSON.stringify(before)===JSON.stringify(after)){setStorageFailure(false);setStatus('Saved in this browser.');return}
      }
      localStorage.setItem(SAVED_REVIEW_KEY,text);expected.current=text
      if(location.hash.startsWith('#review='))history.replaceState(null,'',location.pathname+location.search)
      setStorageFailure(false);setStatus('Saved in this browser · '+new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}))
    }catch{setStorageFailure(true);setStatus('Not saved: browser storage is unavailable or full. Keep this page open and export a backup.')}
  },[])
  const change=useCallback((state:ReviewEditorState)=>{
    latest.current=state;setEditor(state);save(state)
  },[save])
  useEffect(()=>{
    let cancelled=false
    function open(){
      try{
        const supplied=seedFromFragment(location.hash)
        let raw:string|null=null
        try{raw=localStorage.getItem(SAVED_REVIEW_KEY)}catch{setStorageFailure(true)}
        const s=supplied||(raw?parseSavedSeed(JSON.parse(raw).seed):null)
        if(!s)throw Error('No saved review on this browser yet. Open the prepared Social Strategy review link once, or restore a review backup below.')
        seedRef.current=s;setSeed(s);expected.current=raw
        const state=raw?parseSavedDocument(raw,s).editor:{workspace:null,resolutions:s.resolutions,view:'Changes'}
        if(cancelled)return
        ready.current=true;latest.current=state;setInitial(state);setEditor(state)
        setStatus(raw?'Restored your browser-saved draft. Fresh approval is required before applying.':'Starter draft loaded. Changes save in this browser only.')
      }catch(e){if(!cancelled){setError(e instanceof Error?e.message:'Could not open the review.');setStatus('Review needs attention; saved data was not replaced.')}}
    }
    void open()
    const storage=(event:StorageEvent)=>{
      if((event.key===SAVED_REVIEW_KEY||event.key===null)&&event.newValue!==expected.current){
        blocked.current=true;setPaused(true);setStatus('Saving paused: another tab changed this draft.')
      }
    }
    window.addEventListener('storage',storage)
    return ()=>{cancelled=true;window.removeEventListener('storage',storage);ready.current=false}
  },[])
  function reloadSaved(){
    if(!seed)return
    try{
      const raw=localStorage.getItem(SAVED_REVIEW_KEY)
      if(!raw)throw Error('No saved draft is available. Restore the starter draft if you want to begin again.')
      const state=parseSavedDocument(raw,seed).editor
      expected.current=raw;blocked.current=false;ready.current=true
      setPaused(false);setError('');setInitial(state);setEditor(state);latest.current=state;setGeneration(x=>x+1)
      setStatus('Loaded the latest browser-saved draft. Fresh approval is required.')
    }catch(e){setError(e instanceof Error?e.message:'Could not restore the saved draft.')}
  }
  function restoreStarter(){
    if(!seed)return
    try{
      // An explicit confirmation is required before replacing local work.
      expected.current=localStorage.getItem(SAVED_REVIEW_KEY);blocked.current=false;ready.current=true
      const state={workspace:null,resolutions:seed.resolutions,view:'Changes'}
      setError('');setPaused(false);setInitial(state);setEditor(state);latest.current=state
      setGeneration(x=>x+1);setReset(false);save(state)
    }catch{setError('Browser storage is unavailable. Your stored draft was not replaced.')}
  }
  function backup(){
    try{
      const payload=seed&&latest.current?serializeSavedDocument(seed,latest.current,new Date().toISOString()):localStorage.getItem(SAVED_REVIEW_KEY)
      if(!payload)throw Error('There is no draft to export.')
      const url=URL.createObjectURL(new Blob([payload],{type:'application/json'})),a=document.createElement('a')
      a.href=url;a.download='social-strategy-review-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
    }catch(e){setError(e instanceof Error?e.message:'Could not export the backup.')}
  }
  async function readBackup(file?:File){
    if(!file)return
    try{
      if(file.size>MAX_SAVED_REVIEW)throw Error('This backup is too large.')
      const text=await file.text(),s=parseSavedSeed(JSON.parse(text).seed),d=parseSavedDocument(text,s)
      setRecovery({seed:s,editor:d.editor});setError('')
    }catch(e){setError(e instanceof Error?e.message:'Invalid backup; nothing was replaced.')}
  }
  function restoreBackup(){
    if(!recovery)return
    try{
      expected.current=localStorage.getItem(SAVED_REVIEW_KEY);seedRef.current=recovery.seed
      blocked.current=false;ready.current=true;setPaused(false);setError('');setReset(false)
      setSeed(recovery.seed);setInitial(recovery.editor);setEditor(recovery.editor);latest.current=recovery.editor
      setGeneration(x=>x+1);setRecovery(null);save(recovery.editor)
    }catch{setError('Could not restore the backup; stored data was not replaced.')}
  }
  function editItem(i:number){
    if(latest.current?.view!=='Changes'){
      const state={...latest.current!,view:'Changes'}
      setInitial(state);setGeneration(x=>x+1);setEditor(state);latest.current=state;save(state)
    }
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const el=document.getElementById(`review-proposal-${i}`)
      const detail=el?.querySelector('details');if(detail)detail.open=true
      el?.scrollIntoView({behavior:'smooth',block:'start'})
    }))
  }
  const rows=seed?.batch.updates.map((source,i)=>{
    const r=editor?.resolutions[i]||seed.resolutions[i]||{},p=editedProposal(source,r)
    const records=editor?.workspace?.records
    const owner=r.ownerId?(records?.team_members.find(t=>t.id===r.ownerId)?.name||'Loading selected owner…'):source.owner||'Not confirmed'
    const project=r.projectId===seed.proposedProject.id?`${seed.proposedProject.name} (practice only)`:records?.projects.find(t=>t.id===r.projectId)?.name||source.project||'Not confirmed'
    return {i,p,r,owner,project}
  }).filter(({p,r})=>filter==='all'||filter===p.area||filter===r.disposition)||[]
  return <div className="font-fira text-fe-navy">
    <PageHeader title="Social Strategy review" subtitle="Your meeting plan, ready to edit here. No re-upload or JSON editing needed." showDate={false} />
    <div className="border-l-4 border-fe-blue bg-blue-50 p-4 mb-5 text-sm">
      <strong>Preview draft only.</strong> Owners and dates are proposals, not approved commitments. Your live Projects, Marketing and Calendar remain unchanged.
      <p className="mt-2">The prepared review link loads the starter in your browser, not on the server. Treat that full link as private: it contains the draft. Your edits and practice results save on this browser/device and preview address only, not to teammates. Clearing browser data removes your saved copy.</p>
    </div>
    <div className="bg-white border border-fe-line p-4 mb-5">
      <div className="flex flex-wrap justify-between gap-3 items-center"><p role="status" className={`text-sm ${storageFailure||paused?'text-amber-900':'text-fe-navy'}`}>{status}</p>
        <div className="flex flex-wrap gap-3 text-sm"><button onClick={backup} className="text-fe-blue underline">Export review backup</button><button onClick={()=>setReset(!reset)} disabled={!seed} className="text-fe-blue underline disabled:opacity-40">Restore starter draft</button><Link href="/updates" className="text-fe-blue underline">Other imports</Link></div>
      </div>
      {paused&&<div className="bg-amber-50 border border-amber-200 p-3 mt-3 text-sm"><p>Your current edits are still visible but will not overwrite the other tab. Export a backup before loading its saved version.</p><button onClick={reloadSaved} className="underline mt-2">Load latest saved version</button></div>}
      {storageFailure&&<button onClick={()=>latest.current&&save(latest.current)} className="underline text-sm mt-2">Retry saving</button>}
      {error&&<p role="alert" className="bg-red-50 text-red-800 p-3 mt-3 text-sm">{error}</p>}
      {reset&&<div className="bg-amber-50 border border-amber-200 p-3 mt-3 text-sm"><p>This replaces your browser-saved edits and practice history with the original proposal. Export a backup first if needed. Nothing in production is affected.</p><button onClick={restoreStarter} className="bg-fe-navy text-white px-3 py-2 mt-3 mr-3">Confirm restore starter</button><button onClick={()=>setReset(false)} className="underline">Cancel</button></div>}
      <details className="mt-3 text-sm"><summary className="cursor-pointer text-fe-blue">Restore from a review backup</summary><label className="block mt-2">Choose a backup exported from this saved reviewer<input aria-label="Restore review backup" type="file" accept=".json" className="block mt-2" onChange={e=>{void readBackup(e.target.files?.[0]);e.target.value=''}} /></label></details>
      {recovery&&<div className="bg-amber-50 border border-amber-200 p-3 mt-3 text-sm"><p>Replace this browser’s current review with the uploaded backup? Edits and practice history will be replaced. Approval checkboxes will be cleared.</p><button onClick={restoreBackup} className="bg-fe-navy text-white px-3 py-2 mt-3 mr-3">Confirm restore backup</button><button onClick={()=>setRecovery(null)} className="underline">Cancel backup restore</button></div>}
    </div>
    {seed&&<>
      <details className="border border-fe-line bg-white p-4 mb-5"><summary className="font-bold text-sm cursor-pointer">Proposed plan and important boundaries</summary><ul className="list-disc pl-5 mt-3 text-sm space-y-2">{seed.notes.map((n,i)=><li key={i}>{n}</li>)}</ul><details className="mt-4 text-sm"><summary>Original source questions</summary><ul className="list-disc pl-5 mt-2 space-y-2">{seed.batch.questions.map((q,i)=><li key={i}>{q}</li>)}</ul></details></details>
      {initial&&<section aria-label="Social Strategy plan overview" className="bg-white border border-fe-line p-4 mb-5">
        <div className="flex flex-wrap justify-between items-center gap-3"><h2 className="font-barlow font-bold text-xl">Plan at a glance</h2><span className="text-sm">{seed.batch.updates.length} proposals · dates shown in Phoenix local calendar</span></div>
        <div className="flex flex-wrap gap-2 mt-4 mb-4">{[['all','All'],['marketing','Marketing'],['project_task','Tasks'],['program','Strategy'],['hold','On hold'],['skip','Skipped']].map(([value,label])=><button key={value} onClick={()=>setFilter(value)} aria-pressed={filter===value} className={`px-3 py-2 text-sm border ${filter===value?'bg-fe-navy text-white':'border-fe-line'}`}>{label}</button>)}</div>
        <div className="overflow-x-auto"><table className="text-sm w-full min-w-[720px] text-left"><thead className="border-b border-fe-line text-xs text-slate-600"><tr>{['Item / destination','Project','Owner','Proposed date','Review',''].map((t,i)=><th key={i} className="p-2">{t}</th>)}</tr></thead><tbody>{rows.map(({i,p,r,owner,project})=><tr key={i} className="border-b border-slate-100 align-top"><td className="p-2 max-w-xs"><span className="font-medium">{i+1}. {p.title}</span><span className="block text-xs text-slate-500 mt-1">{p.area.replaceAll('_',' ')}</span></td><td className="p-2 max-w-[190px]">{project}</td><td className="p-2">{p.area==='program'?'Strategy field (no task owner)':owner}</td><td className="p-2 whitespace-nowrap">{r.date||p.date||'No date'}<span className="block text-xs text-slate-500">{p.area==='program'?'Not a dated task':p.date_type==='post'?'Post / send':'Due'}</span></td><td className="p-2">{r.disposition==='hold'?'On hold':r.disposition==='skip'?'Skipped':'For review'}</td><td className="p-2"><button onClick={()=>editItem(i)} aria-label={`Edit plan item ${i+1}`} className="text-fe-blue underline">Edit</button></td></tr>)}</tbody></table></div>
      </section>}
      {initial&&<UpdateApproval key={generation} batch={seed.batch} selected={indices} savedReview={{initial,proposedProject:seed.proposedProject,onChange:change}} />}
    </>}
  </div>
}
