'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import PageHeader from '@/components/PageHeader'

// ── Types ───────────────────────────────────────────────────────────────────

type DeliverableStatus = 'not_started' | 'in_progress' | 'in_review' | 'approved' | 'delivered'

interface RoleMember {
  id: string
  name: string
  initials: string
  color: string
  role: string
}

interface InspoLink {
  label: string
  url: string
}

interface DeliverableAsset {
  id: string
  deliverable_id: string
  file_name: string
  file_type: string | null
  file_size: number | null
  version: number
  is_current: boolean
  is_from_team: boolean
  notes: string | null
  public_url: string | null
}

interface RoleDeliverable {
  id: string
  vendor_id: string
  deliverable: string
  status: DeliverableStatus
  due_date: string | null
  concepts_due: string | null
  date_assigned: string | null
  recurring: boolean
  external_link: string | null
  comments: string | null
  inspo_links: InspoLink[] | null
  vendor_name: string | null
  vendor_color: string | null
  project_name: string | null
  assets: DeliverableAsset[]
}

interface RoleData {
  id: string
  name: string
  color: string
  description: string | null
  members: RoleMember[]
  deliverables: RoleDeliverable[]
}

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<DeliverableStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  in_review: 'In Review',
  approved: 'Approved',
  delivered: 'Delivered',
}

const STATUS_PILL: Record<DeliverableStatus, string> = {
  not_started: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-fe-blue text-white',
  in_review: 'bg-fe-gold text-white',
  approved: 'bg-fe-teal text-white',
  delivered: 'bg-fe-green text-white',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr.length <= 10 ? dateStr + 'T00:00:00' : dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtSize(bytes: number | null): string {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr.length <= 10 ? dateStr + 'T00:00:00' : dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function normalizeUrl(url: string): string {
  const t = url.trim()
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VendorWorkspacePage() {
  const params = useParams()
  const roleId = Array.isArray(params.id) ? params.id[0] : (params.id as string)

  const [role, setRole] = useState<RoleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploadFor, setUploadFor] = useState<{ deliverable: RoleDeliverable; fromTeam: boolean } | null>(null)
  const [showDelivered, setShowDelivered] = useState(false)

  async function load() {
    const r = await fetch(`/api/vendor-roles/${roleId}`).then((res) => res.json())
    setRole(r && !r.error ? r : null)
    setLoading(false)
  }

  useEffect(() => {
    if (roleId) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleId])

  async function patchDeliverable(id: string, updates: Record<string, any>) {
    await fetch(`/api/vendors/deliverables/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    load()
  }

  // Split active vs delivered so the working list stays clean.
  const { active, delivered } = useMemo(() => {
    const all = role?.deliverables || []
    return {
      active: all.filter((d) => d.status !== 'delivered'),
      delivered: all.filter((d) => d.status === 'delivered'),
    }
  }, [role])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-fe-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!role) {
    return (
      <div className="font-fira">
        <PageHeader eyebrow="VENDOR PORTAL" title="Workspace not found" subtitle="This workspace could not be loaded." />
        <Link href="/vendors" className="text-[13px] font-fira text-fe-blue hover:underline">
          ← Back to Vendor Portal
        </Link>
      </div>
    )
  }

  return (
    <div className="font-fira">
      <PageHeader
        eyebrow="VENDOR PORTAL"
        title={role.name}
        subtitle="Everything you need for your work here — deliverables, due dates, our notes, reference links, and files. This is our shared source of truth."
        actions={
          <Link
            href="/vendors"
            data-testid="link-back-vendors"
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-[13px] font-fira text-fe-navy hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
        }
      />

      {/* Summary bar */}
      <div
        className="bg-white border border-gray-100 p-4 mb-6 flex items-center gap-3"
        style={{ borderLeftWidth: 6, borderLeftColor: role.color }}
      >
        <span className="text-[13px] font-fira text-fe-blue-gray">
          <span className="font-bold text-fe-navy">{active.length}</span> active deliverable
          {active.length === 1 ? '' : 's'}
        </span>
        {delivered.length > 0 && (
          <>
            <span className="text-fe-blue-gray/40">·</span>
            <span className="text-[13px] font-fira text-fe-blue-gray">
              <span className="font-bold text-fe-navy">{delivered.length}</span> delivered
            </span>
          </>
        )}
      </div>

      {active.length === 0 && delivered.length === 0 ? (
        <div className="text-center py-20 text-fe-blue-gray font-fira text-sm">
          No deliverables here yet. When we assign work to this workspace, it will appear here.
        </div>
      ) : (
        <div className="space-y-5">
          {active.map((d) => (
            <DeliverableCard
              key={d.id}
              d={d}
              onPatch={patchDeliverable}
              onUploadFinal={() => setUploadFor({ deliverable: d, fromTeam: false })}
              onUploadTeam={() => setUploadFor({ deliverable: d, fromTeam: true })}
            />
          ))}
        </div>
      )}

      {/* Delivered / archive */}
      {delivered.length > 0 && (
        <div className="mt-8">
          <button
            onClick={() => setShowDelivered((v) => !v)}
            data-testid="button-toggle-delivered"
            className="inline-flex items-center gap-2 text-[13px] font-fira text-fe-blue-gray hover:text-fe-navy transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showDelivered ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {showDelivered ? 'Hide' : 'Show'} delivered ({delivered.length})
          </button>
          {showDelivered && (
            <div className="space-y-5 mt-4">
              {delivered.map((d) => (
                <DeliverableCard
                  key={d.id}
                  d={d}
                  onPatch={patchDeliverable}
                  onUploadFinal={() => setUploadFor({ deliverable: d, fromTeam: false })}
                  onUploadTeam={() => setUploadFor({ deliverable: d, fromTeam: true })}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {uploadFor && (
        <UploadModal
          deliverable={uploadFor.deliverable}
          fromTeam={uploadFor.fromTeam}
          onClose={() => setUploadFor(null)}
          onUploaded={() => {
            setUploadFor(null)
            load()
          }}
        />
      )}
    </div>
  )
}

// ── Deliverable card ────────────────────────────────────────────────────────

function DeliverableCard({
  d,
  onPatch,
  onUploadFinal,
  onUploadTeam,
}: {
  d: RoleDeliverable
  onPatch: (id: string, updates: Record<string, any>) => void
  onUploadFinal: () => void
  onUploadTeam: () => void
}) {
  const days = daysUntil(d.due_date)
  const teamFiles = d.assets.filter((a) => a.is_from_team)
  const finalFiles = d.assets.filter((a) => !a.is_from_team)

  let dueTone = 'text-fe-blue-gray'
  if (days !== null && d.status !== 'delivered') {
    if (days < 0) dueTone = 'text-fe-red font-bold'
    else if (days <= 3) dueTone = 'text-fe-gold font-bold'
  }

  return (
    <section
      data-testid={`deliverable-card-${d.id}`}
      className="bg-white border border-gray-100"
      style={{ borderLeftWidth: 6, borderLeftColor: d.vendor_color || role_color_fallback }}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-barlow font-extrabold text-xl text-fe-navy leading-tight">{d.deliverable}</h2>
              {d.recurring && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-fira font-bold bg-fe-blue-gray/15 text-fe-blue-gray uppercase tracking-wide">
                  Recurring
                </span>
              )}
            </div>
            <div className="mt-1.5 flex items-center gap-x-3 gap-y-1 flex-wrap text-[12px] font-fira text-fe-blue-gray">
              {d.vendor_name && <span>{d.vendor_name}</span>}
              {d.project_name && (
                <>
                  <span className="text-fe-blue-gray/40">·</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-fira font-bold bg-fe-navy/10 text-fe-navy uppercase tracking-wide">
                    {d.project_name}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-[10px] font-barlow font-bold uppercase tracking-wider text-fe-blue-gray">Due</div>
              <div className={`text-[13px] font-fira ${dueTone}`}>
                {fmtDate(d.due_date)}
                {days !== null && d.status !== 'delivered' && (
                  <span className="ml-1">
                    {days < 0 ? `· ${Math.abs(days)}d overdue` : days === 0 ? '· today' : `· ${days}d`}
                  </span>
                )}
              </div>
            </div>
            <StatusPicker d={d} onPatch={onPatch} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: notes + inspo links */}
        <div className="space-y-5">
          <NotesEditor d={d} onPatch={onPatch} />
          <LinksEditor d={d} onPatch={onPatch} />
        </div>

        {/* Right: files */}
        <div className="space-y-5">
          <FileGroup
            title="From the team"
            hint="Docs, briefs & copy we've shared for you to use"
            files={teamFiles}
            onUpload={onUploadTeam}
            uploadLabel="Add team file"
          />
          <FileGroup
            title="Final uploads"
            hint="Drop your finished work here — it flows into our asset library"
            files={finalFiles}
            onUpload={onUploadFinal}
            uploadLabel="Upload final"
            accent
          />
        </div>
      </div>
    </section>
  )
}

const role_color_fallback = '#647692'

// ── Status picker (inline) ──────────────────────────────────────────────────

function StatusPicker({
  d,
  onPatch,
}: {
  d: RoleDeliverable
  onPatch: (id: string, updates: Record<string, any>) => void
}) {
  return (
    <select
      value={d.status}
      onChange={(e) => onPatch(d.id, { status: e.target.value })}
      data-testid={`select-status-${d.id}`}
      className={`px-3 py-1.5 text-[12px] font-fira font-bold border-0 focus:outline-none focus:ring-2 focus:ring-fe-blue/40 cursor-pointer ${STATUS_PILL[d.status]}`}
    >
      {(Object.keys(STATUS_LABELS) as DeliverableStatus[]).map((s) => (
        <option key={s} value={s} className="bg-white text-fe-navy">
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  )
}

// ── Notes editor ────────────────────────────────────────────────────────────

function NotesEditor({
  d,
  onPatch,
}: {
  d: RoleDeliverable
  onPatch: (id: string, updates: Record<string, any>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(d.comments || '')
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    await onPatch(d.id, { comments: text.trim() || null })
    setBusy(false)
    setEditing(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-barlow font-bold uppercase tracking-wider text-fe-blue-gray">
          Notes &amp; direction
        </span>
        {!editing && (
          <button
            onClick={() => {
              setText(d.comments || '')
              setEditing(true)
            }}
            data-testid={`button-edit-notes-${d.id}`}
            className="text-[11px] font-fira text-fe-blue hover:underline"
          >
            {d.comments ? 'Edit' : 'Add notes'}
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            autoFocus
            data-testid={`textarea-notes-${d.id}`}
            placeholder="Inspo, design direction, context, reminders — anything the vendor should refer back to."
            className="w-full px-3 py-2.5 border border-gray-200 text-[13px] font-fira text-fe-navy focus:outline-none focus:border-fe-blue leading-relaxed"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={busy}
              data-testid={`button-save-notes-${d.id}`}
              className="px-3 py-1.5 bg-fe-blue text-white text-[12px] font-fira font-bold hover:bg-fe-blue/90 transition-colors disabled:opacity-40"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => setEditing(false)}
              data-testid={`button-cancel-notes-${d.id}`}
              className="px-3 py-1.5 border border-gray-200 text-[12px] font-fira text-fe-navy hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : d.comments ? (
        <p className="text-[13px] font-fira text-fe-navy whitespace-pre-wrap leading-relaxed bg-fe-offwhite/60 border border-gray-100 px-3 py-2.5">
          {d.comments}
        </p>
      ) : (
        <p className="text-[12px] font-fira text-fe-blue-gray italic">No notes yet.</p>
      )}
    </div>
  )
}

// ── Links editor ────────────────────────────────────────────────────────────

function LinksEditor({
  d,
  onPatch,
}: {
  d: RoleDeliverable
  onPatch: (id: string, updates: Record<string, any>) => void
}) {
  const links = Array.isArray(d.inspo_links) ? d.inspo_links : []
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)

  async function addLink() {
    const clean = normalizeUrl(url)
    if (!clean) return
    setBusy(true)
    const next = [...links, { label: label.trim() || clean.replace(/^https?:\/\//, ''), url: clean }]
    await onPatch(d.id, { inspo_links: next })
    setBusy(false)
    setLabel('')
    setUrl('')
    setAdding(false)
  }

  async function removeLink(idx: number) {
    const next = links.filter((_, i) => i !== idx)
    await onPatch(d.id, { inspo_links: next })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-barlow font-bold uppercase tracking-wider text-fe-blue-gray">
          Reference &amp; inspo links
        </span>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            data-testid={`button-add-link-${d.id}`}
            className="text-[11px] font-fira text-fe-blue hover:underline"
          >
            Add link
          </button>
        )}
      </div>

      {links.length > 0 ? (
        <ul className="space-y-1.5 mb-2">
          {links.map((l, i) => (
            <li
              key={i}
              className="flex items-center gap-2 bg-fe-offwhite/60 border border-gray-100 px-3 py-2 group"
              data-testid={`link-item-${d.id}-${i}`}
            >
              <svg className="w-3.5 h-3.5 text-fe-blue-gray shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5m8-3.828a4 4 0 00-5.656 0l-3 3"
                />
              </svg>
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] font-fira text-fe-blue hover:underline truncate flex-1"
                title={l.url}
              >
                {l.label}
              </a>
              <button
                onClick={() => removeLink(i)}
                data-testid={`button-remove-link-${d.id}-${i}`}
                className="text-fe-blue-gray hover:text-fe-red transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                title="Remove link"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        !adding && <p className="text-[12px] font-fira text-fe-blue-gray italic">No links yet.</p>
      )}

      {adding && (
        <div className="space-y-2 border border-gray-100 p-3 bg-fe-offwhite/40">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g. Brand guidelines)"
            data-testid={`input-link-label-${d.id}`}
            className="w-full px-3 py-2 border border-gray-200 text-[13px] font-fira text-fe-navy focus:outline-none focus:border-fe-blue"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste URL"
            data-testid={`input-link-url-${d.id}`}
            className="w-full px-3 py-2 border border-gray-200 text-[13px] font-fira text-fe-navy focus:outline-none focus:border-fe-blue"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={addLink}
              disabled={busy || !url.trim()}
              data-testid={`button-save-link-${d.id}`}
              className="px-3 py-1.5 bg-fe-blue text-white text-[12px] font-fira font-bold hover:bg-fe-blue/90 transition-colors disabled:opacity-40"
            >
              {busy ? 'Adding…' : 'Add'}
            </button>
            <button
              onClick={() => {
                setAdding(false)
                setLabel('')
                setUrl('')
              }}
              className="px-3 py-1.5 border border-gray-200 text-[12px] font-fira text-fe-navy hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── File group ──────────────────────────────────────────────────────────────

function FileGroup({
  title,
  hint,
  files,
  onUpload,
  uploadLabel,
  accent,
}: {
  title: string
  hint: string
  files: DeliverableAsset[]
  onUpload: () => void
  uploadLabel: string
  accent?: boolean
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-barlow font-bold uppercase tracking-wider text-fe-blue-gray">
          {title} ({files.length})
        </span>
        <button
          onClick={onUpload}
          data-testid={`button-upload-${accent ? 'final' : 'team'}`}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-fira font-bold transition-colors ${
            accent
              ? 'bg-fe-blue text-white hover:bg-fe-blue/90'
              : 'border border-gray-200 text-fe-navy hover:bg-gray-50'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          {uploadLabel}
        </button>
      </div>
      <p className="text-[11px] font-fira text-fe-blue-gray mb-2">{hint}</p>
      {files.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {files.map((a) => (
            <AssetThumb key={a.id} asset={a} />
          ))}
        </div>
      ) : (
        <p className="text-[12px] font-fira text-fe-blue-gray italic">No files yet.</p>
      )}
    </div>
  )
}

// ── Asset thumbnail ─────────────────────────────────────────────────────────

function AssetThumb({ asset }: { asset: DeliverableAsset }) {
  const isImage = (asset.file_type || '').startsWith('image/')
  const href = asset.public_url || undefined
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={`asset-thumb-${asset.id}`}
      className={`relative block w-32 shrink-0 bg-white border border-gray-100 hover:shadow-md transition-shadow ${!asset.is_current && !asset.is_from_team ? 'opacity-70' : ''}`}
    >
      <div className="absolute top-1 left-1 z-10 flex items-center gap-1">
        {asset.is_current && !asset.is_from_team && (
          <span className="px-1.5 py-0.5 rounded-full bg-fe-teal text-white text-[9px] font-fira font-bold">Current</span>
        )}
        {!asset.is_from_team && asset.version > 1 && (
          <span className="px-1 py-0.5 bg-fe-navy text-white text-[9px] font-fira font-bold">v{asset.version}</span>
        )}
      </div>
      <div className="h-24 bg-fe-offwhite flex items-center justify-center overflow-hidden">
        {isImage && href ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={href} alt={asset.file_name} className="max-w-full max-h-full object-contain" />
        ) : (
          <svg className="w-8 h-8 text-fe-blue-gray/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
      </div>
      <div className="px-1.5 py-1.5">
        <p className="text-[11px] font-fira text-fe-navy truncate" title={asset.file_name}>
          {asset.file_name}
        </p>
        {asset.notes && (
          <p className="text-[9px] font-fira text-fe-blue-gray truncate" title={asset.notes}>
            {asset.notes}
          </p>
        )}
        <p className="text-[9px] font-fira text-fe-blue-gray">{fmtSize(asset.file_size)}</p>
      </div>
    </a>
  )
}

// ── Upload modal ────────────────────────────────────────────────────────────

function UploadModal({
  deliverable,
  fromTeam,
  onClose,
  onUploaded,
}: {
  deliverable: RoleDeliverable
  fromTeam: boolean
  onClose: () => void
  onUploaded: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const finalFiles = deliverable.assets.filter((a) => !a.is_from_team)
  const nextVersion = (finalFiles.reduce((max, a) => Math.max(max, a.version || 0), 0) || 0) + 1

  const inputClass =
    'w-full px-3 py-2.5 border border-gray-200 text-sm font-fira text-fe-navy focus:outline-none focus:border-fe-blue'
  const labelClass = 'block text-[11px] font-barlow font-bold uppercase tracking-wider text-fe-blue-gray mb-1'

  async function submit() {
    if (!file) return
    setBusy(true)
    setError('')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('deliverable_id', deliverable.id)
    fd.append('vendor_id', deliverable.vendor_id)
    if (notes.trim()) fd.append('notes', notes.trim())
    if (fromTeam) {
      fd.append('is_from_team', 'true')
    } else {
      fd.append('version', String(nextVersion))
      fd.append('is_current', 'true')
    }
    const res = await fetch('/api/vendors/assets', { method: 'POST', body: fd })
    setBusy(false)
    if (res.ok) onUploaded()
    else {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Upload failed')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white border border-gray-100 shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-barlow font-extrabold text-lg text-fe-navy mb-1">
          {fromTeam ? 'Add team file' : 'Upload final'}
        </h2>
        <p className="text-[13px] font-fira text-fe-blue-gray mb-4">
          {deliverable.deliverable}
          {!fromTeam ? ` · v${nextVersion}` : ''}
        </p>

        <div className="space-y-4">
          <div>
            <label className={labelClass}>File</label>
            <input
              type="file"
              accept="image/*,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.mp4,.mov"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              data-testid="input-upload-file"
              className="w-full text-sm font-fira file:mr-3 file:px-3 file:py-2 file:border-0 file:bg-fe-navy file:text-white file:text-sm file:font-fira"
            />
            {file && (
              <p className="text-[12px] font-fira text-fe-blue-gray mt-1">
                {file.name} · {fmtSize(file.size)}
              </p>
            )}
          </div>
          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              data-testid="input-upload-notes"
              className={inputClass}
              placeholder={fromTeam ? 'What is this file for?' : 'Notes for the team'}
            />
          </div>
          {error && <p className="text-[12px] font-fira text-fe-red">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            data-testid="button-upload-cancel"
            className="px-4 py-2 border border-gray-200 text-[13px] font-fira text-fe-navy hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!file || busy}
            data-testid="button-upload-submit"
            className="px-4 py-2 bg-fe-blue text-white text-[13px] font-fira font-bold hover:bg-fe-blue/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}
