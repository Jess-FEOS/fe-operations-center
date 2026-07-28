'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Avatar from '@/components/Avatar'
import PageHeader from '@/components/PageHeader'

// ------------------------------------------------------------------
// Marketing content pipeline. Backed by marketing_content — the SAME
// table the master calendar's Marketing layer reads, so items created
// here appear on the calendar on their scheduled_date.
// Two views: Kanban board (by status) and a sortable/filterable table.
// ------------------------------------------------------------------

type Status = 'idea' | 'drafted' | 'scheduled' | 'posted'

const STATUSES: { key: Status; label: string; color: string }[] = [
  { key: 'idea', label: 'Idea', color: '#9CA3AF' },
  { key: 'drafted', label: 'Drafted', color: '#0762C8' },
  { key: 'scheduled', label: 'Scheduled', color: '#B29838' },
  { key: 'posted', label: 'Posted', color: '#046A38' },
]
const STATUS_COLOR: Record<Status, string> = {
  idea: '#9CA3AF', drafted: '#0762C8', scheduled: '#B29838', posted: '#046A38',
}
const STATUS_LABEL: Record<Status, string> = {
  idea: 'Idea', drafted: 'Drafted', scheduled: 'Scheduled', posted: 'Posted',
}

const CHANNELS = ['YouTube', 'TikTok', 'Instagram', 'LinkedIn', 'X', 'Email', 'Blog'] as const

interface Owner { id: string; name: string; initials: string; color: string }
interface ContentItem {
  id: string
  title: string
  channels: string[]
  status: Status
  scheduled_date: string | null
  asset_link: string | null
  caption: string | null
  owner_id: string | null
  owner: Owner | null
  project_id: string | null
  project_name: string | null
}
interface TeamMember { id: string; name: string; initials: string; color: string }
interface ProjectLite { id: string; name: string }

const EMPTY: Omit<ContentItem, 'owner' | 'project_name'> = {
  id: '', title: '', channels: [], status: 'idea', scheduled_date: null,
  asset_link: null, caption: null, owner_id: null, project_id: null,
}

function fmtDate(s: string | null) {
  if (!s) return '—'
  const d = new Date(s + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function MarketingPage() {
  const [view, setView] = useState<'board' | 'table'>('board')
  const [items, setItems] = useState<ContentItem[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [projects, setProjects] = useState<ProjectLite[]>([])
  const [loading, setLoading] = useState(true)

  // filters (table view)
  const [filterStatus, setFilterStatus] = useState<'' | Status>('')
  const [filterChannel, setFilterChannel] = useState<string>('')

  // modal
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<typeof EMPTY>({ ...EMPTY })
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/marketing').then((r) => r.json()).catch(() => []),
      fetch('/api/team').then((r) => r.json()).catch(() => []),
      fetch('/api/projects').then((r) => r.json()).catch(() => []),
    ]).then(([itemsData, teamData, projData]) => {
      setItems(Array.isArray(itemsData) ? itemsData : [])
      setTeam(Array.isArray(teamData) ? teamData.map((m: any) => ({ id: m.id, name: m.name, initials: m.initials, color: m.color })) : [])
      setProjects(Array.isArray(projData) ? projData.map((p: any) => ({ id: p.id, name: p.name })) : [])
      setLoading(false)
    })
  }, [])

  useEffect(() => { load() }, [load])

  const openNew = () => { setForm({ ...EMPTY }); setFormOpen(true) }
  const openEdit = (it: ContentItem) => {
    setForm({
      id: it.id, title: it.title, channels: it.channels || [], status: it.status,
      scheduled_date: it.scheduled_date, asset_link: it.asset_link, caption: it.caption,
      owner_id: it.owner_id, project_id: it.project_id,
    })
    setFormOpen(true)
  }
  const closeForm = () => { setFormOpen(false); setSaving(false) }

  const toggleChannel = (ch: string) => {
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(ch) ? f.channels.filter((c) => c !== ch) : [...f.channels, ch],
    }))
  }

  const save = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const method = form.id ? 'PATCH' : 'POST'
    const res = await fetch('/api/marketing', {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    }).catch(() => null)
    setSaving(false)
    if (res && res.ok) { closeForm(); load() }
  }
  const remove = async () => {
    if (!form.id) return
    setSaving(true)
    const res = await fetch(`/api/marketing?id=${form.id}`, { method: 'DELETE' }).catch(() => null)
    setSaving(false)
    if (res && res.ok) { closeForm(); load() }
  }

  // advance status inline (board card + table). Cycles forward, wraps at posted.
  const advanceStatus = async (it: ContentItem) => {
    const order: Status[] = ['idea', 'drafted', 'scheduled', 'posted']
    const next = order[(order.indexOf(it.status) + 1) % order.length]
    // optimistic
    setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, status: next } : x)))
    await fetch('/api/marketing', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: it.id, status: next }),
    }).catch(() => null)
  }

  const filtered = items.filter((it) => {
    if (filterStatus && it.status !== filterStatus) return false
    if (filterChannel && !it.channels.includes(filterChannel)) return false
    return true
  })

  return (
    <div className="font-fira">
      <PageHeader
        title="Marketing"
        subtitle="Content pipeline — plans here flow onto the calendar"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex border border-fe-line">
              <button
                onClick={() => setView('board')}
                data-testid="view-board"
                className={`px-3 py-1.5 text-sm font-fira transition-colors ${view === 'board' ? 'bg-fe-navy text-white' : 'bg-white text-fe-blue-gray hover:bg-gray-50'}`}
              >Board</button>
              <button
                onClick={() => setView('table')}
                data-testid="view-table"
                className={`px-3 py-1.5 text-sm font-fira transition-colors border-l border-fe-line ${view === 'table' ? 'bg-fe-navy text-white' : 'bg-white text-fe-blue-gray hover:bg-gray-50'}`}
              >Table</button>
            </div>
            <button
              onClick={openNew}
              data-testid="button-new-content"
              className="px-4 py-1.5 bg-fe-blue text-white text-sm font-fira font-bold hover:opacity-90"
            >+ New content</button>
          </div>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-fe-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="border border-fe-line bg-white p-12 text-center">
          <p className="font-barlow font-bold text-lg text-fe-navy mb-1">No content yet</p>
          <p className="text-sm text-fe-blue-gray font-fira mb-4">Add your first piece of content — it'll show on the calendar on its scheduled date.</p>
          <button onClick={openNew} className="px-4 py-2 bg-fe-blue text-white text-sm font-fira font-bold hover:opacity-90" data-testid="button-new-content-empty">+ New content</button>
        </div>
      ) : view === 'board' ? (
        // ---------------- Kanban board ----------------
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3" data-testid="board">
          {STATUSES.map((col) => {
            const colItems = items.filter((it) => it.status === col.key)
            return (
              <div key={col.key} className="bg-fe-offwhite border border-fe-line" data-testid={`col-${col.key}`}>
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-fe-line bg-white">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5" style={{ backgroundColor: col.color }} />
                    <span className="font-barlow font-bold text-sm text-fe-navy">{col.label}</span>
                  </div>
                  <span className="text-xs font-fira text-fe-blue-gray">{colItems.length}</span>
                </div>
                <div className="p-2 space-y-2 min-h-[80px]">
                  {colItems.map((it) => (
                    <div
                      key={it.id}
                      className="bg-white border border-fe-line p-2.5 cursor-pointer hover:border-fe-line-strong transition-colors"
                      style={{ borderLeft: `3px solid ${col.color}` }}
                      onClick={() => openEdit(it)}
                      data-testid={`card-${it.id}`}
                    >
                      <p className="font-fira text-sm text-fe-anthracite font-medium leading-snug mb-1.5">{it.title}</p>
                      {it.channels.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {it.channels.map((ch) => (
                            <span key={ch} className="text-[10px] font-fira px-1.5 py-0.5 bg-fe-offwhite border border-fe-line text-fe-blue-gray uppercase tracking-wide">{ch}</span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-fira text-fe-blue-gray">{fmtDate(it.scheduled_date)}</span>
                        <div className="flex items-center gap-1.5">
                          {it.owner && <Avatar initials={it.owner.initials} color={it.owner.color} size="sm" title={it.owner.name} />}
                          {col.key !== 'posted' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); advanceStatus(it) }}
                              className="text-xs font-fira text-fe-blue hover:underline"
                              data-testid={`advance-${it.id}`}
                              title="Move to next stage"
                            >→</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {colItems.length === 0 && (
                    <p className="text-xs font-fira text-fe-blue-gray/60 text-center py-4">Nothing here</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        // ---------------- Table ----------------
        <div>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-xs text-fe-blue-gray font-fira uppercase tracking-wider mr-1">Filter</span>
            <select
              className="fe-input w-auto py-1.5"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              data-testid="filter-status"
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <select
              className="fe-input w-auto py-1.5"
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              data-testid="filter-channel"
            >
              <option value="">All channels</option>
              {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {(filterStatus || filterChannel) && (
              <button onClick={() => { setFilterStatus(''); setFilterChannel('') }} className="text-xs font-fira text-fe-blue-gray hover:text-fe-navy">Clear</button>
            )}
          </div>

          <div className="border border-fe-line bg-white overflow-x-auto">
            <table className="w-full text-sm font-fira">
              <thead>
                <tr className="border-b border-fe-line bg-fe-offwhite text-left">
                  <th className="px-3 py-2.5 font-barlow font-bold text-fe-navy">Title</th>
                  <th className="px-3 py-2.5 font-barlow font-bold text-fe-navy">Channels</th>
                  <th className="px-3 py-2.5 font-barlow font-bold text-fe-navy">Status</th>
                  <th className="px-3 py-2.5 font-barlow font-bold text-fe-navy">Date</th>
                  <th className="px-3 py-2.5 font-barlow font-bold text-fe-navy">Owner</th>
                  <th className="px-3 py-2.5 font-barlow font-bold text-fe-navy">Link</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => (
                  <tr
                    key={it.id}
                    className="border-b border-fe-line last:border-b-0 hover:bg-fe-offwhite cursor-pointer"
                    onClick={() => openEdit(it)}
                    data-testid={`row-${it.id}`}
                  >
                    <td className="px-3 py-2.5 text-fe-anthracite font-medium">{it.title}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {it.channels.map((ch) => (
                          <span key={ch} className="text-[10px] font-fira px-1.5 py-0.5 bg-fe-offwhite border border-fe-line text-fe-blue-gray uppercase">{ch}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); advanceStatus(it) }}
                        className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-fira"
                        style={{ backgroundColor: `${STATUS_COLOR[it.status]}18`, color: STATUS_COLOR[it.status] }}
                        title="Click to advance"
                        data-testid={`status-${it.id}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[it.status] }} />
                        {STATUS_LABEL[it.status]}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-fe-blue-gray whitespace-nowrap">{fmtDate(it.scheduled_date)}</td>
                    <td className="px-3 py-2.5">
                      {it.owner ? (
                        <div className="flex items-center gap-1.5">
                          <Avatar initials={it.owner.initials} color={it.owner.color} size="sm" title={it.owner.name} />
                          <span className="text-fe-anthracite">{it.owner.name}</span>
                        </div>
                      ) : <span className="text-fe-blue-gray/60">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {it.asset_link ? (
                        <a href={it.asset_link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-fe-blue hover:underline">Open</a>
                      ) : <span className="text-fe-blue-gray/60">—</span>}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-fe-blue-gray font-fira">No items match these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Connectedness note */}
      <p className="mt-3 text-xs font-fira text-fe-blue-gray">
        Scheduled items appear on the{' '}
        <Link href="/calendar" className="text-fe-blue hover:underline">master calendar</Link>{' '}
        under the Marketing layer on their scheduled date.
      </p>

      {/* Add / edit modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeForm}>
          <div className="bg-white border border-fe-line w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="modal-content">
            <div className="fe-panel-header flex items-center justify-between px-5 py-3.5 border-b border-fe-line sticky top-0 bg-white">
              <h2 className="font-barlow font-bold text-lg text-fe-navy">{form.id ? 'Edit content' : 'New content'}</h2>
              <button onClick={closeForm} className="text-fe-blue-gray hover:text-fe-navy" aria-label="Close" data-testid="button-close">✕</button>
            </div>

            <div className="p-5 space-y-3">
              <Field label="Title">
                <input className="fe-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Q3 launch teaser reel" data-testid="input-title" />
              </Field>

              <Field label="Channels">
                <div className="flex flex-wrap gap-1.5">
                  {CHANNELS.map((ch) => {
                    const on = form.channels.includes(ch)
                    return (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => toggleChannel(ch)}
                        data-testid={`channel-${ch}`}
                        className={`px-2.5 py-1 text-xs font-fira border transition-colors ${on ? 'bg-fe-blue text-white border-fe-blue' : 'bg-white text-fe-blue-gray border-fe-line hover:border-fe-line-strong'}`}
                      >{ch}</button>
                    )
                  })}
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Status">
                  <select className="fe-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Status })} data-testid="input-status">
                    {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </Field>
                <Field label="Scheduled date">
                  <input type="date" className="fe-input" value={form.scheduled_date || ''} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value || null })} data-testid="input-date" />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Owner">
                  <select className="fe-input" value={form.owner_id || ''} onChange={(e) => setForm({ ...form, owner_id: e.target.value || null })} data-testid="input-owner">
                    <option value="">Unassigned</option>
                    {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </Field>
                <Field label="Project (optional)">
                  <select className="fe-input" value={form.project_id || ''} onChange={(e) => setForm({ ...form, project_id: e.target.value || null })} data-testid="input-project">
                    <option value="">None</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Asset / Drive link">
                <input className="fe-input" value={form.asset_link || ''} onChange={(e) => setForm({ ...form, asset_link: e.target.value || null })} placeholder="https://drive.google.com/…" data-testid="input-link" />
              </Field>

              <Field label="Caption">
                <textarea className="fe-input min-h-[80px] resize-y" value={form.caption || ''} onChange={(e) => setForm({ ...form, caption: e.target.value || null })} placeholder="Post copy…" data-testid="input-caption" />
              </Field>
            </div>

            <div className="flex items-center justify-between px-5 py-3.5 border-t border-fe-line sticky bottom-0 bg-white">
              {form.id ? (
                <button onClick={remove} disabled={saving} className="text-xs font-fira text-fe-red hover:underline disabled:opacity-50" data-testid="button-delete">Delete</button>
              ) : <span />}
              <div className="flex items-center gap-2">
                <button onClick={closeForm} className="px-3 py-1.5 border border-fe-line bg-white hover:bg-gray-50 text-sm font-fira text-fe-anthracite" data-testid="button-cancel">Cancel</button>
                <button onClick={save} disabled={saving || !form.title.trim()} className="px-4 py-1.5 bg-fe-blue text-white text-sm font-fira font-bold hover:opacity-90 disabled:opacity-50" data-testid="button-save">
                  {saving ? 'Saving…' : form.id ? 'Save' : 'Add content'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-fira text-fe-blue-gray uppercase tracking-wider mb-1">{label}</span>
      {children}
    </label>
  )
}
