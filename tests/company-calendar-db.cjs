// Disposable database, never connects to production.
const {PGlite}=require(process.env.PGLITE_MODULE || '@electric-sql/pglite')
const fs=require('node:fs'),assert=require('node:assert/strict')
;(async()=>{
  const db=new PGlite()
  await db.exec(`create table team_members(id uuid primary key);
    create table projects(id uuid primary key,name text,status text,start_date date,launch_date date);
    create table project_tasks(id uuid primary key,project_id uuid,status text,due_date date);
    insert into projects values('10000000-0000-4000-8000-000000000001','Existing project','active','2026-11-16',null);
    insert into project_tasks values('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','not_started','2026-11-09');`)
  const migration=fs.readFileSync(__dirname+'/../supabase/migrations/20261022_enterprise_company_calendar.sql','utf8')
  await db.exec(migration);await db.exec(migration)
  assert.equal((await db.query('select count(*)::int n from projects')).rows[0].n,1)
  assert.equal((await db.query('select count(*)::int n from project_tasks')).rows[0].n,1)
  assert.equal((await db.query('select is_enterprise from projects')).rows[0].is_enterprise,false)
  assert.equal((await db.query('select company_calendar_kind from project_tasks')).rows[0].company_calendar_kind,null)
  await assert.rejects(db.exec("update project_tasks set company_calendar_kind='marketing'"),/check constraint/)
  await db.exec("update project_tasks set company_calendar_kind='session'")
  await assert.rejects(db.exec("update projects set enterprise_owner_id='10000000-0000-4000-8000-000000000099'"),/foreign key/)
  await db.exec("update project_tasks set company_calendar_kind=null")
  await db.close()
  console.log('PASS: migration idempotence, unchanged row counts, defaults, enum and owner FK.')
})().catch(e=>{console.error(e);process.exit(1)})
