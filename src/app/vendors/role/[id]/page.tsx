'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import PageHeader from '@/components/PageHeader'

// ── Types ───────────────────────────────────────────────────────────────────

type DeliverableStatus = 'not_started' | 'in_progress' | 'in_review' | 'approved' | 'delivered'
type ReviewState = 'pending' | 'ready' | 'approved' | 'changes_requested'

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
  date_assigned: string | null
  recurring: boolean
  external_link: string | null
  comments: string | null
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
  ready_by_id: string | null
  ready_by_name: string | null
  ready_at: string | null
  changes_requested_by_id: string | null
  changes_requested_by_name: string | null
  changes_requested_at: string | null
  assets: DeliverableAsset[]
}

interface ActivityEntry {
  id: string
  action: string
  actor_name: string | null
  detail: string | null
  created_at: string
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
  pending: 'Not Submitted',
  ready: 'Ready for Review',
  approved: 'Approved',
  changes_requested: 'Changes Requested',
}

const REVIEW_PILL: Record<ReviewState, string> = {
  pending: 'bg-gray-100 text-gray-600',
  ready: 'bg-fe-blue text-white',
  approved: 'bg-fe-teal text-white',
  changes_requested: 'bg-fe-red text-white',
}

function fmtDateTime(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const ACTION_LABELS: Record<string, string> = {
  ready: 'Marked ready for review',
  approved: 'Approved',
  changes_requested: 'Requested changes',
  completed: 'Completed',
  assigned: 'Assigned',
  version_uploaded: 'Uploaded a version',
  edited: 'Edited details',
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
  const [editFor, setEditFor] = useState<RoleDeliverable | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

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

  function toggleCollapse(key: string) {
    setCollapsed((c) => ({ ...c, [key]: !c[key] }))
  }

  function collapseAll() {
    const all: Record<string, boolean> = {}
    for (const g of groups) all[g.key] = true
    setCollapsed(all)
  }

  function expandAll() {
    setCollapsed({})
  }

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
      <div className="bg-white border border-gray-100 p-4 mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: role.color }} />
            <span className="text-[13px] font-fira text-fe-blue-gray">
              {role.deliverables.length} deliverable{role.deliverables.length === 1 ? '' : 's'} · {role.members.length} member
              {role.members.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[12px] font-fira">
            <button
              onClick={collapseAll}
              data-testid="button-collapse-all"
              className="px-2.5 py-1 border border-gray-200 text-fe-navy hover:bg-gray-50 transition-colors"
            >
              Collapse all
            </button>
            <button
              onClick={expandAll}
              data-testid="button-expand-all"
              className="px-2.5 py-1 border border-gray-200 text-fe-navy hover:bg-gray-50 transition-colors"
            >
              Expand all
            </button>
          </div>
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
            {team.map((m) => (
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
        <div className="space-y-5">
          {groups.map((g) => {
            const isCollapsed = !!collapsed[g.key]
            const doneCount = g.items.filter((d) => d.review_state === 'approved').length
            return (
              <section
                key={g.key}
                data-testid={`group-category-${g.name}`}
                className="bg-white border border-gray-100"
              >
                {/* Category header — click to collapse/expand */}
                <button
                  onClick={() => toggleCollapse(g.key)}
                  data-testid={`toggle-category-${g.key}`}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-gray-50/60 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <svg
                      className={`w-4 h-4 text-fe-blue-gray transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: g.color || '#647692' }} />
                    <h2 className="font-barlow font-bold text-base text-fe-navy">{g.name}</h2>
                  </div>
                  <span className="text-[12px] font-fira text-fe-blue-gray">
                    {doneCount}/{g.items.length} approved
                  </span>
                </button>

                {/* Deliverable table */}
                {!isCollapsed && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50/60 border-b border-gray-100">
                          <th className="px-5 py-2.5 text-[10px] font-barlow font-bold uppercase tracking-wider text-fe-blue-gray">
                            Deliverable
                          </th>
                          <th className="px-3 py-2.5 text-[10px] font-barlow font-bold uppercase tracking-wider text-fe-blue-gray">
                            Assigned
                          </th>
                          <th className="px-3 py-2.5 text-[10px] font-barlow font-bold uppercase tracking-wider text-fe-blue-gray">
                            Concepts
                          </th>
                          <th className="px-3 py-2.5 text-[10px] font-barlow font-bold uppercase tracking-wider text-fe-blue-gray">
                            Due
                          </th>
                          <th className="px-3 py-2.5 text-[10px] font-barlow font-bold uppercase tracking-wider text-fe-blue-gray">
                            Status
                          </th>
                          <th className="px-3 py-2.5 text-[10px] font-barlow font-bold uppercase tracking-wider text-fe-blue-gray">
                            Review
                          </th>
                          <th className="px-3 py-2.5 text-[10px] font-barlow font-bold uppercase tracking-wider text-fe-blue-gray text-right">
                            Assets
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.items.map((d) => (
                          <DeliverableRow
                            key={d.id}
                            d={d}
                            meId={meId}
                            meName={team.find((m) => m.id === meId)?.name || null}
                            team={team}
                            roleMembers={role.members}
                            expanded={expandedRow === d.id}
                            onToggle={() => setExpandedRow(expandedRow === d.id ? null : d.id)}
                            onPatch={patchDeliverable}
                            onUpload={() => setUploadFor(d)}
                            onEdit={() => setEditFor(d)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )
          })}
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

      {editFor && (
        <EditDeliverableModal
          deliverable={editFor}
          onClose={() => setEditFor(null)}
          onSaved={() => {
            setEditFor(null)
            load()
          }}
        />
      )}
    </div>
  )
}

// ── Deliverable row (table) ─────────────────────────────────────────────────

function DeliverableRow({
  d,
  meId,
  meName,
  team,
  roleMembers,
  expanded,
  onToggle,
  onPatch,
  onUpload,
  onEdit,
}: {
  d: RoleDeliverable
  meId: string
  meName: string | null
  team: TeamMember[]
  roleMembers: RoleMember[]
  expanded: boolean
  onToggle: () => void
  onPatch: (id: string, updates: Record<string, any>) => void
  onUpload: () => void
  onEdit: () => void
}) {
  const identityRequired = !meId
  const [showActivity, setShowActivity] = useState(false)
  const [activity, setActivity] = useState<ActivityEntry[] | null>(null)
  const [loadingActivity, setLoadingActivity] = useState(false)

  async function loadActivity() {
    setLoadingActivity(true)
    const res = await fetch(`/api/vendors/deliverables/${d.id}/activity`).then((r) => r.json()).catch(() => [])
    setActivity(Array.isArray(res) ? res : [])
    setLoadingActivity(false)
  }

  function toggleActivity() {
    const next = !showActivity
    setShowActivity(next)
    if (next && activity === null) loadActivity()
  }

  // Build the high-level "last updated per status" line from stored timestamps.
  const statusLine: { label: string; who: string | null; at: string | null }[] = []
  if (d.ready_at) statusLine.push({ label: 'Ready', who: d.ready_by_name, at: d.ready_at })
  if (d.changes_requested_at)
    statusLine.push({ label: 'Changes requested', who: d.changes_requested_by_name, at: d.changes_requested_at })
  if (d.approved_at) statusLine.push({ label: 'Approved', who: d.approved_by_name, at: d.approved_at })

  // Assign picker: role members first, then everyone else.
  const roleMemberIds = new Set(roleMembers.map((m) => m.id))
  const otherMembers = team.filter((m) => !roleMemberIds.has(m.id))

  return (
    <>
      <tr
        data-testid={`deliverable-row-${d.id}`}
        onClick={onToggle}
        className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50/40 cursor-pointer align-middle"
      >
        <td className="px-5 py-3">
          <div className="flex items-center gap-2">
            <svg
              className={`w-3.5 h-3.5 text-fe-blue-gray shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="font-fira text-[13px] text-fe-navy">{d.deliverable}</span>
            {d.project_name && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-fira font-bold bg-fe-blue-gray/15 text-fe-blue-gray uppercase tracking-wide">
                {d.project_name}
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-3">
          {d.assigned_to_id ? (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-fira text-fe-navy">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-fira font-bold"
                style={{ backgroundColor: d.assigned_to_color || '#647692' }}
              >
                {d.assigned_to_initials}
              </span>
              <span className="hidden sm:inline">{d.assigned_to_name}</span>
            </span>
          ) : (
            <span className="text-[12px] font-fira text-fe-blue-gray italic">—</span>
          )}
        </td>
        <td className="px-3 py-3 text-[12px] font-fira text-fe-blue-gray whitespace-nowrap">
          {fmtDate(d.concepts_due)}
        </td>
        <td className="px-3 py-3 text-[12px] font-fira text-fe-blue-gray whitespace-nowrap">{fmtDate(d.due_date)}</td>
        <td className="px-3 py-3">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-fira font-bold whitespace-nowrap ${STATUS_PILL[d.status]}`}
          >
            {STATUS_LABELS[d.status]}
          </span>
        </td>
        <td className="px-3 py-3">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-fira font-bold whitespace-nowrap ${REVIEW_PILL[d.review_state]}`}
          >
            {REVIEW_LABELS[d.review_state]}
          </span>
        </td>
        <td className="px-5 py-3 text-right text-[12px] font-fira text-fe-blue-gray whitespace-nowrap">
          {d.assets.length > 0 ? `${d.assets.length}` : '—'}
        </td>
      </tr>

      {/* Expanded detail row — actions + assets */}
      {expanded && (
        <tr className="border-b border-gray-100 bg-fe-offwhite/40" data-testid={`deliverable-detail-${d.id}`}>
          <td colSpan={7} className="px-5 py-4">
            <div className="flex flex-col gap-4">
              {/* Action controls */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Edit deliverable */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit()
                  }}
                  data-testid={`button-edit-${d.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-[12px] font-fira text-fe-navy hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>

                {/* Assign */}
                <select
                  value={d.assigned_to_id || ''}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const val = e.target.value || null
                    const who = val ? team.find((m) => m.id === val)?.name || null : null
                    onPatch(d.id, {
                      assigned_to_id: val,
                      activity: val
                        ? { action: 'assigned', actor_id: meId, actor_name: meName, detail: `Assigned to ${who}` }
                        : undefined,
                    })
                  }}
                  data-testid={`button-assign-${d.id}`}
                  className="px-2 py-1.5 text-[12px] font-fira text-fe-navy bg-white border border-gray-200 focus:outline-none focus:border-fe-blue"
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

                {/* Ready — designer signals the document is ready for review */}
                {d.review_state === 'ready' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-fe-blue/10 text-fe-blue text-[12px] font-fira font-bold">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Ready for review
                  </span>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onPatch(d.id, {
                        review_state: 'ready',
                        status: 'in_review',
                        ready_by_id: meId,
                        ready_at: new Date().toISOString(),
                        activity: { action: 'ready', actor_id: meId, actor_name: meName },
                      })
                    }}
                    disabled={identityRequired}
                    data-testid={`button-ready-${d.id}`}
                    title={identityRequired ? 'Select who you are first' : 'Mark ready for review'}
                    className="px-3 py-1.5 bg-fe-blue text-white text-[12px] font-fira font-bold hover:bg-fe-blue/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Mark ready
                  </button>
                )}

                {/* Request changes — sends it back */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onPatch(d.id, {
                      review_state: 'changes_requested',
                      status: 'in_progress',
                      changes_requested_by_id: meId,
                      changes_requested_at: new Date().toISOString(),
                      approved_by_id: null,
                      approved_at: null,
                      activity: { action: 'changes_requested', actor_id: meId, actor_name: meName },
                    })
                  }}
                  disabled={identityRequired}
                  data-testid={`button-request-changes-${d.id}`}
                  title={identityRequired ? 'Select who you are first' : 'Request changes'}
                  className="px-3 py-1.5 border border-fe-red text-fe-red text-[12px] font-fira font-bold hover:bg-fe-red/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Request changes
                </button>

                {/* Approve — completes + archives (moves out of sight) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onPatch(d.id, {
                      review_state: 'approved',
                      status: 'delivered',
                      approved_by_id: meId,
                      approved_at: new Date().toISOString(),
                      is_archived: true,
                      archived_at: new Date().toISOString(),
                      activity: { action: 'approved', actor_id: meId, actor_name: meName, detail: 'Approved → completed & archived' },
                    })
                  }}
                  disabled={identityRequired}
                  data-testid={`button-approve-${d.id}`}
                  title={identityRequired ? 'Select who you are first' : 'Approve — marks complete and archives'}
                  className="px-3 py-1.5 bg-fe-teal text-white text-[12px] font-fira font-bold hover:bg-fe-teal/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Approve &amp; complete
                </button>

                {identityRequired && (
                  <span className="text-[11px] font-fira text-fe-blue-gray italic">Select who you are first</span>
                )}
              </div>

              {/* High-level status timeline (last update per status) + hidden activity */}
              {(statusLine.length > 0 || true) && (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-x-4 gap-y-1 flex-wrap">
                    {statusLine.length === 0 ? (
                      <span className="text-[11px] font-fira text-fe-blue-gray italic">No status updates yet</span>
                    ) : (
                      statusLine.map((s, i) => (
                        <span key={i} className="text-[11px] font-fira text-fe-blue-gray">
                          <span className="font-bold text-fe-navy">{s.label}</span>
                          {s.who ? ` · ${s.who}` : ''} · {fmtDateTime(s.at)}
                        </span>
                      ))
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleActivity()
                    }}
                    data-testid={`button-activity-${d.id}`}
                    className="text-[11px] font-fira text-fe-blue hover:underline"
                  >
                    {showActivity ? 'Hide activity' : 'View activity'}
                  </button>
                </div>
              )}

              {/* Hidden activity log drawer */}
              {showActivity && (
                <div className="border border-gray-100 bg-white p-3" data-testid={`activity-log-${d.id}`}>
                  {loadingActivity ? (
                    <p className="text-[12px] font-fira text-fe-blue-gray">Loading activity…</p>
                  ) : activity && activity.length > 0 ? (
                    <ul className="space-y-1.5">
                      {activity.map((a) => (
                        <li key={a.id} className="flex items-baseline gap-2 text-[12px] font-fira">
                          <span className="w-1.5 h-1.5 rounded-full bg-fe-blue-gray shrink-0 translate-y-1" />
                          <span className="text-fe-navy font-bold">{ACTION_LABELS[a.action] || a.action}</span>
                          {a.actor_name && <span className="text-fe-blue-gray">by {a.actor_name}</span>}
                          {a.detail && <span className="text-fe-blue-gray">— {a.detail}</span>}
                          <span className="text-fe-blue-gray ml-auto">{fmtDateTime(a.created_at)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[12px] font-fira text-fe-blue-gray">No activity recorded yet.</p>
                  )}
                </div>
              )}

              {/* Assets */}
              <div className="border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-barlow font-bold uppercase tracking-wider text-fe-blue-gray">
                    Assets ({d.assets.length})
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onUpload()
                    }}
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
          </td>
        </tr>
      )}
    </>
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
      onClick={(e) => e.stopPropagation()}
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

// ── Edit deliverable modal ──────────────────────────────────────────────────

function EditDeliverableModal({
  deliverable,
  onClose,
  onSaved,
}: {
  deliverable: RoleDeliverable
  onClose: () => void
  onSaved: () => void
}) {
  const [text, setText] = useState(deliverable.deliverable || '')
  const [status, setStatus] = useState<DeliverableStatus>(deliverable.status || 'not_started')
  const [recurring, setRecurring] = useState(!!deliverable.recurring)
  const [dateAssigned, setDateAssigned] = useState(deliverable.date_assigned || '')
  const [conceptsDue, setConceptsDue] = useState(deliverable.concepts_due || '')
  const [dueDate, setDueDate] = useState(deliverable.due_date || '')
  const [externalLink, setExternalLink] = useState(deliverable.external_link || '')
  const [comments, setComments] = useState(deliverable.comments || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const inputClass =
    'w-full px-3 py-2.5 border border-gray-200 text-sm font-fira text-fe-navy focus:outline-none focus:border-fe-blue'
  const labelClass = 'block text-[11px] font-barlow font-bold uppercase tracking-wider text-fe-blue-gray mb-1'

  async function save() {
    if (!text.trim()) return
    setBusy(true)
    setError('')
    const res = await fetch(`/api/vendors/deliverables/${deliverable.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deliverable: text.trim(),
        status,
        recurring,
        date_assigned: dateAssigned || null,
        concepts_due: conceptsDue || null,
        due_date: dueDate || null,
        external_link: externalLink.trim() || null,
        comments: comments.trim() || null,
      }),
    })
    setBusy(false)
    if (res.ok) onSaved()
    else {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Save failed')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white border border-gray-100 shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-barlow font-extrabold text-lg text-fe-navy mb-1">Edit deliverable</h2>
        <p className="text-[13px] font-fira text-fe-blue-gray mb-4">{deliverable.vendor_name}</p>

        <div className="space-y-4">
          <div>
            <label className={labelClass}>Deliverable name</label>
            <input
              className={inputClass}
              value={text}
              onChange={(e) => setText(e.target.value)}
              data-testid="input-edit-name"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Status</label>
              <select
                className={inputClass}
                value={status}
                onChange={(e) => setStatus(e.target.value as DeliverableStatus)}
                data-testid="select-edit-status"
              >
                {(Object.keys(STATUS_LABELS) as DeliverableStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={recurring}
                  onChange={(e) => setRecurring(e.target.checked)}
                  data-testid="checkbox-edit-recurring"
                  className="w-4 h-4 accent-fe-blue"
                />
                <span className="text-sm font-fira text-fe-navy">Recurring</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Date Assigned</label>
              <input
                type="date"
                className={inputClass}
                value={dateAssigned}
                onChange={(e) => setDateAssigned(e.target.value)}
                data-testid="input-edit-date-assigned"
              />
            </div>
            <div>
              <label className={labelClass}>Concepts Due</label>
              <input
                type="date"
                className={inputClass}
                value={conceptsDue}
                onChange={(e) => setConceptsDue(e.target.value)}
                data-testid="input-edit-concepts-due"
              />
            </div>
            <div>
              <label className={labelClass}>Due Date</label>
              <input
                type="date"
                className={inputClass}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                data-testid="input-edit-due-date"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>External Link</label>
            <input
              className={inputClass}
              value={externalLink}
              onChange={(e) => setExternalLink(e.target.value)}
              data-testid="input-edit-link"
              placeholder="https://…"
            />
          </div>

          <div>
            <label className={labelClass}>Comments</label>
            <textarea
              className={inputClass}
              rows={3}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              data-testid="input-edit-comments"
            />
          </div>

          {error && <p className="text-[12px] font-fira text-fe-red">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            data-testid="button-edit-cancel"
            className="px-4 py-2 border border-gray-200 text-[13px] font-fira text-fe-navy hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!text.trim() || busy}
            data-testid="button-edit-save"
            className="px-4 py-2 bg-fe-blue text-white text-[13px] font-fira font-bold hover:bg-fe-blue/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
