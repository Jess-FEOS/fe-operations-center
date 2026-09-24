const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const exportsBox = { exports: {} }
const compile = path => ts.transpileModule(fs.readFileSync(`${__dirname}/../src/${path}`, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
vm.runInNewContext(compile('lib/project-schedule.ts'), exportsBox)
const h = exportsBox.exports
const dates = { start_date: '2026-12-15', launch_date: '2026-11-09' }
const tasks = [
  ['Planning', 8], ['Setup', 6], ['Build', 4], ['Marketing Launch', 3],
  ['Pre-Launch', 2], ['Delivery Prep', 1], ['Launch', 0], ['Wrap Up', -1],
].map(([phase, week], i) => ({
  id: String(i), phase, week_number: week, task_name: phase, status: 'not_started',
  due_date: h.shiftDays('2026-10-14', -week * 7),
}))

test('course legacy phase preview uses two distinct anchors without changing records', () => {
  const before = JSON.stringify(tasks)
  const result = h.schedulePreview(tasks, dates, 'course-launch')
  assert.equal(JSON.stringify(result.map(r => r.new_date)), JSON.stringify([
    '2026-10-05','2026-10-19','2026-11-02','2026-11-09','2026-12-01','2026-12-08','2026-12-15','2026-12-22',
  ]))
  assert.equal(JSON.stringify(tasks), before)
  assert.equal(dates.start_date, '2026-12-15')
})
test('completed tasks, explicit fixed dates and legacy custom dates are preserved', () => {
  const custom = structuredClone(tasks)
  custom[0].status = 'done'
  custom[1].schedule_anchor = 'fixed'
  custom[2].due_date = '2026-09-18'
  const result = h.schedulePreview(custom, dates, 'course-launch')
  for (const i of [0,1,2]) assert.equal(result[i].new_date, custom[i].due_date)
  assert.equal(result[2].anchor, 'fixed')
})
test('saved anchors shift only their own date and are idempotent', () => {
  const saved = tasks.map((t,i) => ({ ...t, schedule_anchor: i<4?'launch':'start', schedule_offset_days: i<4?-7:7 }))
  const first = h.schedulePreview(saved, dates, 'course-launch')
  const changed = h.schedulePreview(saved, {...dates, start_date:'2027-01-15'},'course-launch')
  assert.equal(first[0].new_date, changed[0].new_date)
  assert.notEqual(first[7].new_date, changed[7].new_date)
  const rerun = h.schedulePreview(saved.map((t,i)=>({...t,due_date:first[i].new_date})),dates,'course-launch')
  assert.equal(rerun.filter(r=>r.new_date!==r.old_date).length,0)
})
test('missing launch stays visible as an unresolved date; unknown workflows stay fixed', () => {
  const preview = h.schedulePreview(tasks,{...dates,launch_date:null},'course-launch')
  assert.equal(preview[0].new_date,null)
  const unknown = h.schedulePreview(tasks,dates,'podcast')
  assert.ok(unknown.every(r=>r.anchor==='fixed' && r.new_date===r.old_date))
})
test('date validation handles leap years, invalid dates, and marketing-after-start', () => {
  assert.equal(h.validDate('2026-02-30'),false)
  assert.equal(h.validDate('2028-02-29'),true)
  assert.equal(h.shiftDays('2028-03-01',-1),'2028-02-29')
  assert.equal(h.shiftDays('2026-11-01',7),'2026-11-08')
  assert.throws(()=>h.validateDates({...dates,launch_date:'2027-01-01'}))
  assert.equal(h.validRule({anchor:'start',offset_days:0.5}),false)
})
test('preview displays phase and task order without mutating the snapshot', () => {
  const unordered = tasks.map((t,i)=>({...t,phase_order:i,task_order:1})).reverse()
  const original = JSON.stringify(unordered)
  const result = h.schedulePreview(unordered,dates,'course-launch')
  assert.equal(result[0].phase,'Planning')
  assert.equal(result[7].phase,'Wrap Up')
  assert.equal(JSON.stringify(unordered),original)
})

function api(options = {}) {
  const state = { project:{id:'p',name:'Test course',workflow_type:'course-launch',...dates},tasks:structuredClone(tasks),rpcError:null,calls:[],...options }
  const supabase = {
    from(table) {
      const chain = { select(){return chain}, eq(){return chain},
        async single(){return {data:state.project,error:null}},
        async order(){return {data:state.tasks,error:null}} }
      return chain
    },
    async rpc(name,args) {state.calls.push({name,args});return {data:{project:state.project,tasks:state.tasks,rescheduled:8},error:state.rpcError}},
  }
  const box = {exports:{},require(name) {
    if(name==='crypto')return require('node:crypto')
    if(name==='next/server')return {NextResponse:{json:(data,opts)=>({status:opts?.status||200,data})}}
    if(name==='@/lib/supabase')return {supabase}
    if(name==='@/lib/project-schedule')return h
    throw new Error(name)
  }}
  vm.runInNewContext(compile('app/api/projects/[id]/schedule/route.ts'),box)
  return {...box.exports,state}
}
const context={params:{id:'p'}}
const req=body=>({json:async()=>body})
async function reviewed(app) {
  const r=await app.POST(req({patch:dates}),context)
  assert.equal(r.status,200)
  return {patch:dates,revision:r.data.revision,rules:r.data.rows.map(({id,anchor,offset_days})=>({id,anchor,offset_days}))}
}
test('preview never writes; applying passes one complete atomic snapshot', async()=>{
  const app=api()
  const body=await reviewed(app)
  assert.equal(app.state.calls.length,0)
  assert.equal((await app.PUT(req(body),context)).status,200)
  assert.equal(app.state.calls.length,1)
  assert.equal(app.state.calls[0].name,'save_project_schedule')
  assert.equal(app.state.calls[0].args.p_changes.length,8)
})
test('stale previews, forged task IDs and incomplete rules cannot save',async()=>{
  const app=api()
  const body=await reviewed(app)
  app.state.tasks[0].status='done'
  assert.equal((await app.PUT(req(body),context)).status,409)
  const fresh=await reviewed(app)
  assert.equal((await app.PUT(req({...fresh,rules:[]}),context)).status,400)
  fresh.rules[0].id='other-project-task'
  assert.equal((await app.PUT(req(fresh),context)).status,400)
  assert.equal(app.state.calls.length,0)
})
test('missing migration or atomic write failure reports failure, never success',async()=>{
  const app=api({rpcError:{message:'function missing'}})
  assert.equal((await app.PUT(req(await reviewed(app)),context)).status,503)
  const conflict=api({rpcError:{message:'SCHEDULE_CONFLICT'}})
  assert.equal((await conflict.PUT(req(await reviewed(conflict)),context)).status,409)
})
test('individual manual date changes become fixed, unchanged dates keep their anchor',async()=>{
  const writes=[]
  const supabase={from(){let update;const chain={
    select(){return chain},eq(){return chain},update(data){update=data;return chain},
    async single(){if(update)writes.push(update);return {data:{id:'task',due_date:'2026-10-05',...update},error:null}}
  };return chain}}
  const box={exports:{},require(name){
    if(name==='next/server')return {NextResponse:{json:(data,opts)=>({status:opts?.status||200,data})}}
    if(name==='@/lib/supabase')return {supabase}
    throw new Error(name)
  }}
  vm.runInNewContext(compile('app/api/projects/[id]/tasks/[taskId]/route.ts'),box)
  const ctx={params:{id:'p',taskId:'task'}}
  assert.equal((await box.exports.PATCH(req({due_date:'2026-10-05'}),ctx)).status,200)
  assert.equal(writes[0].schedule_anchor,undefined)
  assert.equal((await box.exports.PATCH(req({due_date:'2026-10-06'}),ctx)).status,200)
  assert.equal(writes[1].schedule_anchor,'fixed')
  assert.equal(writes[1].schedule_offset_days,null)
})
