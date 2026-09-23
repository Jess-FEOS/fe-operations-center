'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import Avatar from '@/components/Avatar'
import AssetModal from '@/components/marketing/AssetModal'
import {
  ASSET_TYPE_LABEL, ContentItem, Program, READINESS, Readiness, STATUS_LABEL,
  addDays, daysBetween, fmtLong, fmtShort, parseDate, readinessOf, startOfWeek, toISO, windowFit, marketingRequest, marketingWeeks,
} from '@/lib/marketing'

// ------------------------------------------------------------------
// Marketing Strategy — grouped by program.
// Each program has a marketing window (marketing launches → program
// starts). Assets listed under a program land on the Marketing Calendar
// on their post date, color-coded by readiness. The weekly volume strip
// shows where to push harder or ease off inside the window.
// ------------------------------------------------------------------

interface TeamMember { id: string; name: string; initials: string; color: string }

export default function MarketingStrategyPage() {
  const [items, setItems] = useState<ContentItem[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [modal, setModal] = useState<{ item: ContentItem | null; defaults?: any } | null>(null)

  const load = useCallback(() => {
    return Promise.all([
      marketingRequest<ContentItem[]>('/api/marketing'),
      marketingRequest<Program[]>('/api/marketing/programs'),
      marketingRequest<TeamMember[]>('/api/team'),
    ]).then(([it, pr, tm]) => {
      setItems(Array.isArray(it) ? it : [])
      setPrograms(Array.isArray(pr) ? pr : [])
      setTeam(Array.isArray(tm) ? tm.map((m: any) => ({ id: m.id, name: m.name, initials: m.initials, color: m.color })) : [])
      setError(null)
    }).catch((err) => setError(err.message || 'Could not load marketing data.'))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const visiblePrograms = useMemo(
    () => programs.filter((p) => showAll || p.project_status === 'active' || items.some((i) => i.project_id === p.project_id)),
    [programs, items, showAll]
  )
  const unassigned = items.filter((i) => !i.project_id || !programs.some((p) => p.project_id === i.project_id))

  const saveProgram = async (project_id: string, patch: Partial<Program>) => {
    setSaving(true)
    try {
      await marketingRequest('/api/marketing/programs', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id, ...patch }),
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save program.')
    } finally { setSaving(false) }
  }

  const patchItem = async (it: ContentItem, patch: Partial<ContentItem>) => {
    setSaving(true)
    try {
      await marketingRequest('/api/marketing', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: it.id, ...patch }),
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save asset.')
    } finally { setSaving(false) }
  }

  return (
    <div className="font-fira">
      <PageHeader
        eyebrow="Marketing"
        title="Marketing Strategy"
        subtitle="Plan assets by program — everything here feeds the Marketing Calendar"
        actions={
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-fe-blue-gray cursor-pointer">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="accent-[#1B365D]" />
              Show inactive programs
            </label>
            <button onClick={() => setModal({ item: null })} className="px-4 py-1.5 bg-fe-blue text-white text-sm font-bold hover:opacity-90" data-testid="button-new-asset">
              + New asset
            </button>
          </div>
        }
      />

      {error && <div role="alert" className="mb-4 border border-fe-red p-3 text-sm text-fe-red">{error} <button onClick={load} className="underline">Retry</button></div>}
      {saving && <p role="status" className="mb-2 text-xs text-fe-blue-gray">Saving changes…</p>}
      <fieldset disabled={saving} className="min-w-0">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-fe-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <Legend />
          <Timeline programs={visiblePrograms} items={items} />

          <div className="space-y-6 mt-8">
            {visiblePrograms.map((p) => (
              <ProgramCard
                key={p.project_id}
                program={p}
                items={items.filter((i) => i.project_id === p.project_id)}
                onSaveProgram={(patch) => saveProgram(p.project_id, patch)}
                onOpen={(it) => setModal({ item: it })}
                onAdd={() => setModal({ item: null, defaults: { project_id: p.project_id } })}
                onPatch={patchItem}
              />
            ))}
            {unassigned.length > 0 && (
              <section className="bg-white border border-fe-line">
                <div className="px-5 py-3.5 border-b border-fe-line">
                  <h2 className="font-barlow font-bold text-lg text-fe-navy">Not tied to a program</h2>
                  <p className="text-xs text-fe-blue-gray">Assign these to a program so they count toward its plan.</p>
                </div>
                <AssetTable items={unassigned} program={undefined} onOpen={(it) => setModal({ item: it })} onPatch={patchItem} />
              </section>
            )}
          </div>

          <p className="mt-4 text-xs text-fe-blue-gray">
            See these on the <Link href="/marketing/calendar" className="text-fe-blue hover:underline">Marketing Calendar</Link>, or work through copy in the{' '}
            <Link href="/marketing" className="text-fe-blue hover:underline">Content Pipeline</Link>.
          </p>
        </>
      )}

      </fieldset>
      {modal && (
        <AssetModal
          item={modal.item}
          defaults={modal.defaults}
          programs={programs}
          team={team}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}

// ── Legend ────────────────────────────────────────────────────────────
function Legend() {
  return (
    <div className="flex items-center gap-4 mb-3 text-xs text-fe-blue-gray flex-wrap">
      {(Object.keys(READINESS) as Readiness[]).map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: READINESS[k].color }} />
          {READINESS[k].label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="w-5 h-2.5 bg-fe-navy/15 border border-fe-navy/30" /> Marketing window
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-0.5 h-3 bg-fe-gold" /> Program starts
      </span>
    </div>
  )
}

// ── Timeline across all programs ───────────────────────────────────────
function Timeline({ programs, items }: { programs: Program[]; items: ContentItem[] }) {
  const today = toISO(new Date())
  const dates: string[] = [today]
  for (const p of programs) {
    if (p.marketing_start) dates.push(p.marketing_start)
    if (p.program_start) dates.push(p.program_start)
  }
  for (const i of items) if (i.scheduled_date && programs.some((p) => p.project_id === i.project_id)) dates.push(i.scheduled_date)
  dates.sort()
  const start = toISO(addDays(startOfWeek(parseDate(dates[0])), -7))
  const end = toISO(addDays(parseDate(dates[dates.length - 1]), 21))
  const span = Math.max(daysBetween(start, end), 1)
  const pct = (d: string) => `${(daysBetween(start, d) / span) * 100}%`

  // Month tick marks
  const months: { label: string; at: string }[] = []
  const m = parseDate(start)
  m.setDate(1)
  while (toISO(m) <= end) {
    if (toISO(m) >= start) months.push({ label: m.toLocaleDateString('en-US', { month: 'short' }) + (m.getMonth() === 0 || !months.length ? ` ’${String(m.getFullYear()).slice(2)}` : ''), at: toISO(m) })
    m.setMonth(m.getMonth() + 1)
  }

  if (programs.length === 0) return null

  return (
    <section className="bg-white border border-fe-line p-5 overflow-x-auto" data-testid="timeline">
      <h2 className="font-barlow font-bold text-base text-fe-navy mb-3">Program timeline</h2>
      <div className="min-w-[640px]">
      <div className="flex">
        <div className="w-44 shrink-0" />
        <div className="relative flex-1 h-5 border-b border-fe-line">
          {months.map((mo) => (
            <span key={mo.at} className="absolute text-[10px] uppercase tracking-wider text-fe-blue-gray -translate-x-1/2" style={{ left: pct(mo.at) }}>
              {mo.label}
            </span>
          ))}
        </div>
      </div>
      <div className="relative">
        {programs.map((p) => {
          const pItems = items.filter((i) => i.project_id === p.project_id && i.scheduled_date)
          return (
            <div key={p.project_id} className="flex items-center h-10 border-b border-fe-line/70 last:border-b-0">
              <div className="w-44 shrink-0 pr-3 truncate text-sm text-fe-navy font-medium" title={p.name}>{p.name}</div>
              <div className="relative flex-1 h-full">
                {months.map((mo) => (
                  <span key={mo.at} className="absolute top-0 bottom-0 w-px bg-fe-line/60" style={{ left: pct(mo.at) }} />
                ))}
                {p.marketing_start && p.program_start && p.marketing_start <= p.program_start && (
                  <div
                    className="absolute top-2.5 bottom-2.5 bg-fe-navy/10 border border-fe-navy/25"
                    style={{ left: pct(p.marketing_start), width: `calc(${pct(p.program_start)} - ${pct(p.marketing_start)})` }}
                    title={`Marketing window: ${fmtLong(p.marketing_start)} – ${fmtLong(p.program_start)}`}
                  />
                )}
                {p.program_start && (
                  <div className="absolute top-1 bottom-1 w-0.5 bg-fe-gold" style={{ left: pct(p.program_start) }} title={`Program starts ${fmtLong(p.program_start)}`} />
                )}
                {pItems.map((i) => {
                  const r = readinessOf(i)
                  return (
                    <span
                      key={i.id}
                      className="absolute top-1/2 w-2.5 h-2.5 rounded-full -translate-x-1/2 -translate-y-1/2 ring-2 ring-white"
                      style={{ left: pct(i.scheduled_date!), backgroundColor: READINESS[r].color }}
                      title={`${i.title} · ${fmtShort(i.scheduled_date)} · ${READINESS[r].label}`}
                    />
                  )
                })}
                {!p.marketing_start && (
                  <span className="absolute top-1/2 -translate-y-1/2 text-[11px] text-fe-blue-gray/80 italic" style={{ left: 8 }}>
                    Set a marketing launch date below
                  </span>
                )}
              </div>
            </div>
          )
        })}
        {/* Today line */}
        <div className="absolute top-0 bottom-0 pointer-events-none flex" style={{ left: 0, right: 0 }}>
          <div className="w-44 shrink-0" />
          <div className="relative flex-1">
            <div className="absolute top-0 bottom-0 w-px bg-fe-red/70" style={{ left: pct(today) }}>
              <span className="absolute -top-4 -translate-x-1/2 text-[9px] font-bold text-fe-red uppercase">Today</span>
            </div>
          </div>
        </div>
      </div>
      </div>
    </section>
  )
}

// ── One program ────────────────────────────────────────────────────────
function ProgramCard({
  program: p, items, onSaveProgram, onOpen, onAdd, onPatch,
}: {
  program: Program
  items: ContentItem[]
  onSaveProgram: (patch: Partial<Program>) => void
  onOpen: (it: ContentItem) => void
  onAdd: () => void
  onPatch: (it: ContentItem, patch: Partial<ContentItem>) => void
}) {
  const [audience, setAudience] = useState(p.target_audience || '')
  const [goal, setGoal] = useState(p.goal || '')
  useEffect(() => { setAudience(p.target_audience || ''); setGoal(p.goal || '') }, [p.target_audience, p.goal])

  const today = toISO(new Date())
  const counts = { red: 0, amber: 0, green: 0 } as Record<Readiness, number>
  for (const i of items) counts[readinessOf(i)]++
  const outside = items.filter((i) => ['before', 'after'].includes(windowFit(i.scheduled_date, p))).length
  const undated = items.filter((i) => !i.scheduled_date).length
  const daysToStart = p.program_start ? daysBetween(today, p.program_start) : null

  const sorted = [...items].sort((a, b) => (a.scheduled_date || '9999').localeCompare(b.scheduled_date || '9999'))

  return (
    <section className="bg-white border border-fe-line" data-testid={`program-${p.project_id}`}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-fe-line">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-barlow font-extrabold text-xl text-fe-navy">{p.name}</h2>
              {p.project_status !== 'active' && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-fe-offwhite border border-fe-line text-fe-blue-gray">{p.project_status}</span>}
            </div>
            <p className="text-xs text-fe-blue-gray mt-0.5">
              {daysToStart === null ? 'No program start date' :
                daysToStart > 0 ? `Program starts in ${daysToStart} days` :
                daysToStart === 0 ? 'Program starts today' : `Program started ${-daysToStart} days ago`}
              {' · '}{items.length} asset{items.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(Object.keys(counts) as Readiness[]).map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-bold" style={{ backgroundColor: READINESS[k].bg, color: READINESS[k].color }} title={READINESS[k].label}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: READINESS[k].color }} />{counts[k]}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
          <MiniField label="Marketing launches">
            <input type="date" className="fe-input py-1.5" value={p.marketing_start || ''} onChange={(e) => onSaveProgram({ marketing_start: e.target.value || null })} data-testid="input-marketing-start" />
          </MiniField>
          <MiniField label="Program starts">
            <input type="date" className="fe-input py-1.5" value={p.program_start || ''} onChange={(e) => onSaveProgram({ program_start: e.target.value || null })} data-testid="input-program-start" />
          </MiniField>
          <MiniField label="Target audience">
            <input className="fe-input py-1.5" value={audience} onChange={(e) => setAudience(e.target.value)} onBlur={() => audience !== (p.target_audience || '') && onSaveProgram({ target_audience: audience || null })} placeholder="Who is this program for?" />
          </MiniField>
          <MiniField label="Goal">
            <input className="fe-input py-1.5" value={goal} onChange={(e) => setGoal(e.target.value)} onBlur={() => goal !== (p.goal || '') && onSaveProgram({ goal: goal || null })} placeholder="e.g. 40 enrollments" />
          </MiniField>
        </div>
      </div>

      {/* Weekly volume */}
      <WeeklyVolume program={p} items={items} />

      {(outside > 0 || undated > 0) && (
        <div className="px-5 py-2 bg-fe-red/5 border-b border-fe-line text-xs text-fe-red">
          {outside > 0 && <span>{outside} asset{outside === 1 ? ' is' : 's are'} outside the marketing window. </span>}
          {undated > 0 && <span>{undated} asset{undated === 1 ? ' has' : 's have'} no post date yet.</span>}
        </div>
      )}

      <AssetTable items={sorted} program={p} onOpen={onOpen} onPatch={onPatch} />
      <div className="px-5 py-3 border-t border-fe-line">
        <button onClick={onAdd} className="text-sm text-fe-blue font-bold hover:underline" data-testid={`add-asset-${p.project_id}`}>+ Add asset to {p.name}</button>
      </div>
    </section>
  )
}

// ── Weekly volume inside the window ────────────────────────────────────
function WeeklyVolume({ program: p, items }: { program: Program; items: ContentItem[] }) {
  if (!p.marketing_start || !p.program_start || p.marketing_start > p.program_start) {
    return (
      <div className="px-5 py-3 border-b border-fe-line text-xs text-fe-blue-gray">
        Set <b>Marketing launches</b> and <b>Program starts</b> to see weekly volume across the window.
      </div>
    )
  }
  const today = toISO(new Date())
  const weeks = marketingWeeks(p, items)
  const max = Math.max(1, ...weeks.map((x) => x.items.length))
  const gaps = weeks.filter((x) => x.items.length === 0 && x.end >= today).length

  return (
    <div className="px-5 py-4 border-b border-fe-line">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-fe-blue-gray uppercase tracking-wider">Assets per week</span>
        {gaps > 0 && <span className="text-xs text-fe-red">{gaps} upcoming week{gaps === 1 ? '' : 's'} with nothing planned</span>}
      </div>
      <div className="flex items-end gap-1 h-24 overflow-x-auto">
        {weeks.map((wk) => {
          const n = wk.items.length
          const reds = wk.items.filter((i) => readinessOf(i) === 'red').length
          const ambers = wk.items.filter((i) => readinessOf(i) === 'amber').length
          const greens = n - reds - ambers
          const isNow = today >= wk.start && today <= wk.end
          const past = wk.end < today
          return (
            <div key={wk.start} className="flex-1 min-w-[14px] flex flex-col items-center justify-end h-full group relative" title={`Week of ${fmtShort(wk.start)}: ${n} asset${n === 1 ? '' : 's'}`}>
              {n > 0 && <span className="text-[10px] text-fe-blue-gray mb-0.5">{n}</span>}
              <div className={`w-full flex flex-col-reverse ${past ? 'opacity-50' : ''}`} style={{ height: `${(n / max) * 60}px` }}>
                {greens > 0 && <div style={{ flex: greens, backgroundColor: READINESS.green.color }} />}
                {ambers > 0 && <div style={{ flex: ambers, backgroundColor: READINESS.amber.color }} />}
                {reds > 0 && <div style={{ flex: reds, backgroundColor: READINESS.red.color }} />}
              </div>
              {n === 0 && <div className={`w-full h-1 ${past ? 'bg-fe-line' : 'bg-fe-red/30'}`} />}
              {isNow && <div className="absolute -bottom-1 w-full h-0.5 bg-fe-navy" />}
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-1.5 text-[10px] text-fe-blue-gray">
        <span>{fmtShort(p.marketing_start)} · marketing launches</span>
        <span>program starts · {fmtShort(p.program_start)}</span>
      </div>
    </div>
  )
}

// ── Asset table ────────────────────────────────────────────────────────
function AssetTable({
  items, program, onOpen, onPatch,
}: {
  items: ContentItem[]
  program: Program | undefined
  onOpen: (it: ContentItem) => void
  onPatch: (it: ContentItem, patch: Partial<ContentItem>) => void
}) {
  if (items.length === 0) {
    return <p className="px-5 py-6 text-sm text-fe-blue-gray text-center">No assets planned yet.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-fe-line bg-fe-offwhite text-left text-xs">
            <th className="pl-5 pr-2 py-2 w-6" />
            <th className="px-3 py-2 font-barlow font-bold text-fe-navy">Asset</th>
            <th className="px-3 py-2 font-barlow font-bold text-fe-navy">Type</th>
            <th className="px-3 py-2 font-barlow font-bold text-fe-navy">Platforms</th>
            <th className="px-3 py-2 font-barlow font-bold text-fe-navy">Audience</th>
            <th className="px-3 py-2 font-barlow font-bold text-fe-navy">Post date</th>
            <th className="px-3 py-2 font-barlow font-bold text-fe-navy">Owner</th>
            <th className="px-3 py-2 font-barlow font-bold text-fe-navy text-center">Copy</th>
            <th className="px-3 py-2 font-barlow font-bold text-fe-navy text-center">Creative</th>
            <th className="px-3 py-2 pr-5 font-barlow font-bold text-fe-navy">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const r = readinessOf(it)
            const fit = windowFit(it.scheduled_date, program)
            const audience = it.target_audience || program?.target_audience
            return (
              <tr key={it.id} className="border-b border-fe-line last:border-b-0 hover:bg-fe-offwhite cursor-pointer" onClick={() => onOpen(it)} data-testid={`asset-row-${it.id}`}>
                <td className="pl-5 pr-2 py-2.5">
                  <span className="block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: READINESS[r].color }} title={READINESS[r].label} />
                </td>
                <td className="px-3 py-2.5 text-fe-anthracite font-medium">{it.title}</td>
                <td className="px-3 py-2.5 text-fe-blue-gray whitespace-nowrap">{it.asset_type ? ASSET_TYPE_LABEL[it.asset_type] || it.asset_type : '—'}</td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {it.channels.length ? it.channels.map((ch) => (
                      <span key={ch} className="text-[10px] px-1.5 py-0.5 bg-fe-offwhite border border-fe-line text-fe-blue-gray uppercase">{ch}</span>
                    )) : <span className="text-fe-blue-gray/60">—</span>}
                  </div>
                </td>
                <td className={`px-3 py-2.5 max-w-[200px] truncate ${it.target_audience ? 'text-fe-anthracite' : 'text-fe-blue-gray/70 italic'}`} title={audience || ''}>{audience || '—'}</td>
                <td className={`px-3 py-2.5 whitespace-nowrap ${fit === 'before' || fit === 'after' ? 'text-fe-red font-bold' : 'text-fe-blue-gray'}`} title={fit === 'before' ? 'Before marketing launches' : fit === 'after' ? 'After the program starts' : ''}>
                  {fmtShort(it.scheduled_date)}{fit === 'before' || fit === 'after' ? ' ⚠' : ''}
                </td>
                <td className="px-3 py-2.5">
                  {it.owner ? <Avatar initials={it.owner.initials} color={it.owner.color} size="sm" title={it.owner.name} /> : <span className="text-fe-blue-gray/60">—</span>}
                </td>
                <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" className="w-4 h-4 accent-[#046A38] cursor-pointer" checked={it.copy_ready} onChange={(e) => onPatch(it, { copy_ready: e.target.checked })} aria-label="Copy written" />
                </td>
                <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" className="w-4 h-4 accent-[#046A38] cursor-pointer" checked={it.creative_ready} onChange={(e) => onPatch(it, { creative_ready: e.target.checked })} aria-label="Creative done" />
                </td>
                <td className="px-3 py-2.5 pr-5 text-xs text-fe-blue-gray whitespace-nowrap">{STATUS_LABEL[it.status] || it.status}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function MiniField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] text-fe-blue-gray uppercase tracking-wider mb-1">{label}</span>
      {children}
    </label>
  )
}
