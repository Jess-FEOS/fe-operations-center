// Run separately: PGLITE_MODULE=/path/to/@electric-sql/pglite node tests/project-schedule-db.cjs
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite')
const fs = require('node:fs')
const assert = require('node:assert/strict')

;(async () => {
  const db = new PGlite()
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE projects(id uuid PRIMARY KEY,name text,start_date date,launch_date date,workflow_type text,revenue_goal numeric,enrollment_goal integer,status text);
    CREATE TABLE project_tasks(id uuid PRIMARY KEY,project_id uuid REFERENCES projects(id),task_name text,status text,due_date date,phase_order integer,task_order integer);
    CREATE TABLE activity_log(id serial PRIMARY KEY,project_id uuid,project_name text,change_type text,description text,old_value text,new_value text);
    INSERT INTO projects VALUES ('00000000-0000-0000-0000-000000000001','QA project','2026-10-14',NULL,'course-launch',NULL,NULL,'active');
    INSERT INTO project_tasks VALUES
      ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001','Launch email','not_started','2026-09-23',1,1),
      ('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000001','Done work','done','2026-08-01',1,2);
  `)
  const before = await db.query('SELECT * FROM project_tasks ORDER BY id')
  await db.exec(fs.readFileSync(`${__dirname}/../supabase/migrations/20260924_project_date_anchors.sql`,'utf8'))
  assert.equal((await db.query('SELECT due_date::text FROM project_tasks ORDER BY id')).rows[0].due_date,'2026-09-23')
  const p='00000000-0000-0000-0000-000000000001'
  const snapshot=async()=>({
    project:(await db.query('SELECT to_jsonb(p) AS row FROM projects p')).rows[0].row,
    tasks:(await db.query('SELECT jsonb_agg(to_jsonb(t) ORDER BY id) AS rows FROM project_tasks t')).rows[0].rows,
  })
  const patch={start_date:'2026-12-15',launch_date:'2026-11-09'}
  const changes=[{id:'00000000-0000-0000-0000-000000000011',due_date:'2026-11-09',schedule_anchor:'launch',schedule_offset_days:0}]
  const save=async(s,c=changes)=>db.query('SELECT save_project_schedule($1,$2::jsonb,$3::jsonb,$4::jsonb,$5::jsonb) AS result',
    [p,JSON.stringify(s.project),JSON.stringify(s.tasks),JSON.stringify(patch),JSON.stringify(c)])
  let snap=await snapshot()
  const result=(await save(snap)).rows[0].result
  assert.equal(result.rescheduled,1)
  assert.equal(result.project.start_date,'2026-12-15')
  assert.equal(result.tasks[1].due_date,'2026-08-01')
  assert.equal((await db.query('SELECT count(*)::int AS n FROM activity_log')).rows[0].n,1)
  await assert.rejects(save(snap),/SCHEDULE_CONFLICT/)
  // Changed task after preview conflicts even if project dates did not change.
  snap=await snapshot()
  await db.exec("UPDATE project_tasks SET status='in_progress' WHERE task_name='Launch email'")
  await assert.rejects(save(snap),/SCHEDULE_CONFLICT/)
  // Log failure must roll back task AND project updates in the same transaction.
  snap=await snapshot()
  await db.exec("ALTER TABLE activity_log ADD CONSTRAINT reject_log CHECK (change_type <> 'schedule_changed') NOT VALID")
  const old=JSON.stringify(snap)
  await assert.rejects(save(snap,[{...changes[0],due_date:'2026-11-08',schedule_offset_days:-1}]),/reject_log/)
  assert.equal(JSON.stringify(await snapshot()),old)
  await db.exec('ALTER TABLE activity_log DROP CONSTRAINT reject_log')
  await assert.rejects(save(await snapshot(),[{...changes[0],due_date:'2026-11-09',schedule_anchor:'fixed',schedule_offset_days:1}]),/Fixed/)
  await assert.rejects(db.exec("UPDATE project_tasks SET schedule_anchor=NULL,schedule_offset_days=2"),/schedule_rule_check/)
  const acl=(await db.query("SELECT has_function_privilege('anon','save_project_schedule(uuid,jsonb,jsonb,jsonb,jsonb)','EXECUTE') AS anon,has_function_privilege('authenticated','save_project_schedule(uuid,jsonb,jsonb,jsonb,jsonb)','EXECUTE') AS authenticated,has_function_privilege('service_role','save_project_schedule(uuid,jsonb,jsonb,jsonb,jsonb)','EXECUTE') AS service")).rows[0]
  assert.deepEqual(acl,{anon:false,authenticated:false,service:true})
  assert.equal(before.rows.length,2)
  console.log('PASS: migration preserves data; atomic save, completed work, stale conflicts, rollback, fixed-date checks, constraints, and RPC permissions.')
  await db.close()
})().catch(err=>{console.error(err);process.exitCode=1})
