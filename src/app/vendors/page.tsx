'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

// ── Types ───────────────────────────────────────────────────────────────────

interface RoleMember {
  id: string
  name: string
  initials: string
  color: string
  role: string
}

interface VendorRole {
  id: string
  name: string
  color: string
  description: string | null
  sort_order: number
  members: RoleMember[]
  deliverable_count: number
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VendorsPage() {
  const [roles, setRoles] = useState<VendorRole[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/vendor-roles')
      .then((r) => r.json())
      .then((data) => {
        setRoles(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="font-fira">
      <PageHeader
        eyebrow="OPERATIONS CENTER"
        title="Vendors"
        subtitle="Choose your workspace. Each role sees the deliverables assigned to them."
        actions={
          <Link
            href="/vendors/categories"
            data-testid="link-manage-categories"
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-[13px] font-fira text-fe-navy hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Manage vendor categories
          </Link>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-fe-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : roles.length === 0 ? (
        <div className="text-center py-20 text-fe-blue-gray font-fira text-sm">
          No roles yet. Add a role to create a workspace.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roles.map((role) => (
            <RoleCard key={role.id} role={role} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Role card ─────────────────────────────────────────────────────────────────

function RoleCard({ role }: { role: VendorRole }) {
  return (
    <Link
      href={`/vendors/role/${role.id}`}
      data-testid={`role-card-${role.id}`}
      className="group flex bg-white border border-gray-100 hover:shadow-md transition-all"
      style={{ borderLeftWidth: 6, borderLeftColor: role.color }}
    >
      <div className="flex-1 min-w-0 p-5">
        <h2 className="font-barlow font-extrabold text-xl text-fe-navy leading-tight">{role.name}</h2>

        {role.description && (
          <p className="mt-1 text-[13px] font-fira text-fe-blue-gray line-clamp-2">{role.description}</p>
        )}

        {/* Member avatars */}
        <div className="mt-4 flex items-center">
          {role.members.length > 0 ? (
            <div className="flex -space-x-2">
              {role.members.map((m) => (
                <span
                  key={m.id}
                  title={m.name}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-fira font-bold border-2 border-white"
                  style={{ backgroundColor: m.color }}
                >
                  {m.initials}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[12px] font-fira text-fe-blue-gray">No members yet</span>
          )}
        </div>

        <p className="mt-4 text-[13px] font-fira text-fe-blue-gray">
          <span className="font-bold text-fe-navy">{role.deliverable_count}</span> active deliverable
          {role.deliverable_count === 1 ? '' : 's'}
        </p>
      </div>
    </Link>
  )
}
