const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),zlib=require('node:zlib')
function compile(file,deps={}){
  const box={exports:{},Date,Set,Map,console,URL,Uint8Array,DataView,atob,require:n=>{if(deps[n])return deps[n];throw Error(n)}}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(__dirname+'/../'+file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,box)
  return box.exports
}
const intake=compile('src/lib/update-intake.ts'),schedule=compile('src/lib/project-schedule.ts')
const review=compile('src/lib/update-review.ts',{'./update-intake':intake,'./project-schedule':schedule})
const lib=compile('src/lib/saved-review.ts',{'./update-intake':intake,'./update-review':review,fflate:require('fflate')})
const clone=x=>JSON.parse(JSON.stringify(x))
const project={id:'practice-project-sample',name:'Sample ongoing work',status:'active',workflow_type:'ongoing',start_date:null,launch_date:null}
const raw={version:1,id:'social-strategy',revision:'test-1',title:'Sample review',
  batch:{version:1,updates:[{area:'marketing',action:'create',title:'Sample post',project:null,owner:null,date:null,date_type:'post',status:'idea',platforms:['LinkedIn'],evidence:'Sample source excerpt.',source_ref:'Test notes',questions:[]}],questions:[]},
  resolutions:{0:{projectId:project.id,ownerId:'u1',date:'2026-11-02',description:'Suggested instructions',acknowledged:true}},
  proposedProject:project,notes:['Proposed, not approved.']}
const seed=()=>lib.parseSavedSeed(clone(raw))
const records=()=>Object.fromEntries(review.TABLES.map(t=>[t,t==='team_members'?[{id:'u1',name:'Sample owner'}]:[]]))
const editor=()=>({workspace:review.newWorkspace(lib.addProposedProject(records(),project).records,'2026-10-22T12:00:00Z'),resolutions:clone(raw.resolutions),view:'Changes'})
test('seed and saved document remove approvals while preserving editable values',()=>{
  const s=seed();assert.equal(s.resolutions[0].acknowledged,false)
  const restored=lib.parseSavedDocument(lib.serializeSavedDocument(s,editor(),'2026-10-22T13:00:00Z'),s)
  assert.equal(restored.editor.resolutions[0].acknowledged,false)
  assert.equal(restored.editor.resolutions[0].description,'Suggested instructions')
  assert.equal(restored.editor.resolutions[0].date,'2026-11-02')
  assert.equal(restored.editor.workspace.records.projects[0].id,project.id)
})
test('practice apply history restores and remains undoable without reapplying',()=>{
  const s=seed(),e=editor(),p=review.reviewBatch(e.workspace,s.batch,e.resolutions,[0])
  e.workspace=review.applyBatch(e.workspace,s.batch,e.resolutions,[0],p,{confirmed:true,reviewer:'QA'},'test-batch','2026-10-22T13:00:00Z')
  e.view='Calendar'
  const restored=lib.parseSavedDocument(lib.serializeSavedDocument(s,e,'2026-10-22T13:01:00Z'),s).editor
  assert.equal(restored.view,'Calendar');assert.equal(restored.workspace.records.marketing_content.length,1)
  assert.equal(restored.workspace.history.length,1);assert.equal(restored.resolutions[0].acknowledged,false)
  assert.equal(review.undoLatest(restored.workspace,'test-batch').records.marketing_content.length,0)
})
test('hold skip title and platform edits survive serialization',()=>{
  const s=seed(),e=editor()
  e.resolutions[0]={...e.resolutions[0],title:'Changed title',disposition:'hold',platforms:['Email'],copyReady:false}
  const restored=lib.parseSavedDocument(lib.serializeSavedDocument(s,e,'now'),s)
  assert.equal(restored.editor.resolutions[0].title,'Changed title')
  assert.equal(restored.editor.resolutions[0].disposition,'hold')
  assert.deepEqual(clone(restored.editor.resolutions[0].platforms),['Email'])
})
test('stale revision corrupt state and forged field shapes fail without modifying original text',()=>{
  const s=seed(),text=lib.serializeSavedDocument(s,editor(),'now')
  const modifications=[
    d=>d.seedRevision='different',d=>d.version=7,d=>d.editor.view='Unknown',
    d=>d.editor.resolutions[0].date='2026-02-30',
    d=>d.editor.resolutions[0].programFields={bad:'field'},
    d=>d.editor.workspace.records.team_members[0].name={html:'bad'},
    d=>d.editor.workspace.records.project_tasks.push({id:'broken',owner_ids:{bad:1}}),
    d=>d.seed.batch.updates[0].evidence='Changed original evidence',
  ]
  for(const change of modifications){const d=JSON.parse(text);change(d);assert.throws(()=>lib.parseSavedDocument(JSON.stringify(d),s))}
  assert.throws(()=>lib.parseSavedDocument('{',s))
  assert.throws(()=>lib.parseSavedDocument('x'.repeat(lib.MAX_SAVED_REVIEW+1),s))
  assert.equal(lib.parseSavedDocument(text,s).editor.view,'Changes')
})
test('unexpected resolution properties and invalid indices are rejected',()=>{
  for(const r of [{99:{}},{'-1':{}},{constructor:{}},{0:{confirmed:true}},{0:{area:'payments'}},{0:{platforms:'Blog'}}])assert.throws(()=>lib.cleanResolutions(r,1))
})
test('draft project clones records; an active matching real project is reused',()=>{
  const original=records(),first=lib.addProposedProject(original,project)
  assert.equal(original.projects.length,0);assert.equal(first.records.projects.length,1)
  assert.equal(lib.addProposedProject(first.records,project).records.projects.length,1)
  original.projects.push({...project,id:'real-id'})
  assert.equal(lib.addProposedProject(original,project).projectId,'real-id')
  original.projects[0].status='archived'
  assert.throws(()=>lib.addProposedProject(original,project),/inactive/)
})
test('private starter fragment decodes data without trusting code or approval',()=>{
  const hash='#review='+zlib.gzipSync(JSON.stringify(raw)).toString('base64url')
  const s=lib.seedFromFragment(hash);assert.equal(s.batch.updates[0].title,'Sample post')
  assert.equal(s.resolutions[0].acknowledged,false)
  assert.equal(lib.seedFromFragment('#ordinary-anchor'),null)
  assert.throws(()=>lib.seedFromFragment('#review=broken'))
  assert.throws(()=>lib.seedFromFragment('#review='+'a'.repeat(60001)))
  const data=zlib.gzipSync(JSON.stringify(raw));data.writeUInt32LE(200001,data.length-4)
  assert.throws(()=>lib.seedFromFragment('#review='+data.toString('base64url')))
})
test('preview gating never allows production even if local flag is true',()=>{
  assert.equal(lib.reviewEnabled({VERCEL_ENV:'production',OPS_LOCAL_REVIEW:'true'}),false)
  assert.equal(lib.reviewEnabled({VERCEL_ENV:'preview'}),true)
  assert.equal(lib.reviewEnabled({OPS_LOCAL_REVIEW:'true'}),true)
  assert.equal(lib.reviewEnabled({}),false)
})
test('saved reviewer has no write API and source material is not committed',()=>{
  const code=fs.readFileSync(__dirname+'/../src/components/SavedSocialReview.tsx','utf8')
  assert.equal(code.includes("method:'POST'"),false)
  assert.equal(code.includes('localStorage.setItem'),true)
  assert.equal(fs.existsSync(__dirname+'/../src/data/social-strategy.json'),false)
})
