'use client'

import { useEffect, useMemo, useState } from 'react'

// ── Types ───────────────────────────────────────────────────────────────────

interface Project {
  id: string
  name: string
}

type DeliverableStatus =
  | 'not_started'
  | 'in_progress'
  | 'in_review'
  | 'approved'
  | 'delivered'

interface Deliverable {
  id: string
  vendor_id: string
  project_id: string | null
  project_name: string | null
  deliverable: string
  recurring: boolean
  date_assigned: string | null
  concepts_due: string | null
  due_date: string | null
  status: DeliverableStatus
  comments: string | null
  external_link: string | null
  sort_order: number
  is_archived: boolean
  archived_at: string | null
}

interface Asset {
  id: string
  vendor_id: string
  deliverable_id: string | null
  project_id: string | null
  file_name: string
  storage_path: string | null
  external_url: string | null
  file_type: string | null
  file_size: number | null
  public_url: string | null
  is_archived: boolean
  archived_at: string | null
  version: number
  is_current: boolean
  notes: string | null
}

interface Vendor {
  id: string
  name: string
  contact_name: string | null
  contact_email: string | null
  external_folder_url: string | null
  color: string
  notes: string | null
  sort_order: number
  deliverables: Deliverable[]
  assets: Asset[]
}

// ── Status config ────────────────────────────────────────────────────────────

const STATUS_ORDER: DeliverableStatus[] = [
  'not_started',
  'in_progress',
  'in_review',
  'approved',
  'delivered',
]

const STATUS_LABELS: Record<DeliverableStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  in_review: 'In Review',
  approved: 'Approved',
  delivered: 'Delivered',
}

// Pill styling per status. Map: not_started=gray, in_progress=fe-blue,
// in_review=fe-gold, approved=fe-teal, delivered=fe-green.
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
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function fmtSize(bytes: number | null): string {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Page ──────────────────────────────────────────────────────────────────────

type View = 'byvendor' | 'all'

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('byvendor')

  // Modals
  const [showAddVendor, setShowAddVendor] = useState(false)
  const [editVendor, setEditVendor] = useState<Vendor | null>(null)
  const [deliverableModal, setDeliverableModal] = useState<{
    vendorId: string
    deliverable: Deliverable | null
  } | null>(null)
  const [assetVendor, setAssetVendor] = useState<Vendor | null>(null)
  const [commentModal, setCommentModal] = useState<Deliverable | null>(null)

  async function load() {
    const [v, p] = await Promise.all([
      fetch('/api/vendors').then((r) => r.json()),
      fetch('/api/projects').then((r) => r.json()),
    ])
    setVendors(Array.isArray(v) ? v : [])
    setProjects(
      Array.isArray(p)
        ? p.map((x: any) => ({ id: x.id, name: x.name })).sort((a: Project, b: Project) => a.name.localeCompare(b.name))
        : []
    )
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  // ── Mutations (optimistic where sensible) ───────────────────────────────

  async function patchDeliverable(id: string, updates: Partial<Deliverable>) {
    setVendors((prev) =>
      prev.map((vn) => ({
        ...vn,
        deliverables: vn.deliverables.map((d) =>
          d.id === id ? { ...d, ...updates } : d
        ),
      }))
    )
    const res = await fetch(`/api/vendors/deliverables/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (res.ok) {
      const fresh = await res.json()
      setVendors((prev) =>
        prev.map((vn) => ({
          ...vn,
          deliverables: vn.deliverables.map((d) => (d.id === id ? fresh : d)),
        }))
      )
    }
  }

  async function deleteDeliverable(id: string) {
    if (!confirm('Delete this deliverable?')) return
    setVendors((prev) =>
      prev.map((vn) => ({
        ...vn,
        deliverables: vn.deliverables.filter((d) => d.id !== id),
      }))
    )
    await fetch(`/api/vendors/deliverables/${id}`, { method: 'DELETE' })
  }

  async function deleteVendor(id: string) {
    if (!confirm('Delete this vendor and all its deliverables and assets?')) return
    setVendors((prev) => prev.filter((vn) => vn.id !== id))
    await fetch(`/api/vendors/${id}`, { method: 'DELETE' })
  }

  async function deleteAsset(vendorId: string, assetId: string) {
    setVendors((prev) =>
      prev.map((vn) =>
        vn.id === vendorId
          ? { ...vn, assets: vn.assets.filter((a) => a.id !== assetId) }
          : vn
      )
    )
    await fetch(`/api/vendors/assets/${assetId}`, { method: 'DELETE' })
  }

  async function patchAsset(vendorId: string, assetId: string, updates: Partial<Asset>) {
    setVendors((prev) =>
      prev.map((vn) =>
        vn.id === vendorId
          ? { ...vn, assets: vn.assets.map((a) => (a.id === assetId ? { ...a, ...updates } : a)) }
          : vn
      )
    )
    await fetch(`/api/vendors/assets/${assetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-fe-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const allDeliverables: (Deliverable & { vendor: Vendor })[] = vendors.flatMap((vn) =>
    vn.deliverables.map((d) => ({ ...d, vendor: vn }))
  )

  return (
    <div className="font-fira">
      <PageHeaderBar
        view={view}
        onToggle={setView}
        onAddVendor={() => setShowAddVendor(true)}
      />

      {view === 'byvendor' ? (
        <ByVendorView
          vendors={vendors}
          projects={projects}
          onPatch={patchDeliverable}
          onDeleteDeliverable={deleteDeliverable}
          onEditDeliverable={(vendorId, d) => setDeliverableModal({ vendorId, deliverable: d })}
          onAddDeliverable={(vendorId) => setDeliverableModal({ vendorId, deliverable: null })}
          onEditVendor={(v) => setEditVendor(v)}
          onDeleteVendor={deleteVendor}
          onAddAsset={(v) => setAssetVendor(v)}
          onDeleteAsset={deleteAsset}
          onPatchAsset={patchAsset}
          onOpenComments={(d) => setCommentModal(d)}
        />
      ) : (
        <AllDeliverablesView
          rows={allDeliverables}
          vendors={vendors}
          projects={projects}
          onPatch={patchDeliverable}
          onDeleteDeliverable={deleteDeliverable}
          onEditDeliverable={(vendorId, d) => setDeliverableModal({ vendorId, deliverable: d })}
          onOpenComments={(d) => setCommentModal(d)}
        />
      )}

      {vendors.length === 0 && (
        <div className="text-center py-16 text-fe-blue-gray font-fira text-sm">
          No vendors yet. Add your first vendor to start tracking deliverables.
        </div>
      )}

      {/* ── Modals rendered at top level of the return ── */}
      {showAddVendor && (
        <VendorModal
          onClose={() => setShowAddVendor(false)}
          onSaved={() => {
            setShowAddVendor(false)
            load()
          }}
        />
      )}

      {editVendor && (
        <VendorModal
          vendor={editVendor}
          onClose={() => setEditVendor(null)}
          onSaved={() => {
            setEditVendor(null)
            load()
          }}
        />
      )}

      {deliverableModal && (
        <DeliverableModal
          vendorId={deliverableModal.vendorId}
          vendors={vendors}
          projects={projects}
          deliverable={deliverableModal.deliverable}
          onClose={() => setDeliverableModal(null)}
          onSaved={() => {
            setDeliverableModal(null)
            load()
          }}
        />
      )}

      {assetVendor && (
        <AssetModal
          vendor={assetVendor}
          projects={projects}
          onClose={() => setAssetVendor(null)}
          onSaved={() => {
            setAssetVendor(null)
            load()
          }}
        />
      )}

      {commentModal && (
        <CommentsModal
          deliverable={commentModal}
          onClose={() => setCommentModal(null)}
          onSave={async (comments) => {
            await patchDeliverable(commentModal.id, { comments })
            setCommentModal(null)
          }}
        />
      )}
    </div>
  )
}

// ── Header bar (title + actions + view toggle) ────────────────────────────────

function PageHeaderBar({
  view,
  onToggle,
  onAddVendor,
}: {
  view: View
  onToggle: (v: View) => void
  onAddVendor: () => void
}) {
  // Recreate the PageHeader band inline so we can pass the toggle + button.
  return (
    <div className="fe-pageband -mx-6 -mt-8 mb-8 px-6 pt-7 pb-6 no-print">
      <p className="fe-eyebrow mb-1">Operations Center</p>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="font-barlow font-extrabold text-2xl text-fe-navy leading-none">
            Vendors
          </h1>
          <p className="mt-2 text-sm font-fira text-fe-blue-gray">
            Track vendor deliverables, delivery dates, and assets
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* View toggle — square segmented buttons */}
          <div className="flex border border-gray-200">
            <button
              onClick={() => onToggle('byvendor')}
              data-testid="toggle-view-byvendor"
              className={`px-3 py-2 text-[13px] font-fira transition-colors ${
                view === 'byvendor'
                  ? 'bg-fe-navy text-white font-bold'
                  : 'bg-white text-fe-anthracite hover:bg-gray-50'
              }`}
            >
              By Vendor
            </button>
            <button
              onClick={() => onToggle('all')}
              data-testid="toggle-view-all"
              className={`px-3 py-2 text-[13px] font-fira transition-colors border-l border-gray-200 ${
                view === 'all'
                  ? 'bg-fe-navy text-white font-bold'
                  : 'bg-white text-fe-anthracite hover:bg-gray-50'
              }`}
            >
              All Deliverables
            </button>
          </div>

          <button
            onClick={onAddVendor}
            data-testid="button-add-vendor"
            className="inline-flex items-center gap-2 px-4 py-2 bg-fe-blue text-white text-sm font-fira font-bold hover:bg-fe-blue/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Vendor
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Status pill (inline editable) ─────────────────────────────────────────────

function StatusPill({
  id,
  status,
  onChange,
}: {
  id: string
  status: DeliverableStatus
  onChange: (s: DeliverableStatus) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        data-testid={`select-status-${id}`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-fira font-bold whitespace-nowrap ${STATUS_PILL[status]}`}
      >
        {STATUS_LABELS[status]}
        <svg className="w-3 h-3 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-gray-200 shadow-lg z-20 py-1">
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                onClick={() => {
                  onChange(s)
                  setOpen(false)
                }}
                className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-gray-50 transition-colors"
              >
                <span className={`w-2 h-2 rounded-full ${STATUS_PILL[s].split(' ')[0]}`} />
                <span className="text-[12px] font-fira text-fe-navy">{STATUS_LABELS[s]}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Project selector (inline editable) ────────────────────────────────────────

function ProjectSelect({
  id,
  value,
  projectName,
  projects,
  onChange,
}: {
  id: string
  value: string | null
  projectName: string | null
  projects: Project[]
  onChange: (projectId: string | null) => void
}) {
  return (
    <select
      value={value || ''}
      data-testid={`select-project-${id}`}
      onChange={(e) => onChange(e.target.value || null)}
      className="max-w-[140px] text-[12px] font-fira text-fe-navy bg-transparent border border-transparent hover:border-gray-200 focus:border-fe-blue focus:outline-none px-1 py-0.5 cursor-pointer"
    >
      <option value="">— None —</option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  )
}

// ── Deliverable row (shared between views) ────────────────────────────────────

function DeliverableRow({
  d,
  projects,
  showVendor,
  vendorColor,
  vendorName,
  archived,
  onPatch,
  onEdit,
  onDelete,
  onArchive,
  onUnarchive,
  onOpenComments,
}: {
  d: Deliverable
  projects: Project[]
  showVendor?: boolean
  vendorColor?: string
  vendorName?: string
  archived?: boolean
  onPatch: (id: string, updates: Partial<Deliverable>) => void
  onEdit: () => void
  onDelete: () => void
  onArchive?: () => void
  onUnarchive?: () => void
  onOpenComments: () => void
}) {
  return (
    <tr data-testid={`row-deliverable-${d.id}`} className={`border-t border-gray-100 hover:bg-fe-offwhite/60 ${archived ? 'text-fe-blue-gray' : ''}`}>
      {showVendor && (
        <td className="px-3 py-2 align-top">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-fira text-fe-navy font-bold">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: vendorColor }} />
            {vendorName}
          </span>
        </td>
      )}
      <td className="px-3 py-2 align-top">
        <span className={`text-[13px] font-fira ${archived ? 'text-fe-blue-gray' : 'text-fe-navy'}`}>{d.deliverable}</span>
        {archived && (
          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-fira font-bold bg-fe-blue-gray/15 text-fe-blue-gray uppercase tracking-wide">
            Archived
          </span>
        )}
      </td>
      <td className="px-3 py-2 align-top">
        {d.recurring ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-fira font-bold bg-fe-blue-gray/15 text-fe-blue-gray uppercase tracking-wide">
            Recurring
          </span>
        ) : (
          <span className="text-[12px] text-gray-300">—</span>
        )}
      </td>
      <td className="px-3 py-2 align-top text-[12px] font-fira text-fe-blue-gray whitespace-nowrap">
        {fmtDate(d.date_assigned)}
      </td>
      <td className="px-3 py-2 align-top text-[12px] font-fira text-fe-blue-gray whitespace-nowrap">
        {fmtDate(d.concepts_due)}
      </td>
      <td className="px-3 py-2 align-top text-[12px] font-fira text-fe-blue-gray whitespace-nowrap">
        {fmtDate(d.due_date)}
      </td>
      <td className="px-3 py-2 align-top">
        <StatusPill id={d.id} status={d.status} onChange={(s) => onPatch(d.id, { status: s })} />
      </td>
      <td className="px-3 py-2 align-top">
        <ProjectSelect
          id={d.id}
          value={d.project_id}
          projectName={d.project_name}
          projects={projects}
          onChange={(pid) => onPatch(d.id, { project_id: pid })}
        />
      </td>
      <td className="px-3 py-2 align-top">
        <div className="flex items-center gap-2">
          {d.external_link && (
            <a
              href={d.external_link}
              target="_blank"
              rel="noopener noreferrer"
              title="Open external link"
              className="text-fe-blue hover:text-fe-navy"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5M10.172 13.828a4 4 0 010-5.656l3-3a4 4 0 015.656 5.656l-1.5 1.5" />
              </svg>
            </a>
          )}
          <button
            onClick={onOpenComments}
            title={d.comments ? 'View / edit comments' : 'Add comments'}
            className={`${d.comments ? 'text-fe-gold' : 'text-gray-300 hover:text-fe-blue-gray'}`}
          >
            <svg className="w-4 h-4" fill={d.comments ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
        </div>
      </td>
      <td className="px-3 py-2 align-top">
        <div className="flex items-center gap-1.5">
          <button
            onClick={onEdit}
            title="Edit deliverable"
            className="p-1 text-fe-blue-gray hover:text-fe-navy"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          {archived ? (
            <button
              onClick={onUnarchive}
              data-testid={`button-unarchive-deliverable-${d.id}`}
              title="Unarchive deliverable"
              className="p-1 text-fe-blue-gray hover:text-fe-teal"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </button>
          ) : (
            <button
              onClick={onArchive}
              data-testid={`button-archive-deliverable-${d.id}`}
              title="Archive deliverable"
              className="p-1 text-fe-blue-gray hover:text-fe-navy"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </button>
          )}
          <button
            onClick={onDelete}
            title="Delete deliverable"
            className="p-1 text-fe-blue-gray hover:text-fe-red"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  )
}

function DeliverableTableHead({ showVendor }: { showVendor?: boolean }) {
  const th = 'px-3 py-2 text-left text-[10px] font-barlow font-bold uppercase tracking-wider text-fe-blue-gray'
  return (
    <thead>
      <tr className="bg-fe-offwhite">
        {showVendor && <th className={th}>Vendor</th>}
        <th className={th}>Deliverable</th>
        <th className={th}>Recurring</th>
        <th className={th}>Assigned</th>
        <th className={th}>Concepts Due</th>
        <th className={th}>Due</th>
        <th className={th}>Status</th>
        <th className={th}>Project</th>
        <th className={th}>Links</th>
        <th className={th}></th>
      </tr>
    </thead>
  )
}

// ── View A: By Vendor ─────────────────────────────────────────────────────────

function ByVendorView({
  vendors,
  projects,
  onPatch,
  onDeleteDeliverable,
  onEditDeliverable,
  onAddDeliverable,
  onEditVendor,
  onDeleteVendor,
  onAddAsset,
  onDeleteAsset,
  onPatchAsset,
  onOpenComments,
}: {
  vendors: Vendor[]
  projects: Project[]
  onPatch: (id: string, updates: Partial<Deliverable>) => void
  onDeleteDeliverable: (id: string) => void
  onEditDeliverable: (vendorId: string, d: Deliverable) => void
  onAddDeliverable: (vendorId: string) => void
  onEditVendor: (v: Vendor) => void
  onDeleteVendor: (id: string) => void
  onAddAsset: (v: Vendor) => void
  onDeleteAsset: (vendorId: string, assetId: string) => void
  onPatchAsset: (vendorId: string, assetId: string, updates: Partial<Asset>) => void
  onOpenComments: (d: Deliverable) => void
}) {
  return (
    <div className="space-y-8">
      {vendors.map((v) => (
        <VendorSection
          key={v.id}
          vendor={v}
          projects={projects}
          onPatch={onPatch}
          onDeleteDeliverable={onDeleteDeliverable}
          onEditDeliverable={onEditDeliverable}
          onAddDeliverable={onAddDeliverable}
          onEditVendor={onEditVendor}
          onDeleteVendor={onDeleteVendor}
          onAddAsset={onAddAsset}
          onDeleteAsset={onDeleteAsset}
          onPatchAsset={onPatchAsset}
          onOpenComments={onOpenComments}
        />
      ))}
    </div>
  )
}

function VendorSection({
  vendor,
  projects,
  onPatch,
  onDeleteDeliverable,
  onEditDeliverable,
  onAddDeliverable,
  onEditVendor,
  onDeleteVendor,
  onAddAsset,
  onDeleteAsset,
  onPatchAsset,
  onOpenComments,
}: {
  vendor: Vendor
  projects: Project[]
  onPatch: (id: string, updates: Partial<Deliverable>) => void
  onDeleteDeliverable: (id: string) => void
  onEditDeliverable: (vendorId: string, d: Deliverable) => void
  onAddDeliverable: (vendorId: string) => void
  onEditVendor: (v: Vendor) => void
  onDeleteVendor: (id: string) => void
  onAddAsset: (v: Vendor) => void
  onDeleteAsset: (vendorId: string, assetId: string) => void
  onPatchAsset: (vendorId: string, assetId: string, updates: Partial<Asset>) => void
  onOpenComments: (d: Deliverable) => void
}) {
  const [assetsOpen, setAssetsOpen] = useState(false)
  const [archivedOpen, setArchivedOpen] = useState(false)

  const activeDeliverables = vendor.deliverables.filter((d) => !d.is_archived)
  const archivedDeliverables = vendor.deliverables.filter((d) => d.is_archived)
  const activeAssets = vendor.assets.filter((a) => !a.is_archived)
  const archivedAssetCount = vendor.assets.filter((a) => a.is_archived).length

  function archiveDeliverable(id: string) {
    onPatch(id, { is_archived: true, archived_at: new Date().toISOString() })
  }
  function unarchiveDeliverable(id: string) {
    onPatch(id, { is_archived: false, archived_at: null })
  }

  const versionsByDeliverable = useMemo(() => {
    const map: Record<string, number> = {}
    for (const a of vendor.assets) {
      if (a.deliverable_id) map[a.deliverable_id] = (map[a.deliverable_id] || 0) + 1
    }
    return map
  }, [vendor.assets])

  return (
    <div className="bg-white border border-gray-100">
      {/* Vendor header */}
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-100 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: vendor.color }} />
          <div className="min-w-0">
            <h2 className="font-barlow font-bold text-lg text-fe-navy leading-tight">{vendor.name}</h2>
            {(vendor.contact_name || vendor.contact_email) && (
              <p className="text-[12px] font-fira text-fe-blue-gray">
                {vendor.contact_name}
                {vendor.contact_name && vendor.contact_email ? ' · ' : ''}
                {vendor.contact_email && (
                  <a href={`mailto:${vendor.contact_email}`} className="hover:text-fe-blue">
                    {vendor.contact_email}
                  </a>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[12px] font-fira text-fe-blue-gray whitespace-nowrap">
            {vendor.deliverables.length} deliverables · {vendor.assets.length} assets
          </span>

          {vendor.external_folder_url && (
            <a
              href={vendor.external_folder_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 text-[12px] font-fira text-fe-navy hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Folder
            </a>
          )}

          <button
            onClick={() => onEditVendor(vendor)}
            title="Edit vendor"
            className="p-1.5 text-fe-blue-gray hover:text-fe-navy border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>

          <button
            onClick={() => onDeleteVendor(vendor.id)}
            title="Delete vendor"
            className="p-1.5 text-fe-blue-gray hover:text-fe-red border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>

          <button
            onClick={() => onAddDeliverable(vendor.id)}
            data-testid={`button-add-deliverable-${vendor.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-fe-blue text-white text-[12px] font-fira font-bold hover:bg-fe-blue/90 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Deliverable
          </button>
        </div>
      </div>

      {/* Deliverables table */}
      {activeDeliverables.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <DeliverableTableHead />
            <tbody>
              {activeDeliverables.map((d) => (
                <DeliverableRow
                  key={d.id}
                  d={d}
                  projects={projects}
                  onPatch={onPatch}
                  onEdit={() => onEditDeliverable(vendor.id, d)}
                  onDelete={() => onDeleteDeliverable(d.id)}
                  onArchive={() => archiveDeliverable(d.id)}
                  onOpenComments={() => onOpenComments(d)}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-5 py-6 text-[13px] font-fira text-fe-blue-gray">
          No deliverables yet.
        </div>
      )}

      {/* Archived deliverables disclosure */}
      {archivedDeliverables.length > 0 && (
        <div className="border-t border-gray-100">
          <button
            onClick={() => setArchivedOpen((o) => !o)}
            data-testid={`disclosure-archived-deliverables-${vendor.id}`}
            className="w-full flex items-center gap-2 px-5 py-3 text-[12px] font-barlow font-bold uppercase tracking-wider text-fe-blue-gray hover:text-fe-navy"
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform ${archivedOpen ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Archived ({archivedDeliverables.length})
          </button>
          {archivedOpen && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <DeliverableTableHead />
                <tbody>
                  {archivedDeliverables.map((d) => (
                    <DeliverableRow
                      key={d.id}
                      d={d}
                      projects={projects}
                      archived
                      onPatch={onPatch}
                      onEdit={() => onEditDeliverable(vendor.id, d)}
                      onDelete={() => onDeleteDeliverable(d.id)}
                      onUnarchive={() => unarchiveDeliverable(d.id)}
                      onOpenComments={() => onOpenComments(d)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Assets subsection */}
      <div className="border-t border-gray-100">
        <div className="flex items-center justify-between px-5 py-3">
          <button
            onClick={() => setAssetsOpen((o) => !o)}
            className="inline-flex items-center gap-2 text-[12px] font-barlow font-bold uppercase tracking-wider text-fe-blue-gray hover:text-fe-navy"
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform ${assetsOpen ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Assets ({activeAssets.length})
            {archivedAssetCount > 0 && (
              <span className="normal-case tracking-normal font-fira font-normal text-fe-blue-gray/80">
                · {archivedAssetCount} archived
              </span>
            )}
          </button>
          <button
            onClick={() => onAddAsset(vendor)}
            data-testid={`button-add-asset-${vendor.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-[12px] font-fira text-fe-navy hover:bg-gray-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload / Add asset
          </button>
        </div>

        {assetsOpen && (
          <div className="px-5 pb-5">
            {activeAssets.length > 0 ? (
              <div className="flex flex-wrap gap-4">
                {activeAssets.map((a) => (
                  <AssetCard
                    key={a.id}
                    asset={a}
                    multipleVersions={(versionsByDeliverable[a.deliverable_id || ''] || 0) > 1}
                    onDelete={() => onDeleteAsset(vendor.id, a.id)}
                    onArchive={() => onPatchAsset(vendor.id, a.id, { is_archived: true, archived_at: new Date().toISOString() })}
                  />
                ))}
              </div>
            ) : (
              <p className="text-[13px] font-fira text-fe-blue-gray">No assets uploaded or linked yet.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function AssetCard({
  asset,
  multipleVersions,
  onDelete,
  onArchive,
}: {
  asset: Asset
  multipleVersions?: boolean
  onDelete: () => void
  onArchive?: () => void
}) {
  const isImage = (asset.file_type || '').startsWith('image/')
  const href = asset.public_url || asset.external_url || undefined
  const showCurrent = asset.is_current && multipleVersions
  return (
    <div data-testid={`card-asset-${asset.id}`} className="relative w-52 shrink-0 bg-white border border-gray-100 group">
      <div className="absolute top-1 right-1 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onArchive && (
          <button
            onClick={onArchive}
            data-testid={`button-archive-asset-${asset.id}`}
            title="Archive asset"
            className="p-1 bg-white/90 text-fe-blue-gray hover:text-fe-navy border border-gray-200"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </button>
        )}
        <button
          onClick={onDelete}
          title="Delete asset"
          className="p-1 bg-white/90 text-fe-blue-gray hover:text-fe-red border border-gray-200"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {(asset.version > 1 || showCurrent) && (
        <div className="absolute top-1 left-1 z-10 flex items-center gap-1">
          {showCurrent && (
            <span className="px-2 py-0.5 rounded-full bg-fe-teal text-white text-[10px] font-fira font-bold">
              Current
            </span>
          )}
          {asset.version > 1 && (
            <span className="px-1.5 py-0.5 bg-fe-navy text-white text-[10px] font-fira font-bold">
              v{asset.version}
            </span>
          )}
        </div>
      )}
      <a href={href} target="_blank" rel="noopener noreferrer" className="block">
        <div className="h-36 bg-fe-offwhite flex items-center justify-center overflow-hidden">
          {isImage && href ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={href} alt={asset.file_name} className="max-w-full max-h-full object-contain" />
          ) : (
            <svg className="w-10 h-10 text-fe-blue-gray/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
        </div>
        <div className="px-2 py-2">
          <p className="text-[12px] font-fira text-fe-navy truncate" title={asset.file_name}>
            {asset.file_name}
          </p>
          {asset.notes && (
            <p className="text-[10px] font-fira text-fe-blue-gray truncate" title={asset.notes}>
              {asset.notes}
            </p>
          )}
          <p className="text-[10px] font-fira text-fe-blue-gray">
            {asset.file_type === 'link' ? 'Link' : fmtSize(asset.file_size)}
          </p>
        </div>
      </a>
    </div>
  )
}

// ── View B: All Deliverables ─────────────────────────────────────────────────

function AllDeliverablesView({
  rows,
  vendors,
  projects,
  onPatch,
  onDeleteDeliverable,
  onEditDeliverable,
  onOpenComments,
}: {
  rows: (Deliverable & { vendor: Vendor })[]
  vendors: Vendor[]
  projects: Project[]
  onPatch: (id: string, updates: Partial<Deliverable>) => void
  onDeleteDeliverable: (id: string) => void
  onEditDeliverable: (vendorId: string, d: Deliverable) => void
  onOpenComments: (d: Deliverable) => void
}) {
  const [vendorFilter, setVendorFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [projectFilter, setProjectFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (!showArchived && r.is_archived) return false
      if (vendorFilter !== 'all' && r.vendor_id !== vendorFilter) return false
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (projectFilter !== 'all') {
        if (projectFilter === 'none' && r.project_id) return false
        if (projectFilter !== 'none' && r.project_id !== projectFilter) return false
      }
      if (q && !r.deliverable.toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, vendorFilter, statusFilter, projectFilter, search, showArchived])

  const selectClass =
    'px-3 py-2 text-[13px] font-fira text-fe-navy bg-white border border-gray-200 focus:outline-none focus:border-fe-blue'

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search deliverables…"
          data-testid="input-search-deliverables"
          className="px-3 py-2 text-[13px] font-fira border border-gray-200 focus:outline-none focus:border-fe-blue w-64"
        />
        <select
          value={vendorFilter}
          onChange={(e) => setVendorFilter(e.target.value)}
          data-testid="filter-vendor"
          className={selectClass}
        >
          <option value="all">All Vendors</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          data-testid="filter-status"
          className={selectClass}
        >
          <option value="all">All Statuses</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className={selectClass}
        >
          <option value="all">All Projects</option>
          <option value="none">Stand-alone (no project)</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            data-testid="toggle-show-archived"
            className="w-4 h-4 accent-fe-blue"
          />
          <span className="text-[13px] font-fira text-fe-navy">Show archived</span>
        </label>
        <span className="text-[12px] font-fira text-fe-blue-gray ml-auto">
          {filtered.length} of {rows.length}
        </span>
      </div>

      {/* Flat table */}
      <div className="bg-white border border-gray-100 overflow-x-auto">
        <table className="w-full border-collapse">
          <DeliverableTableHead showVendor />
          <tbody>
            {filtered.map((r) => (
              <DeliverableRow
                key={r.id}
                d={r}
                projects={projects}
                showVendor
                vendorColor={r.vendor.color}
                vendorName={r.vendor.name}
                archived={r.is_archived}
                onPatch={onPatch}
                onEdit={() => onEditDeliverable(r.vendor_id, r)}
                onDelete={() => onDeleteDeliverable(r.id)}
                onArchive={() => onPatch(r.id, { is_archived: true, archived_at: new Date().toISOString() })}
                onUnarchive={() => onPatch(r.id, { is_archived: false, archived_at: null })}
                onOpenComments={() => onOpenComments(r)}
              />
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-5 py-8 text-center text-[13px] font-fira text-fe-blue-gray">
            No deliverables match the current filters.
          </div>
        )}
      </div>
    </div>
  )
}

// ── Modal shell ───────────────────────────────────────────────────────────────

function ModalShell({
  title,
  onClose,
  children,
  maxWidth = 'max-w-lg',
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  maxWidth?: string
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className={`bg-white border border-gray-100 shadow-xl w-full ${maxWidth} mx-4 p-6 max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-barlow font-bold text-lg text-fe-navy mb-4">{title}</h2>
        {children}
      </div>
    </div>
  )
}

const inputClass =
  'w-full px-3 py-2.5 border border-gray-200 text-sm font-fira focus:outline-none focus:border-fe-blue focus:ring-1 focus:ring-fe-blue'
const labelClass = 'block text-sm font-fira font-bold text-fe-navy mb-1'

// ── Vendor modal (add / edit) ─────────────────────────────────────────────────

const COLOR_SWATCHES = ['#647692', '#0762C8', '#1B365D', '#B29838', '#046A38', '#C8350D', '#437F94']

function VendorModal({
  vendor,
  onClose,
  onSaved,
}: {
  vendor?: Vendor
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(vendor?.name || '')
  const [contactName, setContactName] = useState(vendor?.contact_name || '')
  const [contactEmail, setContactEmail] = useState(vendor?.contact_email || '')
  const [folderUrl, setFolderUrl] = useState(vendor?.external_folder_url || '')
  const [notes, setNotes] = useState(vendor?.notes || '')
  const [color, setColor] = useState(vendor?.color || '#647692')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    const payload = {
      name: name.trim(),
      contact_name: contactName.trim() || null,
      contact_email: contactEmail.trim() || null,
      external_folder_url: folderUrl.trim() || null,
      notes: notes.trim() || null,
      color,
    }
    const res = vendor
      ? await fetch(`/api/vendors/${vendor.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      : await fetch('/api/vendors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
    setSaving(false)
    if (res.ok) onSaved()
  }

  return (
    <ModalShell title={vendor ? 'Edit Vendor' : 'Add Vendor'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Name *</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Contact Name</label>
            <input className={inputClass} value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Contact Email</label>
            <input className={inputClass} value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelClass}>External Folder URL</label>
          <input className={inputClass} value={folderUrl} onChange={(e) => setFolderUrl(e.target.value)} placeholder="https://drive.google.com/…" />
        </div>
        <div>
          <label className={labelClass}>Color</label>
          <div className="flex items-center gap-2">
            {COLOR_SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-fe-navy scale-110' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <div>
          <label className={labelClass}>Notes</label>
          <textarea className={inputClass} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={onClose} className="px-4 py-2.5 bg-gray-100 text-fe-anthracite text-sm font-fira hover:bg-gray-200 transition-colors">
          Cancel
        </button>
        <button
          onClick={save}
          disabled={!name.trim() || saving}
          className="flex-1 px-6 py-2.5 bg-fe-blue text-white text-sm font-fira font-bold hover:bg-fe-blue/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : vendor ? 'Save Changes' : 'Add Vendor'}
        </button>
      </div>
    </ModalShell>
  )
}

// ── Deliverable modal (add / edit) ────────────────────────────────────────────

function DeliverableModal({
  vendorId,
  vendors,
  projects,
  deliverable,
  onClose,
  onSaved,
}: {
  vendorId: string
  vendors: Vendor[]
  projects: Project[]
  deliverable: Deliverable | null
  onClose: () => void
  onSaved: () => void
}) {
  const [vendorSel, setVendorSel] = useState(deliverable?.vendor_id || vendorId)
  const [text, setText] = useState(deliverable?.deliverable || '')
  const [projectId, setProjectId] = useState(deliverable?.project_id || '')
  const [recurring, setRecurring] = useState(deliverable?.recurring || false)
  const [dateAssigned, setDateAssigned] = useState(deliverable?.date_assigned || '')
  const [conceptsDue, setConceptsDue] = useState(deliverable?.concepts_due || '')
  const [dueDate, setDueDate] = useState(deliverable?.due_date || '')
  const [status, setStatus] = useState<DeliverableStatus>(deliverable?.status || 'not_started')
  const [externalLink, setExternalLink] = useState(deliverable?.external_link || '')
  const [comments, setComments] = useState(deliverable?.comments || '')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!text.trim() || !vendorSel) return
    setSaving(true)
    const payload = {
      vendor_id: vendorSel,
      deliverable: text.trim(),
      project_id: projectId || null,
      recurring,
      date_assigned: dateAssigned || null,
      concepts_due: conceptsDue || null,
      due_date: dueDate || null,
      status,
      external_link: externalLink.trim() || null,
      comments: comments.trim() || null,
    }
    const res = deliverable
      ? await fetch(`/api/vendors/deliverables/${deliverable.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      : await fetch('/api/vendors/deliverables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
    setSaving(false)
    if (res.ok) onSaved()
  }

  return (
    <ModalShell title={deliverable ? 'Edit Deliverable' : 'Add Deliverable'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Deliverable *</label>
          <input className={inputClass} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Vendor</label>
            <select className={inputClass} value={vendorSel} onChange={(e) => setVendorSel(e.target.value)}>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Project</label>
            <select className={inputClass} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">— Stand-alone —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Status</label>
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as DeliverableStatus)}>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end pb-2">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} className="w-4 h-4 accent-fe-blue" />
              <span className="text-sm font-fira text-fe-navy">Recurring</span>
            </label>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Date Assigned</label>
            <input type="date" className={inputClass} value={dateAssigned} onChange={(e) => setDateAssigned(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Concepts Due</label>
            <input type="date" className={inputClass} value={conceptsDue} onChange={(e) => setConceptsDue(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Due Date</label>
            <input type="date" className={inputClass} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelClass}>External Link</label>
          <input className={inputClass} value={externalLink} onChange={(e) => setExternalLink(e.target.value)} placeholder="https://…" />
        </div>
        <div>
          <label className={labelClass}>Comments</label>
          <textarea className={inputClass} rows={3} value={comments} onChange={(e) => setComments(e.target.value)} />
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={onClose} className="px-4 py-2.5 bg-gray-100 text-fe-anthracite text-sm font-fira hover:bg-gray-200 transition-colors">
          Cancel
        </button>
        <button
          onClick={save}
          disabled={!text.trim() || !vendorSel || saving}
          className="flex-1 px-6 py-2.5 bg-fe-blue text-white text-sm font-fira font-bold hover:bg-fe-blue/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : deliverable ? 'Save Changes' : 'Add Deliverable'}
        </button>
      </div>
    </ModalShell>
  )
}

// ── Asset modal (upload / link) ───────────────────────────────────────────────

function AssetModal({
  vendor,
  projects,
  onClose,
  onSaved,
}: {
  vendor: Vendor
  projects: Project[]
  onClose: () => void
  onSaved: () => void
}) {
  const [tab, setTab] = useState<'upload' | 'link'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [deliverableId, setDeliverableId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [notes, setNotes] = useState('')
  const [linkName, setLinkName] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function uploadFile() {
    if (!file) return
    setBusy(true)
    setError('')
    const fd = new FormData()
    fd.append('vendor_id', vendor.id)
    if (deliverableId) fd.append('deliverable_id', deliverableId)
    if (projectId) fd.append('project_id', projectId)
    if (notes.trim()) fd.append('notes', notes.trim())
    fd.append('version', '1')
    fd.append('is_current', 'true')
    fd.append('file', file)
    const res = await fetch('/api/vendors/assets', { method: 'POST', body: fd })
    setBusy(false)
    if (res.ok) onSaved()
    else {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Upload failed')
    }
  }

  async function addLink() {
    if (!linkName.trim() || !linkUrl.trim()) return
    setBusy(true)
    setError('')
    const res = await fetch('/api/vendors/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendor_id: vendor.id,
        deliverable_id: deliverableId || null,
        project_id: projectId || null,
        file_name: linkName.trim(),
        external_url: linkUrl.trim(),
        notes: notes.trim() || null,
        version: 1,
        is_current: true,
      }),
    })
    setBusy(false)
    if (res.ok) onSaved()
    else {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Failed to add link')
    }
  }

  return (
    <ModalShell title={`Add Asset — ${vendor.name}`} onClose={onClose}>
      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 mb-4">
        {([
          { key: 'upload' as const, label: 'Upload file' },
          { key: 'link' as const, label: 'Add link' },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-fira ${
              tab === t.key
                ? 'border-b-2 border-fe-blue text-fe-blue font-bold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Deliverable / project / notes (shared) */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className={labelClass}>Link to deliverable (optional)</label>
          <select className={inputClass} value={deliverableId} onChange={(e) => setDeliverableId(e.target.value)}>
            <option value="">— None —</option>
            {vendor.deliverables.filter((d) => !d.is_archived).map((d) => (
              <option key={d.id} value={d.id}>
                {d.deliverable}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Project (optional)</label>
          <select className={inputClass} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">— None —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mb-4">
        <label className={labelClass}>Notes (optional)</label>
        <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Designer / reviewer notes…" />
      </div>

      {tab === 'upload' ? (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>File</label>
            <input
              type="file"
              accept="image/*,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm font-fira file:mr-3 file:px-3 file:py-2 file:border-0 file:bg-fe-navy file:text-white file:text-sm file:font-fira"
            />
            {file && (
              <p className="text-[12px] font-fira text-fe-blue-gray mt-1">
                {file.name} · {fmtSize(file.size)}
              </p>
            )}
          </div>
          {error && <p className="text-[12px] font-fira text-fe-red">{error}</p>}
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2.5 bg-gray-100 text-fe-anthracite text-sm font-fira hover:bg-gray-200 transition-colors">
              Cancel
            </button>
            <button
              onClick={uploadFile}
              disabled={!file || busy}
              className="flex-1 px-6 py-2.5 bg-fe-blue text-white text-sm font-fira font-bold hover:bg-fe-blue/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Display name *</label>
            <input className={inputClass} value={linkName} onChange={(e) => setLinkName(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>URL *</label>
            <input className={inputClass} value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" />
          </div>
          {error && <p className="text-[12px] font-fira text-fe-red">{error}</p>}
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2.5 bg-gray-100 text-fe-anthracite text-sm font-fira hover:bg-gray-200 transition-colors">
              Cancel
            </button>
            <button
              onClick={addLink}
              disabled={!linkName.trim() || !linkUrl.trim() || busy}
              className="flex-1 px-6 py-2.5 bg-fe-blue text-white text-sm font-fira font-bold hover:bg-fe-blue/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? 'Adding…' : 'Add Link'}
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  )
}

// ── Comments modal ────────────────────────────────────────────────────────────

function CommentsModal({
  deliverable,
  onClose,
  onSave,
}: {
  deliverable: Deliverable
  onClose: () => void
  onSave: (comments: string) => void
}) {
  const [comments, setComments] = useState(deliverable.comments || '')
  return (
    <ModalShell title="Comments" onClose={onClose}>
      <p className="text-[13px] font-fira text-fe-blue-gray mb-3">{deliverable.deliverable}</p>
      <textarea
        className={inputClass}
        rows={6}
        value={comments}
        onChange={(e) => setComments(e.target.value)}
        placeholder="Notes, back-and-forth, feedback…"
        autoFocus
      />
      <div className="flex gap-3 mt-6">
        <button onClick={onClose} className="px-4 py-2.5 bg-gray-100 text-fe-anthracite text-sm font-fira hover:bg-gray-200 transition-colors">
          Cancel
        </button>
        <button
          onClick={() => onSave(comments.trim())}
          className="flex-1 px-6 py-2.5 bg-fe-blue text-white text-sm font-fira font-bold hover:bg-fe-blue/90 transition-colors"
        >
          Save
        </button>
      </div>
    </ModalShell>
  )
}
