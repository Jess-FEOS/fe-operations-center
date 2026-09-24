const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')

function api(path, overrides = {}) {
  const state = { status: 'active', writes: [], reads: [], filters: [], updateError: null, readError: null, ...overrides }
  const supabase = { from(table) {
    let action = 'read', row
    const finish = () => {
      if (action === 'read') {
        state.reads.push(table)
        return { data: table === 'projects' ? { id: 'project', status: state.status, priority_id: 'priority' } : [], error: state.readError }
      }
      state.writes.push({ table, action, row })
      if (action === 'update' && table === 'projects') {
        if (state.updateError) return { data: null, error: state.updateError }
        state.status = row.status
      }
      return { data: { id: 'project', status: state.status, priority_id: 'priority' }, error: null }
    }
    const chain = {
      select() { return chain },
      eq(key, value) { state.filters.push({ table, key, value }); return chain },
      update(r) { action = 'update'; row = r; return chain },
      insert(r) { action = 'insert'; row = r; return chain },
      single: async () => finish(),
      then(resolve) {
        if (action === 'read') { state.reads.push(table); return Promise.resolve({ data: [], error: null }).then(resolve) }
        return Promise.resolve(finish()).then(resolve)
      },
    }
    return chain
  } }
  const sandbox = { exports: {}, console, Date, require(name) {
    if (name === 'next/server') return { NextResponse: { json: (data, opts) => ({ status: opts?.status || 200, data }) } }
    if (name === '@/lib/supabase') return { supabase }
    if (name === '@/lib/phases') return { getSimplifiedPhase: () => 'Build' }
    throw new Error(`Unexpected module: ${name}`)
  } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(`${__dirname}/../src/app/api/projects/${path}`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, sandbox)
  return { state, ...sandbox.exports }
}
const context = { params: { id: 'project' } }
const req = body => ({ json: async () => body })

test('archive and restore update only status and log the actual prior status', async () => {
  for (const [before, after] of [['active', 'archived'], ['completed', 'archived'], ['paused', 'archived'], ['archived', 'active']]) {
    const app = api('[id]/route.ts', { status: before })
    assert.equal((await app.PATCH(req({ status: after }), context)).status, 200)
    assert.deepEqual(app.state.writes.map(w => w.table), ['projects', 'activity_log'])
    assert.equal(JSON.stringify(app.state.writes[0].row), JSON.stringify({ status: after }))
    assert.equal(app.state.writes[1].row.old_value, before)
    assert.equal(app.state.writes[1].row.new_value, after)
    assert.ok(app.state.reads.every(t => t === 'projects'))
  }
})

test('invalid and missing projects are rejected before writes', async () => {
  const app = api('[id]/route.ts')
  assert.equal((await app.PATCH(req({ status: 'deleted' }), context)).status, 400)
  assert.equal(app.state.writes.length, 0)
  const missing = api('[id]/route.ts', { readError: { code: 'PGRST116', message: 'Not found' } })
  assert.equal((await missing.PATCH(req({ status: 'archived' }), context)).status, 404)
  assert.equal(missing.state.writes.length, 0)
})

test('failed archive stays active and creates no success activity entry', async () => {
  const app = api('[id]/route.ts', { updateError: { message: 'Save failed' } })
  const result = await app.PATCH(req({ status: 'archived' }), context)
  assert.equal(result.status, 500)
  assert.equal(app.state.status, 'active')
  assert.equal(app.state.writes.length, 1)
})

test('project lists default to active and explicitly support archived, all and other statuses', async () => {
  for (const filter of ['', 'active', 'archived', 'completed', 'paused', 'all', 'invalid']) {
    const app = api('route.ts')
    const result = await app.GET({ nextUrl: new URL(`https://example.test/api/projects${filter ? `?status=${filter}` : ''}`) })
    assert.equal(result.status, filter === 'invalid' ? 400 : 200)
    const values = app.state.filters.map(f => f.value)
    assert.deepEqual(values, ['all', 'invalid'].includes(filter) ? [] : [filter || 'active'])
  }
})

test('repeating an unchanged status does not duplicate activity', async () => {
  const app = api('[id]/route.ts', { status: 'archived' })
  assert.equal((await app.PATCH(req({ status: 'archived' }), context)).status, 200)
  assert.deepEqual(app.state.writes.map(w => w.table), ['projects'])
})
