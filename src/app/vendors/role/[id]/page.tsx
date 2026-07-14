'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import PageHeader from '@/components/PageHeader'

// ── Types ───────────────────────────────────────────────────────────────────

type DeliverableStatus = 'not_started' | 'in_progress' | 'in_review' | 'approved' | 'delivered'
type ReviewState = 'pending' | 'approved' | 'changes_requested'

interface RoleMember {
  id: string
  name: string
  initials: string
  color: string
  role: string
}

interface TeamMember {
  id: string
  name: string
  initials: string
  color: string
  role: string
  vendor_role_id: string | null
}

interface DeliverableAsset {
  id: string
  deliverable_id: string
  file_name: string
  file_type: string | null
  file_size: number | null
  version: number
  is_current: boolean
  notes: string | null
  public_url: string | null
}

interface RoleDeliverable {
  id: string
  vendor_id: string
  deliverable: string
  status: DeliverableStatus
  review_state: ReviewState
  due_date: string | null
  concepts_due: string | null
  vendor_name: string | null
  vendor_color: string | null
  project_name: string | null
  assigned_to_id: string | null
  assigned_to_name: string | null
  assigned_to_initials: string | null
  assigned_to_color: string | null
  claimed_by_id: string | null
  claimed_by_name: string | null
  claimed_at: string | null
  approved_by_id: string | null
  approved_by_name: string | null
  approved_at: string | null
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

const REVIEW_LABELS: Record<ReviewState, string> = {
  pending: 'Pending Review',
  approved: 'Approved',
  changes_requested: 'Changes Requested',
}

const REVIEW_PILL: Record<ReviewState, string> = {
  pending: 'bg-gray-100 text-gray-600',
  approved: 'bg-fe-teal text-white',
  changes_requested: 'bg-fe-red text-white',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr.length <= 10 ? dateStr + 'T00:00:00' : dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function fmtSize(bytes: number | null): string {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RoleWorkspacePage() {
  const params = useParams()
  const roleId = Array.isArray(params.id) ? params.id[0] : (params.id as string)

  const [role, setRole] = useState<RoleData | null>(null)
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [meId, setMeId] = useState('')
  const [uploadFor, setUploadFor] = useState<RoleDeliverable | null>(null)

  async function load() {
    const [r, t] = await Promise.all([
      fetch(`/api/vendor-roles/${roleId}`).then((res) => res.json()),
      fetch('/api/team').then((res) => res.json()),
    ])
    setRole(r && !r.error ? r : null)
    setTeam(Array.isArray(t) ? t : [])
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

  // Group deliverables by category (vendor_name).
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; name: string; color: string | null; items: RoleDeliverable[] }>()
    for (const d of role?.deliverables || []) {
      const key = d.vendor_id || '__none__'
      const name = d.vendor_name || 'Uncategorized'
      if (!map.has(key)) map.set(key, { key, name, color: d.vendor_color, items: [] })
      map.get(key)!.items.push(d)
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
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
        <PageHeader eyebrow="VENDOR WORKSPACE" title="Role not found" subtitle="This workspace could not be loaded." />
        <Link href="/vendors" className="text-[13px] font-fira text-fe-blue hover:underline">
          ← Back to Vendors
        </Link>
      </div>
    )
  }

  return (
    <div className="font-fira">
      <PageHeader
        eyebrow="VENDOR WORKSPACE"
        title={role.name}
        subtitle={role.description || 'Deliverables for this role.'}
        actions={
          <Link
            href="/vendors"
            data-testid="link-back-vendors"
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-[13px] font-fira text-fe-navy hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Vendors
          </Link>
        }
      />

      {/* Controls bar with identity picker */}
      <div className="bg-white border border-gray-100 p-4 mb-8 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: role.color }} />
          <span className="text-[13px] font-fira text-fe-blue-gray">
            {role.deliverables.length} deliverable{role.deliverables.length === 1 ? '' : 's'} · {role.members.length} member
            {role.members.length === 1 ? '' : 's'}
          </span>
        </div>
        <label className="flex items-center gap-2">
          <span className="text-[13px] font-fira text-fe-blue-gray">Viewing as:</span>
          <select
            value={meId}
            onChange={(e) => setMeId(e.target.value)}
            data-testid="select-identity"
            className="px-3 py-2 text-[13px] font-fira text-fe-navy bg-white border border-gray-200 focus:outline-none focus:border-fe-blue"
          >
            <option value="">— Select who you are —</option>
            {role.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {role.deliverables.length === 0 ? (
        <div className="text-center py-20 text-fe-blue-gray font-fira text-sm">
          No deliverables assigned to this role yet.
        </div>
      ) : (
        <div className="space-y-10">
          {groups.map((g) => (
            <section key={g.key} data-testid={`group-category-${g.name}`}>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: g.color || '#647692' }} />
                <h2 className="font-barlow font-bold text-sm uppercase tracking-wider text-fe-blue-gray">{g.name}</h2>
                <span className="text-[12px] font-fira text-fe-blue-gray">({g.items.length})</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {g.items.map((d) => (
                  <DeliverableCard
                    key={d.id}
                    d={d}
                    meId={meId}
                    team={team}
                    roleMembers={role.members}
                    onPatch={patchDeliverable}
                    onUpload={() => setUploadFor(d)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {uploadFor && (
        <UploadVersionModal
          deliverable={uploadFor}
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

// ── Deliverable card ───────────────────────────────────────────────────────────

function DeliverableCard({
  d,
  meId,
  team,
  roleMembers,
  onPatch,
  onUpload,
}: {
  d: RoleDeliverable
  meId: string
  team: TeamMember[]
  roleMembers: RoleMember[]
  onPatch: (id: string, updates: Record<string, any>) => void
  onUpload: () => void
}) {
  const claimed = !!d.claimed_by_id
  const identityRequired = !meId

  // Assign picker: role members first, then everyone else.
  const roleMemberIds = new Set(roleMembers.map((m) => m.id))
  const otherMembers = team.filter((m) => !roleMemberIds.has(m.id))

  return (
    <div data-testid={`deliverable-card-${d.id}`} className="bg-white border border-gray-100 p-4">
      {/* Title row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-barlow font-bold text-base text-fe-navy leading-tight">{d.deliverable}</h3>
          {d.project_name && (
            <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-fira font-bold bg-fe-blue-gray/15 text-fe-blue-gray uppercase tracking-wide">
              {d.project_name}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-fira font-bold whitespace-nowrap ${STATUS_PILL[d.status]}`}>
            {STATUS_LABELS[d.status]}
          </span>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-fira font-bold whitespace-nowrap ${REVIEW_PILL[d.review_state]}`}>
            {REVIEW_LABELS[d.review_state]}
          </span>
        </div>
      </div>

      {/* Dates */}
      {(d.due_date || d.concepts_due) && (
        <p className="mt-2 text-[12px] font-fira text-fe-blue-gray">
          {d.concepts_due && <>Concepts {fmtDate(d.concepts_due)}</>}
          {d.concepts_due && d.due_date && ' · '}
          {d.due_date && <>Due {fmtDate(d.due_date)}</>}
        </p>
      )}

      {/* Assignee + assign control */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {d.assigned_to_id ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] font-fira text-fe-navy">
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-fira font-bold"
              style={{ backgroundColor: d.assigned_to_color || '#647692' }}
            >
              {d.assigned_to_initials}
            </span>
            {d.assigned_to_name}
          </span>
        ) : (
          <span className="text-[12px] font-fira text-fe-blue-gray italic">Unassigned</span>
        )}
        <select
          value={d.assigned_to_id || ''}
          onChange={(e) => onPatch(d.id, { assigned_to_id: e.target.value || null })}
          data-testid={`button-assign-${d.id}`}
          className="ml-auto px-2 py-1 text-[12px] font-fira text-fe-navy bg-white border border-gray-200 focus:outline-none focus:border-fe-blue"
        >
          <option value="">Assign…</option>
          <optgroup label="This role">
            {roleMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </optgroup>
          {otherMembers.length > 0 && (
            <optgroup label="Others">
              {otherMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* Claim / checkout */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {claimed ? (
          <>
            <span className="text-[12px] font-fira text-fe-blue-gray">
              Checked out by <span className="font-bold text-fe-navy">{d.claimed_by_name}</span>
            </span>
            <button
              onClick={() => onPatch(d.id, { claimed_by_id: null, claimed_at: null })}
              data-testid={`button-release-${d.id}`}
              className="px-2.5 py-1 border border-gray-200 text-[12px] font-fira text-fe-navy hover:bg-gray-50 transition-colors"
            >
              Release
            </button>
          </>
        ) : (
          <button
            onClick={() => onPatch(d.id, { claimed_by_id: meId, claimed_at: new Date().toISOString(), status: 'in_progress' })}
            disabled={identityRequired}
            data-testid={`button-checkout-${d.id}`}
            title={identityRequired ? 'Select who you are to claim' : 'Check out this deliverable'}
            className="px-3 py-1.5 bg-fe-navy text-white text-[12px] font-fira font-bold hover:bg-fe-navy/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Check out
          </button>
        )}
      </div>

      {/* Review actions */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {d.review_state === 'approved' && d.approved_by_name ? (
          <span className="text-[12px] font-fira text-fe-teal font-bold">Approved by {d.approved_by_name}</span>
        ) : (
          <button
            onClick={() =>
              onPatch(d.id, {
                approved_by_id: meId,
                approved_at: new Date().toISOString(),
                review_state: 'approved',
                status: 'approved',
              })
            }
            disabled={identityRequired}
            data-testid={`button-approve-${d.id}`}
            title={identityRequired ? 'Select who you are to approve' : 'Approve this deliverable'}
            className="px-3 py-1.5 bg-fe-teal text-white text-[12px] font-fira font-bold hover:bg-fe-teal/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Approve
          </button>
        )}
        <button
          onClick={() => onPatch(d.id, { review_state: 'changes_requested', approved_by_id: null, approved_at: null })}
          disabled={identityRequired}
          data-testid={`button-request-changes-${d.id}`}
          title={identityRequired ? 'Select who you are to request changes' : 'Request changes'}
          className="px-3 py-1.5 border border-fe-red text-fe-red text-[12px] font-fira font-bold hover:bg-fe-red/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Request changes
        </button>
        {identityRequired && (
          <span className="text-[11px] font-fira text-fe-blue-gray italic">Select who you are to claim/approve</span>
        )}
      </div>

      {/* Assets */}
      <div className="mt-4 border-t border-gray-100 pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-barlow font-bold uppercase tracking-wider text-fe-blue-gray">
            Assets ({d.assets.length})
          </span>
          <button
            onClick={onUpload}
            data-testid={`button-upload-${d.id}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-gray-200 text-[12px] font-fira text-fe-navy hover:bg-gray-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload version
          </button>
        </div>
        {d.assets.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {d.assets.map((a) => (
              <AssetThumb key={a.id} asset={a} />
            ))}
          </div>
        ) : (
          <p className="text-[12px] font-fira text-fe-blue-gray">No assets uploaded yet.</p>
        )}
      </div>
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
      className={`relative block w-32 shrink-0 bg-white border border-gray-100 ${!asset.is_current ? 'opacity-70' : ''}`}
    >
      <div className="absolute top-1 left-1 z-10 flex items-center gap-1">
        {asset.is_current && (
          <span className="px-1.5 py-0.5 rounded-full bg-fe-teal text-white text-[9px] font-fira font-bold">Current</span>
        )}
        {asset.version > 1 && (
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

// ── Upload version modal ────────────────────────────────────────────────────

function UploadVersionModal({
  deliverable,
  onClose,
  onUploaded,
}: {
  deliverable: RoleDeliverable
  onClose: () => void
  onUploaded: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const nextVersion = (deliverable.assets.reduce((max, a) => Math.max(max, a.version || 0), 0) || 0) + 1

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
    fd.append('version', String(nextVersion))
    fd.append('is_current', 'true')
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
        <h2 className="font-barlow font-extrabold text-lg text-fe-navy mb-1">Upload new version</h2>
        <p className="text-[13px] font-fira text-fe-blue-gray mb-4">
          {deliverable.deliverable} · v{nextVersion}
        </p>

        <div className="space-y-4">
          <div>
            <label className={labelClass}>File</label>
            <input
              type="file"
              accept="image/*,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv"
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
              placeholder="Designer / reviewer notes"
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
