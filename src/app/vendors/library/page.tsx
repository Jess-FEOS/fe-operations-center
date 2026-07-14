'use client'

import { useEffect, useMemo, useState } from 'react'
import PageHeader from '@/components/PageHeader'

// ── Types ───────────────────────────────────────────────────────────────────

interface Project {
  id: string
  name: string
}

interface LibraryAsset {
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
  created_at: string
  vendor_name: string | null
  vendor_color: string | null
  deliverable_name: string | null
  project_name: string | null
  project_id_effective: string | null
}

const NO_PROJECT = '__none__'
const UNASSIGNED = '__unassigned__'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtSize(bytes: number | null): string {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AssetLibraryPage() {
  const [assets, setAssets] = useState<LibraryAsset[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('all')
  const [vendorFilter, setVendorFilter] = useState('all')
  const [showArchived, setShowArchived] = useState(false)

  async function load() {
    const [a, p] = await Promise.all([
      fetch('/api/vendors/library?include_archived=true').then((r) => r.json()),
      fetch('/api/projects').then((r) => r.json()),
    ])
    setAssets(Array.isArray(a) ? a : [])
    setProjects(
      Array.isArray(p)
        ? p.map((x: any) => ({ id: x.id, name: x.name })).sort((x: Project, y: Project) => x.name.localeCompare(y.name))
        : []
    )
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function unarchive(id: string) {
    setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, is_archived: false, archived_at: null } : a)))
    await fetch(`/api/vendors/assets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_archived: false, archived_at: null }),
    })
  }

  // Vendors present in the data (for the vendor filter dropdown).
  const vendorOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of assets) {
      if (a.vendor_id && a.vendor_name) map.set(a.vendor_id, a.vendor_name)
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((x, y) => x.name.localeCompare(y.name))
  }, [assets])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return assets.filter((a) => {
      if (!showArchived && a.is_archived) return false
      if (vendorFilter !== 'all' && a.vendor_id !== vendorFilter) return false
      if (projectFilter !== 'all') {
        if (projectFilter === NO_PROJECT && a.project_id_effective) return false
        if (projectFilter !== NO_PROJECT && a.project_id_effective !== projectFilter) return false
      }
      if (q) {
        const hay = [a.file_name, a.deliverable_name, a.project_name, a.vendor_name, a.notes]
        if (!hay.some((v) => (v || '').toString().toLowerCase().includes(q))) return false
      }
      return true
    })
  }, [assets, search, projectFilter, vendorFilter, showArchived])

  // Group: project → deliverable → assets.
  const groups = useMemo(() => {
    const byProject = new Map<string, { key: string; name: string; assets: LibraryAsset[] }>()
    for (const a of filtered) {
      const key = a.project_id_effective || NO_PROJECT
      const name = a.project_name || 'No Project'
      if (!byProject.has(key)) byProject.set(key, { key, name, assets: [] })
      byProject.get(key)!.assets.push(a)
    }

    const projectGroups = Array.from(byProject.values()).sort((x, y) => {
      if (x.key === NO_PROJECT) return 1
      if (y.key === NO_PROJECT) return -1
      return x.name.localeCompare(y.name)
    })

    return projectGroups.map((pg) => {
      const byDeliverable = new Map<string, { key: string; name: string; assets: LibraryAsset[] }>()
      for (const a of pg.assets) {
        const key = a.deliverable_id || UNASSIGNED
        const name = a.deliverable_name || 'Unassigned'
        if (!byDeliverable.has(key)) byDeliverable.set(key, { key, name, assets: [] })
        byDeliverable.get(key)!.assets.push(a)
      }
      const deliverableGroups = Array.from(byDeliverable.values())
        .sort((x, y) => {
          if (x.key === UNASSIGNED) return 1
          if (y.key === UNASSIGNED) return -1
          return x.name.localeCompare(y.name)
        })
        .map((dg) => ({
          ...dg,
          assets: [...dg.assets].sort((x, y) => {
            if (x.is_current !== y.is_current) return x.is_current ? -1 : 1
            return (y.version || 0) - (x.version || 0)
          }),
        }))
      return { ...pg, deliverableGroups }
    })
  }, [filtered])

  const selectClass =
    'px-3 py-2 text-[13px] font-fira text-fe-navy bg-white border border-gray-200 focus:outline-none focus:border-fe-blue'

  return (
    <div className="font-fira">
      <PageHeader
        eyebrow="OPERATIONS CENTER"
        title="Asset Library"
        subtitle="Every deliverable and asset, organized by project. Find the current version anytime."
      />

      {/* Controls */}
      <div className="bg-white border border-gray-100 p-4 mb-8">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center flex-1 min-w-[16rem] border border-gray-200 focus-within:border-fe-blue">
            <svg className="w-4 h-4 text-fe-blue-gray ml-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assets, deliverables, projects…"
              data-testid="input-search-library"
              className="flex-1 bg-transparent text-[14px] font-fira text-fe-navy px-3 py-2.5 focus:outline-none"
            />
          </div>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            data-testid="filter-project"
            className={selectClass}
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value={NO_PROJECT}>No project</option>
          </select>
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            data-testid="filter-vendor"
            className={selectClass}
          >
            <option value="all">All Vendors</option>
            {vendorOptions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
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
        </div>
        <p className="mt-3 text-[12px] font-fira text-fe-blue-gray">
          Showing {filtered.length} asset{filtered.length === 1 ? '' : 's'}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-fe-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-20 text-fe-blue-gray font-fira text-sm">
          No assets match your search.
        </div>
      ) : (
        <div className="space-y-12">
          {groups.map((pg) => (
            <section key={pg.key} data-testid={`library-project-${pg.key}`}>
              <div className="flex items-baseline gap-3 border-b-2 border-fe-navy pb-2 mb-5">
                <h2 className="font-barlow font-extrabold text-xl text-fe-navy">{pg.name}</h2>
                <span className="text-[12px] font-fira text-fe-blue-gray">
                  {pg.assets.length} asset{pg.assets.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="space-y-8">
                {pg.deliverableGroups.map((dg) => (
                  <div key={dg.key}>
                    <h3 className="font-barlow font-bold text-sm uppercase tracking-wider text-fe-blue-gray mb-3">
                      {dg.name}
                    </h3>
                    <div className="flex flex-wrap gap-4">
                      {dg.assets.map((a) => (
                        <LibraryCard key={a.id} asset={a} onUnarchive={() => unarchive(a.id)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Card ────────────────────────────────────────────────────────────────────

function LibraryCard({ asset, onUnarchive }: { asset: LibraryAsset; onUnarchive: () => void }) {
  const isImage = (asset.file_type || '').startsWith('image/')
  const href = asset.public_url || asset.external_url || undefined
  const muted = asset.is_archived || !asset.is_current

  return (
    <div
      data-testid={`library-card-${asset.id}`}
      className={`relative w-52 shrink-0 bg-white border border-gray-100 group ${muted ? 'opacity-70' : ''}`}
    >
      {/* Tags */}
      <div className="absolute top-1 left-1 z-10 flex items-center gap-1">
        {asset.is_current && (
          <span className="px-2 py-0.5 rounded-full bg-fe-teal text-white text-[10px] font-fira font-bold">
            Current
          </span>
        )}
        {asset.version > 1 && (
          <span className="px-1.5 py-0.5 bg-fe-navy text-white text-[10px] font-fira font-bold">
            v{asset.version}
          </span>
        )}
        {asset.is_archived && (
          <span className="px-2 py-0.5 rounded-full bg-fe-blue-gray/20 text-fe-blue-gray text-[10px] font-fira font-bold uppercase tracking-wide">
            Archived
          </span>
        )}
      </div>

      {asset.is_archived && (
        <button
          onClick={onUnarchive}
          data-testid={`button-unarchive-${asset.id}`}
          title="Unarchive asset"
          className="absolute top-1 right-1 z-10 p-1 bg-white/90 text-fe-blue-gray hover:text-fe-teal opacity-0 group-hover:opacity-100 transition-opacity border border-gray-200"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
        </button>
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
            <p className="text-[10px] font-fira text-fe-blue-gray truncate mt-0.5" title={asset.notes}>
              {asset.notes}
            </p>
          )}
          <div className="flex items-center justify-between gap-2 mt-1">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-fira text-fe-blue-gray truncate">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: asset.vendor_color || '#647692' }} />
              {asset.vendor_name || '—'}
            </span>
            <span className="text-[10px] font-fira text-fe-blue-gray shrink-0">
              {asset.file_type === 'link' ? 'Link' : fmtSize(asset.file_size)}
            </span>
          </div>
        </div>
      </a>
    </div>
  )
}
