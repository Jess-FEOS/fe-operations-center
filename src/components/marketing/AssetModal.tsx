'use client'

import { useEffect, useState } from 'react'
import {
  ASSET_TYPES, CHANNELS, STATUSES, ContentItem, Program, Status,
  emptyItem, readinessOf, READINESS, windowFit, fmtShort,
} from '@/lib/marketing'

// Add / edit a marketing asset. Shared by the Strategy and Calendar pages.
// (The Content Pipeline keeps its own modal because it also hosts the
// FE-voice drafter.)

type Form = ReturnType<typeof emptyItem>
interface TeamMember { id: string; name: string }

export default function AssetModal({
  item,
  defaults,
  programs,
  team,
  onClose,
  onSaved,
}: {
  item: ContentItem | null            // null = new asset
  defaults?: Partial<Form>            // prefill for new assets (program, date, channel)
  programs: Program[]
  team: TeamMember[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<Form>(() => {
    if (item) {
      const { owner, project_name, ...rest } = item
      return { ...emptyItem(), ...rest }
    }
    const base = { ...emptyItem(), ...defaults }
    const prog = programs.find((p) => p.project_id === base.project_id)
    if (!base.target_audience && prog?.target_audience) base.target_audience = prog.target_audience
    return base
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))
  const toggleChannel = (ch: string) =>
    set('channels', form.channels.includes(ch) ? form.channels.filter((c) => c !== ch) : [...form.channels, ch])

  const program = programs.find((p) => p.project_id === form.project_id)
  const fit = windowFit(form.scheduled_date, program)
  const r = readinessOf(form)

  const save = async () => {
    if (!form.title.trim()) return
    setSaving(true); setErr(null)
    const res = await fetch('/api/marketing', {
      method: form.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).catch(() => null)
    setSaving(false)
    if (res && res.ok) { onSaved(); onClose() }
    else setErr('Could not save. Try again.')
  }
  const remove = async () => {
    if (!form.id || !confirm('Delete this asset?')) return
    setSaving(true)
    const res = await fetch(`/api/marketing?id=${form.id}`, { method: 'DELETE' }).catch(() => null)
    setSaving(false)
    if (res && res.ok) { onSaved(); onClose() }
    else setErr('Could not delete. Try again.')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={form.id ? 'Edit asset' : 'New asset'} className="bg-white border border-fe-line w-full max-w-lg max-h-[90vh] overflow-y-auto font-fira" onClick={(e) => e.stopPropagation()} data-testid="asset-modal">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-fe-line sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: READINESS[r].color }} title={READINESS[r].label} />
            <h2 className="font-barlow font-bold text-lg text-fe-navy">{form.id ? 'Edit asset' : 'New asset'}</h2>
          </div>
          <button onClick={onClose} className="text-fe-blue-gray hover:text-fe-navy" aria-label="Close">✕</button>
        </div>

        <div className="p-5 space-y-3">
          <Field label="Asset">
            <input className="fe-input" autoFocus value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Early-bird announcement graphic" data-testid="asset-title" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Program">
              <select className="fe-input" value={form.project_id || ''} onChange={(e) => set('project_id', e.target.value || null)} data-testid="asset-program">
                <option value="">No program</option>
                {programs.map((p) => <option key={p.project_id} value={p.project_id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Asset type">
              <select className="fe-input" value={form.asset_type || ''} onChange={(e) => set('asset_type', e.target.value || null)} data-testid="asset-type">
                <option value="">—</option>
                {ASSET_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Platforms">
            <div className="flex flex-wrap gap-1.5">
              {CHANNELS.map((ch) => {
                const on = form.channels.includes(ch)
                return (
                  <button key={ch} type="button" onClick={() => toggleChannel(ch)} data-testid={`asset-channel-${ch}`}
                    className={`px-2.5 py-1 text-xs border transition-colors ${on ? 'bg-fe-blue text-white border-fe-blue' : 'bg-white text-fe-blue-gray border-fe-line hover:border-fe-line-strong'}`}>
                    {ch}
                  </button>
                )
              })}
            </div>
          </Field>

          <Field label="Target audience">
            <input className="fe-input" value={form.target_audience || ''} onChange={(e) => set('target_audience', e.target.value || null)} placeholder="e.g. Junior credit analysts, 1–3 yrs" data-testid="asset-audience" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Post date">
              <input type="date" className="fe-input" value={form.scheduled_date || ''} onChange={(e) => set('scheduled_date', e.target.value || null)} data-testid="asset-date" />
            </Field>
            <Field label="Owner">
              <select className="fe-input" value={form.owner_id || ''} onChange={(e) => set('owner_id', e.target.value || null)} data-testid="asset-owner">
                <option value="">Unassigned</option>
                {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
          </div>
          {fit === 'before' || fit === 'after' ? (
            <p className="text-xs text-fe-red -mt-1" data-testid="asset-window-warning">
              Outside the {program?.name} marketing window ({fmtShort(program!.marketing_start)} – {fmtShort(program!.program_start)}).
            </p>
          ) : null}

          {/* Readiness checklist */}
          <div className="border border-fe-line bg-fe-offwhite p-3 space-y-2">
            <span className="block text-xs text-fe-blue-gray uppercase tracking-wider">Readiness</span>
            <div className="flex flex-wrap gap-4">
              <Check label="Copy written" checked={form.copy_ready} onChange={(v) => set('copy_ready', v)} testid="asset-copy-ready" />
              <Check label="Creative done" checked={form.creative_ready} onChange={(v) => set('creative_ready', v)} testid="asset-creative-ready" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-fe-blue-gray">Status</span>
              <select className="fe-input !w-auto py-1" value={form.status} onChange={(e) => set('status', e.target.value as Status)} data-testid="asset-status">
                {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <span className="text-xs font-bold ml-auto" style={{ color: READINESS[r].color }}>{READINESS[r].label}</span>
            </div>
            <p className="text-[11px] text-fe-blue-gray">Turns green once the status is Scheduled or Posted.</p>
          </div>

          <Field label="Asset / Drive link">
            <input className="fe-input" value={form.asset_link || ''} onChange={(e) => set('asset_link', e.target.value || null)} placeholder="https://drive.google.com/…" />
          </Field>
          <Field label="Copy / caption">
            <textarea className="fe-input min-h-[90px] resize-y" value={form.caption || ''} onChange={(e) => set('caption', e.target.value || null)} placeholder="Post copy…" />
          </Field>
          {err && <p className="text-xs text-fe-red">{err}</p>}
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 border-t border-fe-line sticky bottom-0 bg-white">
          {form.id ? (
            <button onClick={remove} disabled={saving} className="text-xs text-fe-red hover:underline disabled:opacity-50">Delete</button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 border border-fe-line bg-white hover:bg-gray-50 text-sm text-fe-anthracite">Cancel</button>
            <button onClick={save} disabled={saving || !form.title.trim()} className="px-4 py-1.5 bg-fe-blue text-white text-sm font-bold hover:opacity-90 disabled:opacity-50" data-testid="asset-save">
              {saving ? 'Saving…' : form.id ? 'Save' : 'Add asset'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-fe-blue-gray uppercase tracking-wider mb-1">{label}</span>
      {children}
    </label>
  )
}

function Check({ label, checked, onChange, testid }: { label: string; checked: boolean; onChange: (v: boolean) => void; testid: string }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-fe-anthracite cursor-pointer">
      <input type="checkbox" className="w-4 h-4 accent-[#046A38]" checked={checked} onChange={(e) => onChange(e.target.checked)} data-testid={testid} />
      {label}
    </label>
  )
}
