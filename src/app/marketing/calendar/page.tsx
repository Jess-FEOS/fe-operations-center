'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import AssetModal from '@/components/marketing/AssetModal'
import {
  CHANNELS, ContentItem, Program, READINESS, Readiness,
  addDays, fmtShort, parseDate, readinessOf, startOfWeek, toISO, marketingRequest,
} from '@/lib/marketing'

// ------------------------------------------------------------------
// Marketing Calendar — what's getting posted where.
//   Month view: the big picture, with program launches marked.
//   Week view:  one row per platform, so each day shows exactly what
//               goes out on which channel.
// Every chip is color-coded by readiness: red = not started,
// amber = in progress, green = ready & scheduled. Anything not yet
// green is drawn dashed so unfinished placeholders stand out.
// ------------------------------------------------------------------

interface TeamMember { id: string; name: string; initials: string; color: string }
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const NO_CHANNEL = 'No platform'

const CH_ABBR: Record<string, string> = {
  YouTube: 'YT', TikTok: 'TT', Instagram: 'IG', LinkedIn: 'LI', X: 'X', Email: 'EM', Blog: 'BL',
}

export default function MarketingCalendarPage() {
  const [items, setItems] = useState<ContentItem[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'month' | 'week'>('month')
  const [anchor, setAnchor] = useState<Date>(() => new Date())
  const [fProgram, setFProgram] = useState('')
  const [fChannel, setFChannel] = useState('')
  const [fReady, setFReady] = useState<'' | Readiness>('')
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

  const filtered = useMemo(() => items.filter((i) => {
    if (fProgram && i.project_id !== fProgram) return false
    if (fChannel && !i.channels.includes(fChannel)) return false
    if (fReady && readinessOf(i) !== fReady) return false
    return true
  }), [items, fProgram, fChannel, fReady])

  const byDate = useMemo(() => {
    const m = new Map<string, ContentItem[]>()
    for (const i of filtered) {
      if (!i.scheduled_date) continue
      if (!m.has(i.scheduled_date)) m.set(i.scheduled_date, [])
      m.get(i.scheduled_date)!.push(i)
    }
    return m
  }, [filtered])

  // Program milestones (marketing launch + program start) by date
  const milestones = useMemo(() => {
    const m = new Map<string, { label: string; kind: 'launch' | 'start' }[]>()
    const add = (d: string | null, label: string, kind: 'launch' | 'start') => {
      if (!d) return
      if (!m.has(d)) m.set(d, [])
      m.get(d)!.push({ label, kind })
    }
    for (const p of programs) {
      if (fProgram && p.project_id !== fProgram) continue
      if (p.project_status !== 'active' && !items.some((i) => i.project_id === p.project_id)) continue
      add(p.marketing_start, `${p.name} marketing launches`, 'launch')
      add(p.program_start, `${p.name} starts`, 'start')
    }
    return m
  }, [programs, items, fProgram])

  const unscheduled = filtered.filter((i) => !i.scheduled_date)
  const today = toISO(new Date())

  // navigation
  const shift = (dir: number) => {
    const d = new Date(anchor)
    if (view === 'month') d.setMonth(d.getMonth() + dir, 1)
    else d.setDate(d.getDate() + dir * 7)
    setAnchor(d)
  }
  const title = view === 'month'
    ? anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : (() => {
        const s = startOfWeek(anchor), e = addDays(s, 6)
        return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      })()

  const openNew = (defaults: any) => setModal({ item: null, defaults: { project_id: fProgram || null, channels: fChannel ? [fChannel] : [], ...defaults } })

  return (
    <div className="font-fira">
      <PageHeader
        eyebrow="Marketing"
        title="Marketing Calendar"
        subtitle="What's getting posted, where, and whether it's ready"
        actions={
          <button onClick={() => openNew({})} className="px-4 py-1.5 bg-fe-blue text-white text-sm font-bold hover:opacity-90" data-testid="button-new-asset">+ New asset</button>
        }
      />

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex border border-fe-line">
            {(['month', 'week'] as const).map((v, i) => (
              <button key={v} onClick={() => setView(v)} data-testid={`view-${v}`}
                className={`px-3 py-1.5 text-sm ${i ? 'border-l border-fe-line' : ''} ${view === v ? 'bg-fe-navy text-white' : 'bg-white text-fe-blue-gray hover:bg-gray-50'}`}>
                {v === 'week' ? 'Week by platform' : 'Month'}
              </button>
            ))}
          </div>
          <button onClick={() => shift(-1)} className="px-2.5 py-1.5 border border-fe-line bg-white text-fe-navy hover:bg-gray-50" aria-label="Previous">‹</button>
          <button onClick={() => setAnchor(new Date())} className="px-3 py-1.5 border border-fe-line bg-white text-sm text-fe-navy hover:bg-gray-50">Today</button>
          <button onClick={() => shift(1)} className="px-2.5 py-1.5 border border-fe-line bg-white text-fe-navy hover:bg-gray-50" aria-label="Next">›</button>
          <h2 className="font-barlow font-bold text-lg text-fe-navy ml-2" data-testid="cal-title">{title}</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select className="fe-input !w-auto py-1.5" value={fProgram} onChange={(e) => setFProgram(e.target.value)} data-testid="filter-program">
            <option value="">All programs</option>
            {programs.map((p) => <option key={p.project_id} value={p.project_id}>{p.name}</option>)}
          </select>
          <select className="fe-input !w-auto py-1.5" value={fChannel} onChange={(e) => setFChannel(e.target.value)} data-testid="filter-channel">
            <option value="">All platforms</option>
            {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="fe-input !w-auto py-1.5" value={fReady} onChange={(e) => setFReady(e.target.value as any)} data-testid="filter-readiness">
            <option value="">Any readiness</option>
            {(Object.keys(READINESS) as Readiness[]).map((k) => <option key={k} value={k}>{READINESS[k].label}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-3 text-xs text-fe-blue-gray flex-wrap">
        {(Object.keys(READINESS) as Readiness[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 border" style={{ backgroundColor: READINESS[k].bg, borderColor: READINESS[k].color, borderStyle: k === 'green' ? 'solid' : 'dashed' }} />
            {READINESS[k].label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5"><span className="text-fe-gold font-bold">▶</span> Program milestone</span>
      </div>

      {error && <div role="alert" className="mb-4 border border-fe-red p-3 text-sm text-fe-red">{error} <button onClick={load} className="underline">Retry</button></div>}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-fe-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : view === 'month' ? (
        <MonthGrid anchor={anchor} today={today} byDate={byDate} milestones={milestones} onOpen={(it) => setModal({ item: it })} onNew={(d) => openNew({ scheduled_date: d })} />
      ) : (
        <WeekGrid anchor={anchor} today={today} items={filtered} milestones={milestones} channelFilter={fChannel}
          onOpen={(it) => setModal({ item: it })}
          onNew={(d, ch) => openNew({ scheduled_date: d, channels: ch && ch !== NO_CHANNEL ? [ch] : [] })} />
      )}

      {!loading && unscheduled.length > 0 && (
        <section className="mt-6 bg-white border border-fe-line" data-testid="unscheduled">
          <div className="px-4 py-3 border-b border-fe-line flex items-center justify-between">
            <h3 className="font-barlow font-bold text-fe-navy">Needs a post date <span className="text-fe-blue-gray font-normal">({unscheduled.length})</span></h3>
            <span className="text-xs text-fe-blue-gray">These won't appear on the calendar until they're dated.</span>
          </div>
          <div className="p-3 flex flex-wrap gap-2">
            {unscheduled.map((it) => <Chip key={it.id} item={it} onClick={() => setModal({ item: it })} showProgram inline />)}
          </div>
        </section>
      )}

      <p className="mt-4 text-xs text-fe-blue-gray">
        Plan assets by program on <Link href="/marketing/strategy" className="text-fe-blue hover:underline">Marketing Strategy</Link>. Project deadlines and seminars live on the{' '}
        <Link href="/calendar" className="text-fe-blue hover:underline">master calendar</Link>.
      </p>

      {modal && (
        <AssetModal item={modal.item} defaults={modal.defaults} programs={programs} team={team} onClose={() => setModal(null)} onSaved={load} />
      )}
    </div>
  )
}

// ── Chip ───────────────────────────────────────────────────────────────
function Chip({ item, onClick, showChannels = true, showProgram = false, inline = false }: { item: ContentItem; onClick: () => void; showChannels?: boolean; showProgram?: boolean; inline?: boolean }) {
  const r = readinessOf(item)
  const s = READINESS[r]
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={`${inline ? 'inline-block max-w-xs' : 'block w-full'} text-left px-1.5 py-1 text-[11px] leading-tight border hover:brightness-95 transition`}
      style={{ backgroundColor: s.bg, borderColor: s.color, borderStyle: r === 'green' ? 'solid' : 'dashed', borderLeftWidth: 3, borderLeftStyle: 'solid' }}
      title={`${item.title}${item.project_name ? ' · ' + item.project_name : ''}${item.channels.length ? ' · ' + item.channels.join(', ') : ''} · ${s.label}`}
      data-testid={`chip-${item.id}`}
    >
      {showChannels && item.channels.length > 0 && (
        <span className="font-bold mr-1" style={{ color: s.color }}>{item.channels.map((c) => CH_ABBR[c] || c).join('·')}</span>
      )}
      <span className="text-fe-anthracite">{item.title}</span>
      {showProgram && item.project_name && <span className="text-fe-blue-gray"> · {item.project_name}</span>}
    </button>
  )
}

function Milestones({ list }: { list?: { label: string; kind: 'launch' | 'start' }[] }) {
  if (!list?.length) return null
  return (
    <>
      {list.map((m, i) => (
        <div key={i} className={`text-[10px] leading-tight font-bold truncate ${m.kind === 'start' ? 'text-fe-gold' : 'text-fe-navy'}`} title={m.label}>
          ▶ {m.label}
        </div>
      ))}
    </>
  )
}

// ── Month ──────────────────────────────────────────────────────────────
function MonthGrid({
  anchor, today, byDate, milestones, onOpen, onNew,
}: {
  anchor: Date
  today: string
  byDate: Map<string, ContentItem[]>
  milestones: Map<string, { label: string; kind: 'launch' | 'start' }[]>
  onOpen: (it: ContentItem) => void
  onNew: (date: string) => void
}) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12)
  const gridStart = startOfWeek(first)
  const month = anchor.getMonth()
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  // Drop a trailing week that's entirely next month
  const rows = days[35].getMonth() !== month ? 5 : 6

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  return (
    <div className="overflow-x-auto">
    <div className="bg-white border border-fe-line min-w-[700px]" data-testid="month-grid">
      <div className="grid grid-cols-7 border-b border-fe-line bg-fe-offwhite">
        {DOW.map((d) => <div key={d} className="px-2 py-2 text-[11px] uppercase tracking-wider text-fe-blue-gray font-bold">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.slice(0, rows * 7).map((d, idx) => {
          const iso = toISO(d)
          const list = byDate.get(iso) || []
          const inMonth = d.getMonth() === month
          return (
            <div
              key={iso}
              onClick={() => onNew(iso)}
              className={`group min-h-[118px] p-1.5 border-b border-r border-fe-line cursor-pointer hover:bg-fe-offwhite/70 ${idx % 7 === 6 ? 'border-r-0' : ''} ${inMonth ? '' : 'bg-fe-offwhite/60'}`}
              data-testid={`day-${iso}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs ${iso === today ? 'bg-fe-blue text-white w-5 h-5 inline-flex items-center justify-center rounded-full font-bold' : inMonth ? 'text-fe-navy font-medium' : 'text-fe-blue-gray/60'}`}>
                  {d.getDate()}
                </span>
                <span className="text-[11px] text-fe-blue opacity-0 group-hover:opacity-100">+</span>
              </div>
              <div className="space-y-1">
                <Milestones list={milestones.get(iso)} />
                {(expanded[iso] ? list : list.slice(0, 4)).map((it) => <Chip key={it.id} item={it} onClick={() => onOpen(it)} />)}
                {list.length > 4 && <button type="button" className="text-[10px] text-fe-blue hover:underline" onClick={(e) => { e.stopPropagation(); setExpanded(prev => ({ ...prev, [iso]: !prev[iso] })) }}>{expanded[iso] ? 'Show less' : `+${list.length - 4} more`}</button>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
    </div>
  )
}

// ── Week × platform ────────────────────────────────────────────────────
function WeekGrid({
  anchor, today, items, milestones, channelFilter, onOpen, onNew,
}: {
  anchor: Date
  today: string
  items: ContentItem[]
  milestones: Map<string, { label: string; kind: 'launch' | 'start' }[]>
  channelFilter: string
  onOpen: (it: ContentItem) => void
  onNew: (date: string, channel: string) => void
}) {
  const start = startOfWeek(anchor)
  const days = Array.from({ length: 7 }, (_, i) => toISO(addDays(start, i)))
  const weekItems = items.filter((i) => i.scheduled_date && i.scheduled_date >= days[0] && i.scheduled_date <= days[6])
  const rows: string[] = channelFilter ? [channelFilter] : [...CHANNELS]
  if (!channelFilter && weekItems.some((i) => i.channels.length === 0)) rows.push(NO_CHANNEL)

  const cell = (ch: string, d: string) =>
    weekItems.filter((i) => i.scheduled_date === d && (ch === NO_CHANNEL ? i.channels.length === 0 : i.channels.includes(ch)))

  const hasMilestones = days.some((d) => milestones.get(d)?.length)

  return (
    <div className="bg-white border border-fe-line overflow-x-auto" data-testid="week-grid">
      <table className="w-full table-fixed min-w-[900px]">
        <thead>
          <tr className="bg-fe-offwhite border-b border-fe-line">
            <th className="w-28 px-3 py-2 text-left text-[11px] uppercase tracking-wider text-fe-blue-gray">Platform</th>
            {days.map((d, i) => (
              <th key={d} className={`px-2 py-2 text-left border-l border-fe-line ${d === today ? 'bg-fe-blue/10' : ''}`}>
                <div className="text-[11px] uppercase tracking-wider text-fe-blue-gray">{DOW[i]}</div>
                <div className={`text-sm ${d === today ? 'text-fe-blue font-bold' : 'text-fe-navy'}`}>{fmtShort(d)}</div>
              </th>
            ))}
          </tr>
          {hasMilestones && (
            <tr className="border-b border-fe-line">
              <td className="px-3 py-1.5 text-[11px] text-fe-blue-gray">Milestones</td>
              {days.map((d) => <td key={d} className="px-2 py-1.5 border-l border-fe-line align-top"><Milestones list={milestones.get(d)} /></td>)}
            </tr>
          )}
        </thead>
        <tbody>
          {rows.map((ch) => (
            <tr key={ch} className="border-b border-fe-line last:border-b-0">
              <td className="px-3 py-2 align-top text-sm font-bold text-fe-navy">{ch}</td>
              {days.map((d) => {
                const list = cell(ch, d)
                return (
                  <td key={d} onClick={() => onNew(d, ch)}
                    className={`group px-1.5 py-1.5 border-l border-fe-line align-top h-20 cursor-pointer hover:bg-fe-offwhite/70 ${d === today ? 'bg-fe-blue/[0.04]' : ''}`}
                    data-testid={`cell-${ch}-${d}`}>
                    <div className="space-y-1">
                      {list.map((it) => <Chip key={it.id} item={it} onClick={() => onOpen(it)} showChannels={false} showProgram />)}
                      {list.length === 0 && <span className="text-[11px] text-fe-blue opacity-0 group-hover:opacity-100">+ Add</span>}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
