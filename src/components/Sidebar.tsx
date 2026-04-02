'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const PROJECTS_ROUTES = ['/projects', '/tasks/bulk-edit']

export default function Sidebar() {
  const pathname = usePathname()

  const isProjectsActive = pathname === '/projects' || pathname.startsWith('/projects/') || pathname.startsWith('/tasks/bulk-edit')

  const [projectsOpen, setProjectsOpen] = useState(isProjectsActive)

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/')
  }

  const linkClass = (href: string) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-fira transition-colors ${
      isActive(href)
        ? 'bg-fe-blue text-white'
        : 'text-white/70 hover:text-white hover:bg-white/5'
    }`

  const subLinkClass = (href: string) =>
    `flex items-center gap-2.5 pl-11 pr-3 py-2 rounded-lg text-[13px] font-fira transition-colors ${
      isActive(href)
        ? 'bg-fe-blue text-white'
        : 'text-white/60 hover:text-white hover:bg-white/5'
    }`

  const groupHeaderClass = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-fira transition-colors w-full ${
      active
        ? 'text-white font-bold'
        : 'text-white/70 hover:text-white hover:bg-white/5'
    }`

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-fe-navy flex flex-col z-50">
      <div className="p-6 border-b border-white/10">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-fe-blue flex items-center justify-center">
            <span className="text-white font-barlow font-extrabold text-sm">FE</span>
          </div>
          <div>
            <div className="text-white font-barlow font-bold text-sm leading-tight">Fundamental Edge</div>
            <div className="text-white/50 text-xs font-fira">Operations Center</div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {/* Dashboard */}
        <Link href="/" className={linkClass('/')}>
          <DashboardIcon className="w-5 h-5" />
          Dashboard
        </Link>

        {/* This Week */}
        <Link href="/this-week" className={linkClass('/this-week')}>
          <CalendarIcon className="w-5 h-5" />
          This Week
        </Link>

        {/* Weekly Checklist */}
        <Link href="/weekly-checklist" className={linkClass('/weekly-checklist')}>
          <ChecklistIcon className="w-5 h-5" />
          Weekly Checklist
        </Link>

        {/* Calendar */}
        <Link href="/calendar" className={linkClass('/calendar')}>
          <MonthCalendarIcon className="w-5 h-5" />
          Calendar
        </Link>

        {/* Projects (with Bulk Editor sub-item) */}
        <div>
          <button
            onClick={() => setProjectsOpen(!projectsOpen)}
            className={groupHeaderClass(isProjectsActive)}
          >
            <FolderIcon className="w-5 h-5" />
            <span className="flex-1 text-left">Projects</span>
            <ChevronIcon open={projectsOpen} />
          </button>
          {projectsOpen && (
            <div className="mt-0.5 space-y-0.5">
              <Link href="/projects" className={subLinkClass('/projects')}>
                All Projects
              </Link>
              <Link href="/tasks/bulk-edit" className={subLinkClass('/tasks/bulk-edit')}>
                Bulk Editor
              </Link>
            </div>
          )}
        </div>

        {/* Marketing */}
        <Link href="/marketing" className={linkClass('/marketing')}>
          <MarketingIcon className="w-5 h-5" />
          Marketing
        </Link>

        {/* Planning — direct link to Program Timeline */}
        <Link href="/program-timeline" className={linkClass('/program-timeline')}>
          <PlanningIcon className="w-5 h-5" />
          Planning
        </Link>

        {/* Team */}
        <Link href="/team" className={linkClass('/team')}>
          <TeamIcon className="w-5 h-5" />
          Team
        </Link>

        {/* Performance */}
        <Link href="/performance" className={linkClass('/performance')}>
          <PerformanceIcon className="w-5 h-5" />
          Performance
        </Link>
      </nav>

      <div className="px-3 pb-4">
        <Link
          href="/projects/new"
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-fe-blue text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-blue/90 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </Link>
      </div>

      <div className="px-6 py-4 border-t border-white/10">
        <p className="text-white/30 text-xs font-fira">Operations Center v1</p>
      </div>
    </aside>
  )
}

// ── Icons ───────────────────────────────────────────────────────────────────

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 text-white/40 transition-transform ${open ? 'rotate-90' : ''}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zm0 6a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1v-5zM4 13a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2z" />
    </svg>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function MonthCalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4h18v18H3V4zm0 6h18M9 4v2m6-2v2m-9 6h2m4 0h2m4 0h2m-14 4h2m4 0h2m4 0h2" />
    </svg>
  )
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  )
}

function TeamIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}

function MarketingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l4-2 5 3 5-3 4 2v8l-4 2-5-3-5 3-4-2V8zm4-2v8m10-5v8" />
    </svg>
  )
}

function PerformanceIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function PlanningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function ChecklistIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  )
}
