const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript')
const cache={}
function load(name){
  const file=path.resolve(__dirname,'../src/lib',name.endsWith('.ts')?name:name+'.ts')
  if(cache[file])return cache[file]
  const box={exports:{},require:p=>load(p),console,Date,Set,Map,Number,Error,URL}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,box)
  return cache[file]=box.exports
}
const own=load('ownership'),h=load('project-foundation'),access=load('access-policy')
const people=[
  {id:'a',name:'Jessica Example',role_id:'old-marketing',vendor_role_id:'marketing'},
  {id:'b',name:'Paul Example',role_id:'old-ops',vendor_role_id:'ops'},
  {id:'c',name:'Editor Example',role_id:null,vendor_role_id:'editor'},
]
const joins=people.map(p=>({team_member_id:p.id,vendor_role_id:p.vendor_role_id}))
const dates={start_date:'2026-12-15',launch_date:'2026-11-09'}
const steps=[8,6,4,3,2,1,0,-1].map((w,i)=>({id:String(i),title:`Step ${i}`,owner:'Jess',week_number:w,order_index:i,role_id:'old-marketing'}))
test('explicit person overrides a modern role; no stored ownership changes',()=>{
  const task={owner_ids:['b'],vendor_role_id:'marketing',role_id:'old-marketing'}
  assert.equal(own.resolveOwnership(task,people,joins).accountable_owner_id,'b')
  assert.deepEqual(task.owner_ids,['b'])
})
test('modern role beats legacy, even if the modern role has no holder',()=>{
  assert.equal(own.resolveOwnership({vendor_role_id:'marketing',role_id:'old-ops'},people,joins).accountable_owner_id,'a')
  assert.equal(own.resolveOwnership({vendor_role_id:'empty',role_id:'old-ops'},people,joins).accountable_owner_id,null)
})
test('legacy role resolves missing modern fields without dropping work',()=>{
  assert.equal(own.resolveOwnership({role_id:'old-ops'},people,joins).accountable_owner_id,'b')
})
test('joint, duplicate role holders, and removed explicit owners require a decision',()=>{
  assert.equal(own.resolveOwnership({owner_ids:['a','b']},people,joins).accountable_owner_id,null)
  assert.equal(own.resolveOwnership({vendor_role_id:'marketing'},people,[...joins,{team_member_id:'b',vendor_role_id:'marketing'}]).accountable_owner_id,null)
  assert.equal(own.resolveOwnership({owner_ids:['missing'],role_id:'old-ops'},people,joins).accountable_owner_id,null)
})
test('template preview produces both anchors and the approved course lead times',()=>{
  const rows=h.prepareTemplateTasks(steps,'course-launch',dates,people,joins)
  assert.equal(JSON.stringify(rows.map(t=>t.due_date)),JSON.stringify(['2026-10-05','2026-10-19','2026-11-02','2026-11-09','2026-12-01','2026-12-08','2026-12-15','2026-12-22']))
  assert.ok(rows.every(t=>t.issues.length===0 && t.owner_ids.length===1))
  assert.equal(rows[0].schedule_anchor,'launch');assert.equal(rows[4].schedule_anchor,'start')
})
test('missing launch is unresolved, not silently replaced by program start',()=>{
  const rows=h.prepareTemplateTasks(steps,'course-launch',{...dates,launch_date:null},people,joins)
  assert.equal(rows[0].due_date,null);assert.ok(rows[0].issues.length);assert.equal(rows[4].due_date,'2026-12-01')
})
test('joint and departed template names never silently choose a person',()=>{
  const rows=h.prepareTemplateTasks([{...steps[0],owner:'Jess + Paul'},{...steps[1],owner:'Former Person'}],'course-launch',dates,people,joins)
  assert.ok(rows.every(t=>!t.owner_ids.length && t.issues.length))
  const fixed=h.prepareTemplateTasks([{...steps[0],owner:'Jess + Paul'}],'course-launch',dates,people,joins,{owners:{0:'b'}})
  assert.equal(fixed[0].owner_ids[0],'b')
})
test('modern-only owner is valid without inventing a legacy role',()=>{
  const row=h.prepareTemplateTasks([{...steps[0],role_id:null,owner:'Editor'}],'podcast',dates,people,joins)[0]
  assert.equal(row.role_id,null);assert.equal(row.vendor_role_id,'editor');assert.equal(row.issues.length,0)
})
test('custom phases preserved and invalid dates rejected',()=>{
  assert.equal(h.prepareTemplateTasks([{...steps[0],phase:'Specific SOP stage',phase_order:9}],'podcast',dates,people,joins)[0].phase,'Specific SOP stage')
  assert.throws(()=>h.prepareTemplateTasks(steps,'course-launch',{...dates,start_date:'2026-02-30'},people,joins))
  assert.throws(()=>h.prepareTemplateTasks(steps,'course-launch',{...dates,launch_date:'2027-01-01'},people,joins))
})
test('copy preserves checklist, not completion or old fixed deadlines',()=>{
  const source=[{id:'1',task_name:'Finished original',phase:'Build',phase_order:1,task_order:1,week_number:4,status:'done',due_date:'2026-01-01',schedule_anchor:'launch',schedule_offset_days:-7,owner_ids:['a'],role_id:'old-marketing'},
    {id:'2',task_name:'Custom date',phase:'Custom',week_number:0,status:'done',due_date:'2026-01-02',schedule_anchor:'fixed',schedule_offset_days:null,owner_ids:['b'],role_id:'old-ops'}]
  const before=JSON.stringify(source)
  const rows=h.prepareCopyTasks(source,'course-launch',dates,people,joins)
  const scheduled=rows.find(t=>t.source_id==='1'),fixed=rows.find(t=>t.source_id==='2')
  assert.equal(scheduled.status,'not_started');assert.equal(scheduled.due_date,'2026-11-02')
  assert.equal(fixed.due_date,null);assert.ok(fixed.issues.length)
  assert.equal(JSON.stringify(source),before)
  assert.equal(h.prepareCopyTasks(source,'course-launch',dates,people,joins,{dates:{2:'2026-12-20'}}).find(t=>t.source_id==='2').due_date,'2026-12-20')
})
test('preview write flag cannot override read-only mode',()=>{
  assert.equal(access.isReadOnly({VERCEL_ENV:'preview',OPS_WRITES_ENABLED:'true'}),true)
  assert.equal(access.isReadOnly({VERCEL_ENV:'production'}),true)
  assert.equal(access.isReadOnly({VERCEL_ENV:'production',OPS_WRITES_ENABLED:'true'}),false)
  assert.equal(access.isReadRequest('POST','/api/projects/prepare'),true)
  assert.equal(access.isReadRequest('POST','/api/projects/x/schedule'),true)
  for(const method of ['PUT','DELETE','PATCH'])assert.equal(access.isReadRequest(method,'/api/projects/x/schedule'),false)
  assert.equal(access.isReadRequest('POST','/api/projects'),false)
})
test('production allowlist is exact, case-insensitive, and fail-closed',()=>{
  assert.equal(access.allowedEmail('PERSON@example.com',' person@example.com, other@example.com'),true)
  assert.equal(access.allowedEmail('attacker@example.com','person@example.com'),false)
  assert.equal(access.allowedEmail('person@example.com',undefined),false)
})
test('same-host review requests work behind a proxy; foreign and opaque origins fail',()=>{
  assert.equal(access.allowedOrigin('http://127.0.0.1:3000','127.0.0.1:3000'),true)
  assert.equal(access.allowedOrigin('https://preview.example.com','preview.example.com'),true)
  assert.equal(access.allowedOrigin('https://attacker.example','preview.example.com'),false)
  assert.equal(access.allowedOrigin('null','preview.example.com'),false)
  assert.equal(access.allowedOrigin(null,'preview.example.com'),true)
})
test('templates GET has no seeding; workflow replacement has no task deletion',()=>{
  const route=fs.readFileSync(path.resolve(__dirname,'../src/app/api/project-templates/route.ts'),'utf8')
  const get=route.split('export async function GET')[1].split('export async function POST')[0]
  assert.ok(!get.includes('.insert('));assert.ok(!get.includes('seedMissing'))
  const project=fs.readFileSync(path.resolve(__dirname,'../src/app/api/projects/[id]/route.ts'),'utf8')
  const patch=project.split('export async function PATCH')[1].split('export async function DELETE')[0]
  assert.ok(patch.includes('WORKFLOW_REPLACEMENT_BLOCKED'));assert.ok(!patch.includes('.delete()'))
})
