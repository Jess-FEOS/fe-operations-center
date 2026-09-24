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
const { isMarketingRequirement, requirementCounts, assetDefaultsFromRequirement } = sandbox.exports
const base = { id: 'task-1', project_id: 'project-1', phase: 'Marketing Launch', role_name: 'Marketing Director', task_name: 'Write launch announcement email', status: 'not_started', due_date: '2026-09-23', owner_ids: [] }

test('requires open content work, not just marketing ownership or phase', () => {
  for (const phase of ['Marketing Launch', 'Pre-Launch', 'Market', ' marketing ']) {
    assert.equal(isMarketingRequirement({ ...base, phase, role_name: 'Creative Director' }), true)
  }
  for (const title of ['Build sales page with copy, pricing, and enrollment CTA', 'Create sales page', 'Set up Zapier automation - enrollment to Kit to welcome email', 'Set up YouTube channel for video episodes', 'Test full enrollment flow end to end', 'Monitor enrollment numbers daily', 'Collect testimonials for marketing', 'Write welcome email sequence in Kit', 'Create enrollment form in Formsite', 'Create podcast page on website']) {
    assert.equal(isMarketingRequirement({ ...base, task_name: title }), false, title)
  }
  for (const task_name of ['Create promotional graphics and video', 'Write social posts for X, LinkedIn, YouTube', 'Schedule email campaign in Kit', 'Send mid-campaign email', 'Send final urgency email - last 48 hours', 'Write show notes for first 3 episodes']) {
    assert.equal(isMarketingRequirement({ ...base, task_name }), true, task_name)
    assert.equal(isMarketingRequirement({ ...base, task_name, status: 'done' }), false)
  }
  assert.equal(isMarketingRequirement({ ...base, phase: 'Build', role_name: 'Operations Director' }), false)
})

test('only unconverted open content tasks are flagged', () => {
  const tasks = [
    { ...base, id: 'done', status: 'done', due_date: '2026-09-01' },
    { ...base, id: 'open', status: 'not_started', due_date: '2026-09-22' },
    { ...base, id: 'blocked', status: 'blocked', due_date: '2026-09-23' },
    { ...base, id: 'linked', status: 'in_progress', due_date: '2026-09-01' },
    { ...base, id: 'ops', task_name: 'Create sales page', due_date: '2026-09-01' },
  ]
  assert.equal(JSON.stringify(requirementCounts(tasks, '2026-09-23', new Set(['linked']))), JSON.stringify({ open: 2, overdue: 1, blocked: 1 }))
  assert.equal(requirementCounts([], '2026-09-23').open, 0)
})

test('asset conversion prefills source, project, deadline and explicit platforms only', () => {
  const defaults = assetDefaultsFromRequirement({ ...base, owner_ids: ['owner-1'] })
  assert.equal(defaults.source_task_id, base.id)
  assert.equal(defaults.project_id, base.project_id)
  assert.equal(defaults.scheduled_date, base.due_date)
  assert.equal(defaults.status, 'ready')
  assert.equal(defaults.owner_id, 'owner-1')
  assert.equal(JSON.stringify(defaults.channels), '["Email"]')
  const multi = assetDefaultsFromRequirement({ ...base, task_name: 'Write social posts for X, LinkedIn, YouTube', owner_ids: ['a', 'b'], due_date: null })
  assert.equal(multi.owner_id, null)
  assert.equal(multi.scheduled_date, null)
  assert.equal(JSON.stringify(multi.channels), '["YouTube","LinkedIn","X"]')
})
