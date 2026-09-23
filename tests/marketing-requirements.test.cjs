const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
const code = ts.transpileModule(fs.readFileSync(`${__dirname}/../src/lib/marketing-requirements.ts`, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const sandbox = { exports: {} }
vm.runInNewContext(code, sandbox)
const { isMarketingRequirement, requirementCounts } = sandbox.exports

test('flags marketing roles in any phase and all roles in market phases', () => {
  for (const phase of ['Marketing Launch', 'Pre-Launch', 'Market', ' marketing ']) {
    assert.equal(isMarketingRequirement({ phase, role_name: 'Creative Director' }), true)
  }
  assert.equal(isMarketingRequirement({ phase: 'Build', role_name: 'Marketing Director' }), true)
  assert.equal(isMarketingRequirement({ phase: 'Wrap Up', role_name: 'Marketing Director' }), true)
  assert.equal(isMarketingRequirement({ phase: 'Planning', role_name: null }), false)
  assert.equal(isMarketingRequirement({ phase: 'Build', role_name: 'Operations Director' }), false)
})

test('flags overdue and blocked tasks without confusing completed tasks with assets', () => {
  const tasks = [
    { status: 'done', due_date: '2026-09-01' },
    { status: 'not_started', due_date: '2026-09-22' },
    { status: 'blocked', due_date: '2026-09-23' },
    { status: 'in_progress', due_date: null },
  ]
  assert.equal(JSON.stringify(requirementCounts(tasks, '2026-09-23')), JSON.stringify({ open: 3, done: 1, overdue: 1, blocked: 1 }))
  assert.equal(requirementCounts([], '2026-09-23').open, 0)
})
