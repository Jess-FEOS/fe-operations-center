const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')

const code = ts.transpileModule(fs.readFileSync(`${__dirname}/../src/lib/marketing.ts`, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const sandbox = { exports: {}, Date, fetch: async () => ({ ok: false, json: async () => ({ error: 'QA failure' }) }) }
vm.runInNewContext(code, sandbox)
const { readinessOf, emptyItem, windowFit, marketingWeeks, parseDate, toISO, startOfWeek, marketingRequest } = sandbox.exports

test('readiness covers every status and checklist combination', () => {
  for (const status of ['ready', 'idea', 'drafted', 'scheduled', 'posted']) {
    for (const copy_ready of [false, true]) for (const creative_ready of [false, true]) {
      const expected = ['scheduled', 'posted'].includes(status) ? 'green'
        : status === 'drafted' || copy_ready || creative_ready ? 'amber' : 'red'
      assert.equal(readinessOf({ status, copy_ready, creative_ready }), expected)
    }
  }
})

test('dates remain local and Monday anchored', () => {
  for (const date of ['2026-09-23', '2026-03-08', '2026-11-01', '2027-01-01']) {
    assert.equal(toISO(parseDate(date)), date)
  }
  assert.equal(toISO(startOfWeek(parseDate('2026-09-27'))), '2026-09-21')
})

test('window bounds are inclusive and missing dates are unknown', () => {
  const p = { marketing_start: '2026-09-23', program_start: '2026-10-14' }
  for (const [date, expected] of [[null, 'unknown'], ['2026-09-22', 'before'], ['2026-09-23', 'inside'], ['2026-10-14', 'inside'], ['2026-10-15', 'after']]) {
    assert.equal(windowFit(date, p), expected)
  }
})

test('weekly chart excludes assets outside partial edge weeks', () => {
  const p = { marketing_start: '2026-09-23', program_start: '2026-10-14' }
  const items = ['2026-09-22', '2026-09-23', '2026-10-14', '2026-10-15'].map(scheduled_date => ({ ...emptyItem(), scheduled_date }))
  const weeks = marketingWeeks(p, items)
  assert.equal(weeks.length, 4)
  assert.equal(weeks[0].start, p.marketing_start)
  assert.equal(weeks[3].end, p.program_start)
  assert.equal(weeks.reduce((n, week) => n + week.items.length, 0), 2)
  assert.equal(marketingWeeks({ ...p, marketing_start: '2027-01-01' }, items).length, 0)
  assert.equal(marketingWeeks({ marketing_start: '2025-01-01', program_start: '2026-10-14' }, []).length > 52, true)
})

test('API failures reject instead of becoming a false success', async () => {
  await assert.rejects(marketingRequest('/api/marketing'), /QA failure/)
})
