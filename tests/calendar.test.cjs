const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript')
function compile(file,requireFn){
  const box={exports:{},URL,URLSearchParams,console,require:requireFn}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(__dirname+'/../'+file,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
  }).outputText,box)
  return box.exports
}
const marketing=compile('src/lib/marketing.ts')
const calendar=compile('src/lib/calendar.ts',()=>marketing)
const ownership=compile('src/lib/ownership.ts')
test('calendar dates reject malformed and impossible dates',()=>{
  for(const date of ['2026-02-30','2026-13-01','oops','2026-1-1',null])assert.equal(calendar.validCalendarDate(date),false)
  assert.equal(calendar.validCalendarDate('2028-02-29'),true)
  assert.equal(marketing.toISO(calendar.calendarDate('2026-11-09')),'2026-11-09')
})
test('view URLs preserve date/program/owner and clear modal actions',()=>{
  const href=calendar.calendarHref(new URLSearchParams('view=marketing&date=2026-11-09&program=p1&owner=u1&asset=a1&new=1'),
    {view:'company',asset:null,new:null})
  const params=new URL('https://test'+href).searchParams
  assert.equal(params.get('date'),'2026-11-09')
  assert.equal(params.get('program'),'p1')
  assert.equal(params.get('owner'),'u1')
  assert.equal(params.get('view'),'company')
  assert.equal(params.has('asset'),false)
  assert.equal(params.has('new'),false)
})
test('milestones share supplied marketing/program dates and exclude archived programs',()=>{
  const programs=[
    {project_id:'p1',name:'Course',project_status:'active',marketing_start:'2026-11-09',program_start:'2027-01-04'},
    {project_id:'p2',name:'Old',project_status:'archived',marketing_start:'2026-11-10',program_start:'2026-12-01'},
  ]
  const events=calendar.programMilestones(programs)
  assert.equal(events.length,2)
  assert.equal(events[0].date,'2026-11-09')
  assert.equal(events[1].kind,'start')
  assert.equal(calendar.programMilestones(programs,'p2').length,0)
})
test('legacy URL redirects to Marketing view and preserves filter/deep-link parameters',async()=>{
  let destination
  const {default:redirectPage}=compile('src/app/marketing/calendar/page.tsx',()=>({redirect:url=>{destination=url}}))
  await redirectPage({searchParams:Promise.resolve({date:'2026-11-09',program:'p1',asset:'a1',view:'company',unexpected:'discard'})})
  const params=new URL('https://test'+destination).searchParams
  assert.equal(params.get('view'),'marketing')
  assert.equal(params.get('date'),'2026-11-09')
  assert.equal(params.get('asset'),'a1')
  assert.equal(params.has('unexpected'),false)
})
test('main navigation has one Calendar destination, not a second marketing calendar',()=>{
  const nav=fs.readFileSync(__dirname+'/../src/components/TopNav.tsx','utf8')
  assert.equal((nav.match(/href: '\/calendar'/g)||[]).length,1)
  assert.equal(nav.includes("href: '/marketing/calendar'"),false)
})

const rows={
  project_tasks:[
    {id:'t1',task_name:'Open',due_date:'2026-11-09',project_id:'p1',projects:{id:'p1',name:'Course',status:'active'},status:'not_started',owner_ids:['u1']},
    {id:'t2',task_name:'Other owner',due_date:'2026-11-09',project_id:'p1',projects:{id:'p1',name:'Course',status:'active'},status:'not_started',owner_ids:['u2']},
    {id:'t3',task_name:'Done',due_date:'2026-11-09',project_id:'p1',projects:{id:'p1',name:'Course',status:'active'},status:'done',owner_ids:['u1']},
    {id:'t4',task_name:'Archived',due_date:'2026-11-09',project_id:'p2',projects:{id:'p2',name:'Old',status:'archived'},status:'not_started',owner_ids:['u1']},
    {id:'t5',task_name:'Legacy role',due_date:'2026-11-09',project_id:'p1',projects:{id:'p1',name:'Course',status:'active'},status:'not_started',role_id:'r1'},
  ],
  seminars:[{id:'s1',seminar_date:'2026-11-09',title:'Seminar'}],
  marketing_content:[
    {id:'a1',title:'Same asset',scheduled_date:'2026-11-09',project_id:'p1',owner_id:'u1',channels:['Email'],status:'drafted',copy_ready:true,creative_ready:false},
    {id:'a2',title:'Undated',scheduled_date:null,project_id:'p1',channels:[],status:'idea'},
  ],
}
function api(failTable){
  const supabase={from(table){
    let data=rows[table]||[]
    const value=(row,key)=>key.split('.').reduce((v,k)=>v?.[k],row)
    const query={
      select(){return query},
      eq(key,arg){data=data.filter(r=>value(r,key)===arg);return query},
      neq(key,arg){data=data.filter(r=>value(r,key)!==arg);return query},
      gte(key,arg){data=data.filter(r=>value(r,key)!=null&&value(r,key)>=arg);return query},
      lte(key,arg){data=data.filter(r=>value(r,key)!=null&&value(r,key)<=arg);return query},
      then(resolve){return Promise.resolve({data,error:table===failTable?{message:'Failed query'}:null}).then(resolve)}
    };return query
  }}
  return compile('src/app/api/calendar/route.ts',name=>{
    if(name==='next/server')return {NextResponse:{json:(data,options)=>({data,status:options?.status||200})}}
    if(name==='@/lib/supabase')return {supabase}
    if(name==='@/lib/calendar')return calendar
    if(name==='@/lib/ownership')return ownership
    if(name==='@/lib/ownership-server')return {loadOwnership:async()=>({people:[{id:'u1',name:'One',role_id:'r1'},{id:'u2',name:'Two'}],joins:[]})}
    throw Error(name)
  }).GET
}
const request=query=>({url:'https://test/api/calendar?from=2026-11-01&to=2026-11-30'+query})
test('company feed groups open active tasks and preserves marketing IDs and readiness',async()=>{
  const {data,status}=await api()(request(''))
  assert.equal(status,200)
  assert.equal(data.events.find(e=>e.type==='project').task_count,3)
  assert.equal(data.events.filter(e=>e.type==='seminar').length,1)
  const asset=data.events.find(e=>e.type==='marketing')
  assert.equal(asset.id,'a1')
  assert.equal(marketing.readinessOf(asset),'amber')
  assert.equal(data.events.filter(e=>e.type==='marketing').length,1)
})
test('owner filter resolves legacy roles and excludes unrelated seminar events',async()=>{
  const {data}=await api()(request('&owner_id=u1'))
  assert.equal(data.events.find(e=>e.type==='project').task_count,2)
  assert.equal(data.events.filter(e=>e.type==='seminar').length,0)
  assert.equal(data.events.find(e=>e.type==='marketing').id,'a1')
})
test('program filter cannot leak another project or unlinked seminars',async()=>{
  const {data}=await api()(request('&project_id=p2'))
  assert.equal(data.events.length,0)
})
test('calendar query failure is an error, not a false empty success',async()=>{
  const result=await api('project_tasks')(request(''))
  assert.equal(result.status,500)
  assert.ok(result.data.error)
})
test('invalid calendar range is rejected before queries',async()=>{
  const result=await api()({url:'https://test/api/calendar?from=2026-02-30&to=2026-03-01'})
  assert.equal(result.status,400)
})
