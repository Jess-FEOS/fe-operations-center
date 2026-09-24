const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
const compile = path => ts.transpileModule(fs.readFileSync(`${__dirname}/../src/${path}`, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const helpers = { exports: {} }
vm.runInNewContext(compile('lib/marketing-requirements.ts'), helpers)

function api(overrides = {}) {
  const state = {
    task: { id: 'task', project_id: 'project', task_name: 'Write launch announcement email', phase: 'Marketing Launch', status: 'not_started', role_id: 'role' },
    current: { source_task_id: 'task', project_id: 'project' },
    insertError: null, inserted: [], updates: [], ...overrides,
  }
  const supabase = { from(table) {
    let action = 'read', row
    const chain = {
      select() { return chain }, eq() { return chain },
      insert(r) { action = 'insert'; row = r; return chain },
      update(r) { action = 'update'; row = r; return chain },
      async maybeSingle() {
        return { data: table === 'project_tasks' ? state.task : table === 'roles' ? { name: 'Marketing Director' } : state.current, error: null }
      },
      async single() {
        if (action === 'insert') { state.inserted.push(row); return { data: row, error: state.insertError } }
        state.updates.push(row); return { data: row, error: null }
      },
    }
    return chain
  } }
  const sandbox = { exports: {}, Date, require(name) {
    if (name === 'next/server') return { NextResponse: { json: (data, opts) => ({ status: opts?.status || 200, data }) } }
    if (name === '@/lib/supabase') return { supabase }
    if (name === '@/lib/marketing-requirements') return helpers.exports
    throw new Error(`Unexpected module: ${name}`)
  } }
  vm.runInNewContext(compile('app/api/marketing/route.ts'), sandbox)
  return { state, ...sandbox.exports }
}
const payload = { source_task_id: 'task', project_id: 'project', title: 'Launch email', scheduled_date: '2026-09-23', status: 'ready' }
const req = data => ({ json: async () => data })

test('conversion stores the source link without modifying project tasks', async () => {
  const app = api()
  const response = await app.POST(req(payload))
  assert.equal(response.status, 200)
  assert.equal(app.state.inserted[0].source_task_id, 'task')
  assert.equal(app.state.inserted[0].scheduled_date, payload.scheduled_date)
  assert.equal(app.state.task.status, 'not_started')
  assert.equal(app.state.updates.length, 0)
})

test('rejects stale completed, operational, deleted and wrong-project conversions', async () => {
  for (const [overrides, body, expected] of [
    [{ task: { ...api().state.task, status: 'done' } }, payload, 409],
    [{ task: { ...api().state.task, task_name: 'Create sales page' } }, payload, 409],
    [{ task: null }, payload, 404],
    [{}, { ...payload, project_id: 'other' }, 400],
    [{}, { ...payload, scheduled_date: null }, 400],
  ]) {
    const app = api(overrides)
    assert.equal((await app.POST(req(body))).status, expected)
    assert.equal(app.state.inserted.length, 0)
  }
})

test('a duplicate conversion produces a conflict instead of overwriting an asset', async () => {
  const app = api({ insertError: { code: '23505', message: 'duplicate' } })
  const response = await app.POST(req(payload))
  assert.equal(response.status, 409)
  assert.match(response.data.error, /already exists/)
})

test('asset edits cannot replace links or move linked assets across projects', async () => {
  for (const body of [
    { id: 'asset', source_task_id: 'different' },
    { id: 'asset', source_task_id: null },
    { id: 'asset', project_id: 'different' },
  ]) {
    const app = api()
    assert.equal((await app.PATCH(req(body))).status, 400)
    assert.equal(app.state.updates.length, 0)
  }
  const app = api()
  assert.equal((await app.PATCH(req({ id: 'asset', status: 'drafted' }))).status, 200)
  assert.equal(app.state.updates[0].status, 'drafted')
  assert.equal('source_task_id' in app.state.updates[0], false)
})

test('ordinary unlinked assets still save without a task or date', async () => {
  const app = api()
  assert.equal((await app.POST(req({ title: 'An idea', project_id: null }))).status, 200)
  assert.equal('source_task_id' in app.state.inserted[0], false)
})
