// Disposable PostgreSQL-compatible database only. Never connects to Supabase.
const {PGlite}=require(process.env.PGLITE_MODULE || '@electric-sql/pglite')
const fs=require('node:fs'),assert=require('node:assert/strict')
;(async()=>{
  const db=new PGlite()
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE team_members(id uuid primary key);
    CREATE TABLE project_templates(id uuid primary key,name text);
    CREATE TABLE project_template_tasks(id uuid primary key,template_id uuid,title text,order_index integer);
    CREATE TABLE monthly_priorities(id uuid primary key,project_id uuid);
    CREATE TABLE projects(id uuid primary key default gen_random_uuid(),name text,workflow_type text,workflow_template_id uuid,
      start_date date not null,launch_date date,current_week integer,status text,priority_id uuid,revenue_goal numeric,enrollment_goal integer);
    CREATE TABLE project_tasks(id uuid primary key default gen_random_uuid(),project_id uuid references projects(id),phase text,
      phase_order integer,task_name text,task_order integer,due_date date not null,week_number integer,status text,
      owner_ids uuid[],role_id uuid not null,vendor_role_id uuid,schedule_anchor text,schedule_offset_days integer);
    CREATE TABLE activity_log(id serial primary key,project_id uuid,change_type text,description text);
    INSERT INTO team_members VALUES('00000000-0000-0000-0000-000000000001');
    INSERT INTO project_templates VALUES('00000000-0000-0000-0000-000000000002','Reviewed template');
    INSERT INTO project_template_tasks VALUES('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','A step',1);
  `)
  const migration=fs.readFileSync(__dirname+'/../supabase/migrations/20261020_foundation_creation.sql','utf8')
  await db.exec(migration);await db.exec(migration)
  const project={name:'Test project',workflow_type:'course-launch',workflow_template_id:null,start_date:'2026-12-15',launch_date:'2026-11-09'}
  const tasks=[{task_name:'A step',phase:'Launch',phase_order:1,task_order:1,week_number:0,due_date:'2026-11-09',
    owner_ids:['00000000-0000-0000-0000-000000000001'],role_id:null,vendor_role_id:null,schedule_anchor:'launch',schedule_offset_days:0,issues:[]}]
  const source={kind:'template',id:'00000000-0000-0000-0000-000000000002',steps:(await db.query('select * from project_template_tasks order by order_index,id')).rows}
  const key='00000000-0000-4000-8000-000000000001'
  const save=(t=tasks,k=key,hash='review-1',s=source)=>db.query('select create_project_from_review($1::jsonb,$2::jsonb,$3::jsonb,$4::uuid,$5) result',[JSON.stringify(project),JSON.stringify(t),JSON.stringify(s),k,hash])
  const first=(await save()).rows[0].result
  const retry=(await save()).rows[0].result
  assert.equal(first.id,retry.id)
  assert.equal((await db.query('select count(*)::int n from projects')).rows[0].n,1)
  assert.equal((await db.query('select count(*)::int n from project_tasks')).rows[0].n,1)
  assert.equal(first.launch_date,'2026-11-09')
  await assert.rejects(save(tasks,key,'different'),/different content/)
  await assert.rejects(save([{...tasks[0],owner_ids:[]}],'00000000-0000-4000-8000-000000000002'),/one reviewed owner/)
  assert.equal((await db.query('select count(*)::int n from projects')).rows[0].n,1)
  await db.exec("alter table activity_log add constraint reject_log check(change_type <> 'project_created') not valid")
  await assert.rejects(save(tasks,'00000000-0000-4000-8000-000000000003'),/reject_log/)
  assert.equal((await db.query('select count(*)::int n from project_tasks')).rows[0].n,1)
  await db.exec('alter table activity_log drop constraint reject_log')
  await db.exec("update project_template_tasks set title='Changed'")
  await assert.rejects(save(tasks,'00000000-0000-4000-8000-000000000004'),/Source changed/)
  const acl=(await db.query("select has_function_privilege('anon','create_project_from_review(jsonb,jsonb,jsonb,uuid,text)','EXECUTE') anon,has_function_privilege('authenticated','create_project_from_review(jsonb,jsonb,jsonb,uuid,text)','EXECUTE') authenticated,has_function_privilege('service_role','create_project_from_review(jsonb,jsonb,jsonb,uuid,text)','EXECUTE') service")).rows[0]
  assert.deepEqual(acl,{anon:false,authenticated:false,service:true})
  console.log('PASS: atomic creation, retries, request conflicts, missing owner rollback, log failure rollback, stale source rejection, nullable legacy role, RPC permissions.')
  await db.close()
})().catch(e=>{console.error(e);process.exitCode=1})
