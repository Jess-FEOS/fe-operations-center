const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript')
function compile(file,req=()=>{throw Error('Unexpected dependency')}){
  const box={exports:{},URL,URLSearchParams,console,require:req}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(__dirname+'/../'+file,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
  }).outputText,box);return box.exports
}
const company=compile('src/lib/company-calendar.ts')
const ownership=compile('src/lib/ownership.ts')
const projects=[
  {id:'p1',name:'Sample client training',status:'active',start_date:'2026-11-16',launch_date:null,is_enterprise:true,enterprise_client_label:'Sample client',enterprise_owner_id:'u1',notes:'PRIVATE_NOT_FOR_CALENDAR'},
  {id:'p2',name:'Public program',status:'active',start_date:'2026-11-25',launch_date:'2026-11-05'},
  {id:'p3',name:'Archived',status:'archived',start_date:'2026-11-16',is_enterprise:true},
]
const task=(id,kind,status='not_started')=>({id,project_id:'p1',task_name:id,due_date:'2026-11-10',status,company_calendar_kind:kind,owner_ids:['u1']})
const tasks=[task('materials','deliverable'),task('workshop','session'),task('internal',null),task('done','deliverable','done'),
  {...task('archived','deliverable'),project_id:'p3'},{...task('nonenterprise','deliverable'),project_id:'p2'}]
const filters={from:'2026-11-01',to:'2026-11-30'}
test('Company includes project milestones and explicit enterprise commitments only',()=>{
  const result=company.companyCommitments(projects,tasks,filters)
  assert.equal(result.length,5)
  assert.deepEqual(Array.from(result.filter(e=>e.type==='enterprise'),e=>e.id).sort(),['materials','workshop'])
  assert.match(result.find(e=>e.id==='start-p1').label,/Client kickoff/)
  assert.equal(JSON.stringify(result).includes('PRIVATE_NOT_FOR_CALENDAR'),false)
})
test('Project and owner filters preserve one source and do not leak unrelated work',()=>{
  const result=company.companyCommitments(projects,tasks,{...filters,ownerId:'u1'})
  assert.equal(result.length,3)
  assert.ok(result.every(e=>e.project_id==='p1'))
  assert.equal(company.companyCommitments(projects,tasks,{...filters,projectId:'p3'}).length,0)
  assert.equal(company.companyCommitments(projects,tasks,{...filters,ownerId:'u2'}).length,0)
})
test('Changing task date moves same event; clearing flag or completing hides without deleting',()=>{
  const moved=tasks.map(t=>t.id==='materials'?{...t,due_date:'2026-11-23'}:t)
  assert.equal(company.companyCommitments(projects,moved,filters).find(e=>e.id==='materials').date,'2026-11-23')
  for(const patch of [{status:'done'},{company_calendar_kind:null},{due_date:'2027-01-01'}])
    assert.equal(company.companyCommitments(projects,tasks.map(t=>t.id==='materials'?{...t,...patch}:t),filters).some(e=>e.id==='materials'),false)
  assert.equal(tasks[0].due_date,'2026-11-10')
})
test('Archive/complete/pause hides milestones and commitments; restoring returns existing IDs',()=>{
  for(const status of ['archived','completed','paused']){
    assert.equal(company.companyCommitments(projects.map(p=>({...p,status})),tasks,filters).length,0)
  }
  assert.equal(company.companyCommitments(projects,tasks,filters).find(e=>e.id==='materials').id,'materials')
})
test('Unapplied migration is compatible; no date-based completion or implicit task classification',()=>{
  assert.equal(company.companyCommitments(projects.map(({is_enterprise,enterprise_owner_id,enterprise_client_label,...p})=>p),tasks,filters).length,3)
  assert.ok(company.companyCommitments(projects,[task('old but open','deliverable')],filters).some(e=>e.id==='old but open'))
  for(const bad of ['marketing','internal','',false,undefined])assert.equal(company.validCompanyTaskKind(bad),false)
  for(const good of [null,'session','deliverable'])assert.equal(company.validCompanyTaskKind(good),true)
})
function api({fail,empty=false}={}){
  const touched=[]
  const rows={projects:empty?[]:projects,project_tasks:empty?[]:tasks,seminars:[{id:'s1',seminar_date:'2026-11-12',title:'Seminar'}]}
  const supabase={from(table){touched.push(table);let data=rows[table]||[]
    const q={select(){return q},eq(k,v){data=data.filter(r=>r[k]===v);return q},
      neq(k,v){data=data.filter(r=>r[k]!==v);return q},gte(k,v){data=data.filter(r=>r[k]>=v);return q},
      lte(k,v){data=data.filter(r=>r[k]<=v);return q},
      then(resolve){return Promise.resolve({data,error:fail===table?{message:'Broken'}:null}).then(resolve)}};return q}}
  const GET=compile('src/app/api/calendar/company/route.ts',name=>{
    if(name==='next/server')return {NextResponse:{json:(data,options)=>({data,status:options?.status||200})}}
    if(name==='@/lib/supabase')return {supabase}
    if(name==='@/lib/company-calendar')return company
    if(name==='@/lib/ownership')return ownership
    if(name==='@/lib/calendar')return {validCalendarDate:d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')}
    if(name==='@/lib/ownership-server')return {loadOwnership:async()=>({people:[{id:'u1',name:'Sample owner'}],joins:[]})}
    throw Error(name)
  }).GET
  return {GET,touched}
}
test('Company API never queries marketing, returns owner names and seminars, and reports errors',async()=>{
  const {GET,touched}=api(),request={url:'https://test/api/calendar/company?from=2026-11-01&to=2026-11-30'}
  const result=await GET(request)
  assert.equal(result.status,200);assert.equal(result.data.events.length,6)
  assert.equal(result.data.events.find(e=>e.id==='materials').owner_names[0],'Sample owner')
  assert.equal(touched.includes('marketing_content'),false)
  assert.equal((await api({fail:'project_tasks'}).GET(request)).status,500)
  assert.equal((await GET({url:'https://test/api/calendar/company'})).status,400)
  assert.equal((await GET({url:request.url+'&owner_id=u1'})).data.events.some(e=>e.type==='seminar'),false)
  assert.equal((await api({empty:true}).GET(request)).data.events.length,1)
})
test('UI removes silent task cascades and marketing layer; additive migration changes no records',()=>{
  const page=fs.readFileSync(__dirname+'/../src/app/projects/[id]/page.tsx','utf8')
  assert.equal(page.includes('shiftedUpdates'),false)
  assert.ok(page.includes("if (!res.ok) throw new Error(updated.error"))
  const view=fs.readFileSync(__dirname+'/../src/components/calendar/CompanyCalendar.tsx','utf8')
  assert.equal(view.includes("key: 'marketing'"),false)
  assert.ok(view.includes('/api/calendar/company?'))
  const sql=fs.readFileSync(__dirname+'/../supabase/migrations/20261022_enterprise_company_calendar.sql','utf8')
  assert.equal((sql.match(/add column if not exists/g)||[]).length,4)
  assert.equal(/\b(delete from|truncate|drop table|update public)\b/i.test(sql),false)
})

function editorApi(options={}){
  const state={project:{...projects[0]},task:{...tasks[0]},writes:[],...options}
  const supabase={from(table){
    let change
    const q={select(){return q},eq(){return q},update(data){change=data;return q},
      async single(){
        const record=table==='projects'?state.project:state.task
        if(change){state.writes.push({table,change});Object.assign(record,change)}
        return {data:record,error:null}
      }};return q
  }}
  function req(name){
    if(name==='next/server')return {NextResponse:{json:(data,options)=>({data,status:options?.status||200})}}
    if(name==='@/lib/supabase')return {supabase}
    if(name==='@/lib/company-calendar')return company
    if(name==='@/lib/ownership')return ownership
    if(name==='@/lib/project-schedule')return {validDate:d=>/^\d{4}-\d{2}-\d{2}$/.test(d)}
    if(name==='@/lib/ownership-server')return {loadOwnership:async()=>({people:[{id:'u1',name:'Sample owner'}],joins:[]}),enrichOwnership:t=>t}
    throw Error(name)
  }
  const project=compile('src/app/api/projects/[id]/route.ts',req).PATCH
  const task=compile('src/app/api/projects/[id]/tasks/[taskId]/route.ts',req).PATCH
  const context={params:Promise.resolve({id:'p1',taskId:'materials'})}
  return {state,project:body=>project({json:async()=>body},context),task:body=>task({json:async()=>body},context)}
}
test('Project settings validate label/type/owner; missing migration cannot report success',async()=>{
  for(const body of [{is_enterprise:'yes'},{is_enterprise:null},{enterprise_client_label:''},{enterprise_owner_id:'missing'},
    {enterprise_client_label:'a'.repeat(161)}]){
    const app=editorApi();assert.equal((await app.project(body)).status,400);assert.equal(app.state.writes.length,0)
  }
  const missing=editorApi({project:{id:'p1',status:'active'}})
  assert.equal((await missing.project({is_enterprise:true})).status,503)
  assert.equal(missing.state.writes.length,0)
  const valid=editorApi()
  assert.equal((await valid.project({is_enterprise:true,enterprise_client_label:' Safe label ',enterprise_owner_id:'u1'})).status,200)
  assert.equal(valid.state.project.enterprise_client_label,'Safe label')
  assert.equal(valid.state.writes[0].change.start_date,undefined)
})
test('Task opt-in requires enterprise, explicit kind and a single resolved owner; clearing preserves task',async()=>{
  for(const kind of ['marketing','',false]){
    const app=editorApi();assert.equal((await app.task({company_calendar_kind:kind})).status,400);assert.equal(app.state.writes.length,0)
  }
  const nonEnterprise=editorApi({project:{...projects[0],is_enterprise:false}})
  assert.equal((await nonEnterprise.task({company_calendar_kind:'session'})).status,400)
  const missing=editorApi({task:{id:'materials'}})
  assert.equal((await missing.task({company_calendar_kind:'session'})).status,503)
  const noOwner=editorApi({task:{...tasks[0],owner_ids:[]}})
  assert.equal((await noOwner.task({company_calendar_kind:'session'})).status,400)
  assert.equal((await noOwner.task({company_calendar_kind:'session',owner_ids:['u1']})).status,200)
  assert.equal(noOwner.state.task.id,'materials')
  assert.equal((await noOwner.task({company_calendar_kind:null})).status,200)
  assert.equal(noOwner.state.task.company_calendar_kind,null)
})
