const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript')
function compile(file,deps={},extra={}){
  const box={exports:{},Date,Set,Map,console,URL,process:{env:{}},...extra,require:name=>{if(deps[name])return deps[name];throw Error(name)}}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(__dirname+'/../'+file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,box)
  return box.exports
}
const intake=compile('src/lib/update-intake.ts'),schedule=compile('src/lib/project-schedule.ts')
const lib=compile('src/lib/update-review.ts',{'./update-intake':intake,'./project-schedule':schedule})
const clone=x=>JSON.parse(JSON.stringify(x))
const seed={
  projects:[{id:'p1',name:'Sample program',status:'active',launch_date:'2026-11-01',start_date:'2026-12-01',workflow_type:'course-launch'},{id:'p2',name:'Other program',status:'active',launch_date:null,start_date:'2026-12-01'},{id:'p3',name:'Archived program',status:'archived',start_date:'2026-12-01'}],
  team_members:[{id:'u1',name:'Sample owner'},{id:'u2',name:'Other owner'}],
  marketing_content:[{id:'a1',title:'Existing blog',project_id:'p1',owner_id:'u1',scheduled_date:'2026-11-04',channels:['Blog'],status:'idea',copy_ready:false,creative_ready:false,source_task_id:null}],
  project_tasks:[
    {id:'t1',project_id:'p1',task_name:'Anchored task',phase:'Build',phase_order:1,task_order:1,week_number:1,owner_ids:['u1'],status:'not_started',due_date:'2026-10-25',schedule_anchor:'launch',schedule_offset_days:-7},
    {id:'t2',project_id:'p1',task_name:'Fixed task',status:'not_started',owner_ids:['u1'],due_date:'2026-10-20',schedule_anchor:'fixed',schedule_offset_days:null},
    {id:'t3',project_id:'p1',task_name:'Done task',status:'done',owner_ids:['u1'],due_date:'2026-10-01',schedule_anchor:'start',schedule_offset_days:0},
    {id:'t4',project_id:'p1',task_name:'Program preparation',status:'not_started',owner_ids:['u1'],due_date:'2026-11-26',schedule_anchor:'start',schedule_offset_days:-5},
  ],
  marketing_programs:[],seminars:[],task_comments:[],
}
const base={area:'marketing',action:'create',title:'New blog',project:'Sample program',owner:'Sample owner',date:'2026-11-05',date_type:'post',status:'idea',platforms:['Blog'],evidence:'An explicit QA commitment.',source_ref:'QA notes',questions:[]}
const batch=(...updates)=>({version:1,updates,questions:[]})
const workspace=()=>lib.newWorkspace(seed,'2026-10-22T12:00:00Z')
const approval={confirmed:true,reviewer:'QA reviewer'}
test('fuller marketing edits apply as one record without changing original evidence',()=>{
  const w=workspace(),b=batch(base),source=JSON.stringify(b)
  const r={0:{acknowledged:true,title:'Corrected title',description:'Approved instructions',platforms:['LinkedIn','X'],
    assetType:'post',targetAudience:'Analysts',copyReady:true,creativeReady:false}}
  const saved=apply(w,b,r),asset=saved.records.marketing_content.at(-1)
  assert.equal(asset.title,'Corrected title');assert.equal(asset.caption,'Approved instructions')
  assert.deepEqual(clone(asset.channels),['LinkedIn','X']);assert.equal(asset.copy_ready,true)
  assert.equal(asset.status,'idea');assert.equal(asset.asset_type,'post');assert.equal(asset.target_audience,'Analysts')
  assert.equal(JSON.stringify(b),source);assert.equal(saved.history[0].sources[0].evidence,base.evidence)
  assert.equal(plan(saved,b,r).rows[0].outcome,'duplicate')
})
test('rename a selected existing record keeps its id and stays duplicate-safe',()=>{
  const b=batch({...base,title:'Existing blog',action:'update',date:null,status:null,platforms:[]})
  const r={0:{acknowledged:true,targetId:'a1',title:'Renamed blog',description:'New caption'}}
  const saved=apply(workspace(),b,r)
  assert.equal(saved.records.marketing_content.length,1);assert.equal(saved.records.marketing_content[0].id,'a1')
  assert.equal(saved.records.marketing_content[0].title,'Renamed blog')
  assert.equal(plan(saved,b,r).rows[0].outcome,'duplicate')
})
test('destination correction resets match/status/date type and creates only the right kind',()=>{
  const b=batch({...base,action:'clarify',status:'scheduled'})
  const changed=lib.changeDestination({targetId:'a1',status:'posted',acknowledged:true},'project_task')
  assert.equal(changed.targetId,'auto');assert.equal(changed.status,'');assert.equal(changed.dateType,'due');assert.equal(changed.acknowledged,false)
  const saved=apply(workspace(),b,{0:{...changed,action:'create',description:'Operational instructions',acknowledged:true}})
  assert.equal(saved.records.marketing_content.length,1)
  assert.equal(saved.records.project_tasks.at(-1).status,'not_started')
  assert.equal(saved.records.task_comments.at(-1).comment,'Operational instructions')
  assert.equal(saved.records.task_comments.at(-1).task_id,saved.records.project_tasks.at(-1).id)
})
test('task descriptions append comments, do not overwrite old comments, and undo together',()=>{
  const w=workspace();w.records.task_comments.push({id:'c1',task_id:'t2',comment:'Original note',team_member_id:'u1'})
  const b=batch({...base,title:'Fixed task',area:'project_task',action:'update',date:null,status:null,platforms:[]})
  const r={0:{acknowledged:true,description:'Additional instructions'}}
  const saved=apply(w,b,r)
  assert.equal(saved.records.task_comments.length,2);assert.equal(saved.records.task_comments[0].comment,'Original note')
  assert.equal(plan(saved,b,r).rows[0].outcome,'duplicate')
  assert.deepEqual(clone(lib.undoLatest(saved,'batch-1').records),clone(w.records))
})
test('held and skipped items do not block or write; restoration preserves their edits',()=>{
  const b=batch(base,{...base,title:'Unresolved held',action:'clarify'},{...base,title:'Skipped',action:'clarify'})
  const r={0:{acknowledged:true},1:{disposition:'hold',title:'Corrected held title'},2:{disposition:'skip'}}
  const review=plan(workspace(),b,r)
  assert.equal(review.issues.length,0);assert.equal(review.changes.length,1)
  assert.deepEqual(clone(review.rows.map(x=>x.outcome)),['ready','held','skipped'])
  const saved=apply(workspace(),b,r)
  assert.equal(saved.records.marketing_content.length,2);assert.equal(saved.history[0].sources.length,1)
  assert.equal(plan(saved,b,{...r,1:{...r[1],disposition:'include'}}).rows[1].outcome,'blocked')
  assert.equal(r[1].title,'Corrected held title')
})
test('bulk updates only selected included supported fields and never milestone dates',()=>{
  const b=batch(base,{...base,area:'project_dates',date_type:'program_start'},{...base,area:'seminar',date_type:'seminar'},{...base,title:'Held'})
  const r={0:{acknowledged:true},1:{acknowledged:true},2:{acknowledged:true},3:{disposition:'hold',acknowledged:true}}
  const next=lib.bulkResolve(b,r,[0,1,2,3],{projectId:'p2',ownerId:'u2',date:'2026-11-20'})
  assert.equal(next[0].projectId,'p2');assert.equal(next[0].ownerId,'u2');assert.equal(next[0].date,'2026-11-20')
  assert.equal(next[0].acknowledged,false);assert.equal(next[1].date,undefined);assert.equal(next[1].ownerId,undefined)
  assert.equal(next[2].projectId,undefined);assert.equal(next[2].ownerId,undefined);assert.equal(next[2].date,'2026-11-20')
  assert.equal(next[3],r[3]);assert.equal(r[0].acknowledged,true)
  assert.equal(lib.bulkResolve(b,r,[0],{ownerId:'u2'})[1],r[1])
})
test('blank text cannot erase existing content and bad edits block',()=>{
  const w=workspace();w.records.marketing_content[0].caption='Original caption'
  const b=batch({...base,title:'Existing blog',action:'update',date:null,status:null,platforms:[]})
  assert.equal(plan(w,b,{0:{acknowledged:true,description:''}}).rows[0].outcome,'duplicate')
  for(const patch of [{title:' '},{description:'x'.repeat(4001)},{platforms:[]},{platforms:['Unsupported']},{assetType:'invalid'}]){
    assert.equal(plan(w,b,{0:{acknowledged:true,...patch}}).rows[0].outcome,'blocked')
  }
})
test('any correction after before/after review invalidates final approval',()=>{
  const w=workspace(),b=batch(base),r={0:{acknowledged:true}},review=plan(w,b,r)
  for(const patch of [{title:'Different'},{description:'Changed'},{platforms:['Email']},{disposition:'hold'},{area:'project_task',dateType:'due',status:''}]){
    assert.throws(()=>apply(w,b,{0:{...r[0],...patch}},'changed',[0],review),/changed/)
  }
})
test('seminar reclassification explicitly omits unsupported relationships and preserves notes',()=>{
  const b=batch(base),r={0:{...lib.changeDestination({},'seminar'),description:'Seminar instructions',acknowledged:true}}
  const saved=apply(workspace(),b,r)
  assert.equal(saved.records.seminars[0].notes,'Seminar instructions')
  assert.equal(saved.records.seminars[0].owner_id,undefined);assert.equal(saved.records.seminars[0].project_id,undefined)
})
function plan(w,b,r,selected=b.updates.map((_,i)=>i)){return lib.reviewBatch(w,b,r,selected)}
function apply(w,b,r,key='batch-1',selected=b.updates.map((_,i)=>i),review=plan(w,b,r,selected)){return lib.applyBatch(w,b,r,selected,review,approval,key,'2026-10-22T12:30:00Z')}
test('create marketing once, keep shared dated record, preserve source and never mutate original',()=>{
  const w=workspace(),b=batch(base),r={0:{acknowledged:true}},before=JSON.stringify(w)
  const review=plan(w,b,r);assert.equal(review.issues.length,0);assert.equal(review.changes.length,1)
  const saved=apply(w,b,r);assert.equal(saved.records.marketing_content.length,2);assert.equal(saved.history[0].sources[0].evidence,base.evidence)
  assert.equal(JSON.stringify(w),before);assert.equal(saved.records.marketing_content[1].scheduled_date,'2026-11-05')
  assert.equal(lib.applyBatch(saved,b,r,[0],review,approval,'batch-1','later'),saved)
  assert.equal(plan(saved,b,r).rows[0].outcome,'duplicate')
})
test('updates require exact existing records; omitted fields do not erase values',()=>{
  const w=workspace(),b=batch({...base,action:'update',title:'Existing blog',date:null,owner:null,status:'drafted',platforms:[]})
  const saved=apply(w,b,{0:{acknowledged:true}})
  assert.equal(saved.records.marketing_content[0].status,'drafted');assert.equal(saved.records.marketing_content[0].owner_id,'u1')
  assert.equal(saved.records.marketing_content[0].scheduled_date,'2026-11-04')
  assert.equal(plan(w,batch({...base,action:'update'}),{0:{acknowledged:true}}).rows[0].outcome,'blocked')
})
test('create matching existing but different requires explicit target; repeated exact rows skip',()=>{
  const w=workspace(),b=batch({...base,title:'Existing blog'})
  assert.match(plan(w,b,{0:{acknowledged:true}}).issues.join(' '),/existing item matches/)
  assert.equal(plan(w,b,{0:{acknowledged:true,targetId:'a1'}}).issues.length,0)
  assert.equal(plan(w,b,{0:{acknowledged:true,targetId:'new'}}).changes[0].before,null)
  const exact=batch({...base,title:'Existing blog',date:'2026-11-04'})
  assert.equal(plan(w,exact,{0:{acknowledged:true}}).rows[0].outcome,'duplicate')
})
test('ambiguous title, owner and project never auto match',()=>{
  const w=workspace();w.records.marketing_content.push({...seed.marketing_content[0],id:'a2'})
  assert.match(plan(w,batch({...base,title:'Existing blog'}),{0:{acknowledged:true}}).issues.join(' '),/Several records/)
  assert.equal(plan(w,batch({...base,title:'Existing blog'}),{0:{acknowledged:true,targetId:'a1'}}).issues.length,0)
  w.records.team_members.push({id:'u3',name:'Sample owner'})
  assert.match(plan(w,batch(base),{0:{acknowledged:true}}).issues.join(' '),/owner/)
  w.records.projects.push({...seed.projects[0],id:'p4'})
  assert.match(plan(w,batch(base),{0:{acknowledged:true}}).issues.join(' '),/project/)
})
test('unlinked marketing requires deliberate choice; missing dates/owners/platforms blocked',()=>{
  for(const patch of [{project:null},{owner:null},{date:null},{platforms:[]},{date:'2026-13-01'},{date_type:'due'}]){
    assert.ok(plan(workspace(),batch({...base,...patch}),{0:{acknowledged:true}}).issues.length)
  }
  assert.equal(plan(workspace(),batch({...base,project:null}),{0:{projectId:'unlinked',acknowledged:true}}).issues.length,0)
})
test('inactive projects, unsupported publication status and posted regression protected',()=>{
  const w=workspace()
  assert.ok(plan(w,batch({...base,project:'Archived program'}),{0:{acknowledged:true}}).issues.length)
  assert.match(plan(w,batch({...base,status:'done'}),{0:{acknowledged:true}}).issues.join(' '),/publication/)
  w.records.marketing_content[0].status='posted'
  assert.match(plan(w,batch({...base,action:'update',title:'Existing blog',status:'idea'}),{0:{acknowledged:true}}).issues.join(' '),/regression/)
})
test('unconfirmed evidence and tentative decisions cannot apply; explicit resolution can',()=>{
  const w=workspace(),b=batch({...base,action:'clarify'})
  assert.ok(plan(w,b,{}).issues.length)
  assert.equal(plan(w,b,{0:{action:'create',acknowledged:true}}).issues.length,0)
  assert.throws(()=>lib.applyBatch(w,b,{0:{action:'create',acknowledged:true}},[0],plan(w,b,{0:{action:'create',acknowledged:true}}),{confirmed:false,reviewer:'QA'},'k','now'),/Confirm/)
})
test('new tasks have one owner, required phase and fixed explicit due date',()=>{
  const saved=apply(workspace(),batch({...base,area:'project_task',date_type:'due',status:'not started',platforms:[]}),{0:{acknowledged:true}})
  const task=saved.records.project_tasks.at(-1)
  assert.equal(task.phase,'Imported commitments');assert.equal(task.owner_ids.length,1);assert.equal(task.schedule_anchor,'fixed');assert.equal(task.role_id,null)
})
test('both project anchors merge then cascade saved rules, preserving fixed and completed',()=>{
  const w=workspace(),b=batch(
    {...base,area:'project_dates',title:'Move marketing launch',action:'update',date_type:'marketing_launch',date:'2027-02-01'},
    {...base,area:'project_dates',title:'Move program start',action:'update',date_type:'program_start',date:'2027-03-01'})
  const r={0:{acknowledged:true},1:{acknowledged:true}}
  const review=plan(w,b,r);assert.equal(review.issues.length,0);assert.equal(review.changes.length,3)
  const saved=apply(w,b,r)
  assert.equal(saved.records.projects[0].start_date,'2027-03-01')
  assert.equal(saved.records.project_tasks[0].due_date,'2027-01-25')
  assert.equal(saved.records.project_tasks[1].due_date,'2026-10-20')
  assert.equal(saved.records.project_tasks[2].due_date,'2026-10-01')
  assert.equal(saved.records.project_tasks[3].due_date,'2027-02-24')
})
test('date order and explicit/cascade conflicts block entire batch',()=>{
  const w=workspace(),date={...base,area:'project_dates',title:'Move launch',action:'update',date_type:'marketing_launch',date:'2026-11-20'}
  assert.ok(plan(w,batch({...date,date:'2027-01-01'}),{0:{acknowledged:true}}).issues.length)
  const b=batch(date,{...base,area:'project_task',action:'update',title:'Anchored task',date_type:'due',date:'2026-12-01',status:null,platforms:[]})
  const r={0:{acknowledged:true},1:{acknowledged:true}}
  assert.match(plan(w,b,r).issues.join(' '),/Conflicting changes/)
  assert.throws(()=>apply(w,b,r),/Resolve/);assert.equal(w.version,0)
})
test('done tasks cannot be reopened or moved and legacy unconfigured dates stay fixed',()=>{
  const w=workspace();w.records.project_tasks[0].schedule_anchor=null
  const b=batch({...base,area:'project_dates',title:'Move launch',action:'update',date_type:'marketing_launch',date:'2026-11-20'})
  assert.equal(plan(w,b,{0:{acknowledged:true}}).changes.length,1)
  const done=batch({...base,area:'project_task',action:'update',title:'Done task',date_type:'due',status:'in progress'})
  assert.match(plan(w,done,{0:{acknowledged:true}}).issues.join(' '),/Completed tasks/)
})
test('same-target conflicting decisions and repeated creates never silently overwrite',()=>{
  const b=batch({...base,title:'Existing blog',action:'update',date:'2026-11-10'},{...base,title:'Existing blog',action:'update',date:'2026-11-11'})
  const r={0:{acknowledged:true},1:{acknowledged:true}}
  assert.match(plan(workspace(),b,r).issues.join(' '),/Conflicting/)
  assert.match(plan(workspace(),batch(base,base),r).issues.join(' '),/same item/)
})
test('unknown program fields rejected; exact goals saved without changing schedule overrides',()=>{
  assert.throws(()=>intake.parseUpdateBatch(JSON.stringify(batch({...base,program_fields:{secret:'no'}}))),/program fields/)
  const w=workspace();w.records.marketing_programs.push({id:'mp1',project_id:'p1',goal:'Old goal',program_start:'2026-12-05'})
  const b=batch({...base,area:'program',action:'update',title:'Program goal',program_fields:{goal:'Agreed goal'}})
  const saved=apply(w,b,{0:{acknowledged:true}})
  assert.equal(saved.records.marketing_programs[0].goal,'Agreed goal')
  assert.equal(saved.records.marketing_programs[0].program_start,'2026-12-05')
})
test('seminars follow their real schema, client commitments with project/owner require task classification',()=>{
  const p={...base,area:'seminar',date_type:'seminar',project:null,owner:null,status:null,platforms:[]}
  assert.equal(plan(workspace(),batch(p),{0:{acknowledged:true}}).issues.length,0)
  assert.ok(plan(workspace(),batch({...p,project:'Sample program'}),{0:{acknowledged:true}}).issues.length)
})
test('stale reviews and changed retry payloads fail; undo latest is atomic and conflict safe',()=>{
  const w=workspace(),b=batch(base),r={0:{acknowledged:true}},review=plan(w,b,r)
  const changed=clone(w);changed.records.marketing_content[0].status='drafted'
  assert.throws(()=>apply(changed,b,r,'b1',[0],review),/changed/)
  const saved=apply(w,b,r)
  assert.throws(()=>apply(saved,batch({...base,title:'Changed'}),r),/already been used/)
  const undone=lib.undoLatest(saved,'batch-1')
  assert.equal(undone.records.marketing_content.length,1);assert.equal(undone.history[0].undone,true)
  const conflicting=clone(saved);conflicting.records.marketing_content[1].title='Changed elsewhere'
  assert.throws(()=>lib.undoLatest(conflicting,'batch-1'),/changed after/)
  const twice=apply(saved,batch({...base,title:'Second blog'}),r,'batch-2')
  assert.throws(()=>lib.undoLatest(twice,'batch-1'),/most recent/)
})
test('deselecting a blocked item permits only the chosen valid changes',()=>{
  const b=batch(base,{...base,title:'Unknown project',project:'Missing'}),r={0:{acknowledged:true},1:{acknowledged:true}}
  assert.equal(plan(workspace(),b,r,[0]).issues.length,0)
  const saved=apply(workspace(),b,r,'chosen',[0]);assert.equal(saved.records.marketing_content.length,2);assert.equal(saved.history[0].sources.length,1)
})
test('practice copy endpoint is preview-only, select-only and fails closed on missing data',async()=>{
  let queries=0
  const response={json:(body,opts)=>({body,status:opts?.status||200,headers:opts?.headers})}
  const route=env=>compile('src/app/api/updates/workspace/route.ts',{'next/server':{NextResponse:response},'@/lib/supabase':{supabase:{from:()=>{queries++;return {select:()=>({order:()=>({range:async()=>({data:[],error:null})})})}}}}},{process:{env}}).GET
  assert.equal((await route({VERCEL_ENV:'production',OPS_LOCAL_REVIEW:'true'})()).status,403);assert.equal(queries,0)
  const result=await route({VERCEL_ENV:'preview'})();assert.equal(result.status,200);assert.equal(queries,7);assert.equal(result.headers['Cache-Control'],'no-store')
  const failed=compile('src/app/api/updates/workspace/route.ts',{'next/server':{NextResponse:response},'@/lib/supabase':{supabase:{from:()=>({select:()=>({order:()=>({range:async()=>({error:{message:'secret provider error'}})})})})}}},{process:{env:{VERCEL_ENV:'preview'}}}).GET
  assert.equal((await failed()).status,503)
  assert.equal(JSON.stringify(await failed()).includes('secret provider'),false)
})
test('snapshot paginates full tables rather than accepting the default cap',async()=>{
  const calls=[]
  const GET=compile('src/app/api/updates/workspace/route.ts',{
    'next/server':{NextResponse:{json:(body,opts)=>({body,status:opts?.status||200})}},
    '@/lib/supabase':{supabase:{from:table=>({select:()=>({order:()=>({range:async(from,to)=>{
      calls.push([table,from,to])
      return {error:null,data:table==='marketing_content' && from===0?Array.from({length:500},(_,i)=>({id:String(i)})):table==='marketing_content'?[{id:'500'}]:[]}
    }})})})}},
  },{process:{env:{VERCEL_ENV:'preview'}}}).GET
  const result=await GET();assert.equal(result.body.records.marketing_content.length,501)
  assert.ok(calls.some(c=>c[0]==='marketing_content' && c[1]===500 && c[2]===999))
})
test('new phases get stable distinct order and unchanged channel sets remain duplicates',()=>{
  const w=workspace(),p={...base,area:'project_task',date_type:'due',status:'not started',platforms:[]}
  const saved=apply(w,batch({...p,title:'Task one'},{...p,title:'Task two'}),{0:{acknowledged:true,phase:'First import phase'},1:{acknowledged:true,phase:'Second import phase'}})
  assert.notEqual(saved.records.project_tasks.at(-2).phase_order,saved.records.project_tasks.at(-1).phase_order)
  w.records.marketing_content[0].channels=['YouTube','Blog']
  const result=plan(w,batch({...base,title:'Existing blog',date:'2026-11-04',platforms:['Blog','YouTube']}),{0:{acknowledged:true}})
  assert.equal(result.rows[0].outcome,'duplicate')
})
test('explicit readiness can update without falsely claiming publication',()=>{
  const b=intake.parseUpdateBatch(JSON.stringify(batch({...base,action:'update',title:'Existing blog',date:null,status:null,owner:null,platforms:[],creative_ready:true})))
  const saved=apply(workspace(),b,{0:{acknowledged:true}})
  assert.equal(saved.records.marketing_content[0].creative_ready,true);assert.equal(saved.records.marketing_content[0].status,'idea')
  assert.throws(()=>intake.parseUpdateBatch(JSON.stringify(batch({...base,copy_ready:'yes'}))),/Readiness/)
})
