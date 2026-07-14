'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'

// Primary destinations shown inline; secondary ones tuck under "More".
const PRIMARY = [
  { href: '/', label: 'Dashboard' },
  { href: '/this-week', label: 'This Week' },
  { href: '/projects', label: 'Projects' },
  { href: '/vendors', label: 'Vendors' },
  { href: '/marketing', label: 'Marketing' },
  { href: '/program-timeline', label: 'Planning' },
  { href: '/team', label: 'Team' },
]

const MORE = [
  { href: '/vendors/library', label: 'Asset Library' },
  { href: '/performance', label: 'Performance' },
  { href: '/weekly-checklist', label: 'Weekly Checklist' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/tasks/bulk-edit', label: 'Bulk Editor' },
]

type SearchResult = {
  id: string
  label: string
  status?: string
  project_name?: string
  workflow_type?: string
  campaign_type?: string
  href: string
}
type SearchResponse = {
  projects: SearchResult[]
  tasks: SearchResult[]
  campaigns: SearchResult[]
}

export default function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    if (href === '/projects')
      return pathname === '/projects' || pathname.startsWith('/projects/') || pathname.startsWith('/tasks/bulk-edit')
    return pathname === href || pathname.startsWith(href + '/')
  }

  const moreActive = MORE.some((m) => isActive(m.href))

  // Close the More dropdown on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Close menus on route change.
  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  const navLinkClass = (href: string) =>
    `px-3 py-2 text-[13px] font-fira whitespace-nowrap transition-colors ${
      isActive(href)
        ? 'text-white font-bold border-b-2 border-fe-blue'
        : 'text-white/70 hover:text-white border-b-2 border-transparent'
    }`

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-fe-navy z-50 flex items-center gap-4 px-6">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 bg-fe-blue flex items-center justify-center">
          <span className="text-white font-barlow font-extrabold text-sm">FE</span>
        </div>
        <div className="hidden xl:block">
          <div className="text-white font-barlow font-bold text-sm leading-tight">Fundamental Edge</div>
          <div className="text-white/50 text-[11px] font-fira">Operations Center</div>
        </div>
      </Link>

      {/* Primary nav */}
      <nav className="flex items-center gap-0.5 flex-1 min-w-0">
        {PRIMARY.map((item) => (
          <Link key={item.href} href={item.href} className={navLinkClass(item.href)}>
            {item.label}
          </Link>
        ))}

        {/* More dropdown */}
        <div className="relative" ref={moreRef}>
          <button
            onClick={() => setMoreOpen((o) => !o)}
            className={`flex items-center gap-1 px-3 py-2 text-[13px] font-fira whitespace-nowrap transition-colors border-b-2 ${
              moreActive || moreOpen
                ? 'text-white font-bold border-fe-blue'
                : 'text-white/70 hover:text-white border-transparent'
            }`}
            data-testid="nav-more"
          >
            More
            <svg
              className={`w-3 h-3 transition-transform ${moreOpen ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {moreOpen && (
            <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-[#E4E7EC] shadow-lg py-1 z-50">
              {MORE.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block px-4 py-2 text-[13px] font-fira transition-colors ${
                    isActive(item.href)
                      ? 'bg-fe-blue text-white'
                      : 'text-fe-navy hover:bg-[#F4F5F7]'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Global search */}
      <GlobalSearch />

      {/* New Project */}
      <Link
        href="/projects/new"
        className="hidden md:flex items-center justify-center gap-2 px-4 py-2 bg-fe-blue text-white text-[13px] font-fira font-bold hover:bg-fe-blue/90 transition-colors shrink-0"
        data-testid="button-new-project"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        New Project
      </Link>
    </header>
  )
}

// ── Global search box + results dropdown ────────────────────────────────────

function GlobalSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  // Debounced fetch.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setResults(data)
      } catch {
        setResults(null)
      } finally {
        setLoading(false)
      }
    }, 220)
    return () => clearTimeout(handle)
  }, [query])

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function go(href: string) {
    setOpen(false)
    setQuery('')
    setResults(null)
    router.push(href)
  }

  const total =
    (results?.projects.length || 0) + (results?.tasks.length || 0) + (results?.campaigns.length || 0)
  const showDropdown = open && query.trim().length >= 2

  return (
    <div className="relative shrink-0 hidden sm:block" ref={boxRef}>
      <div className="flex items-center bg-white/10 focus-within:bg-white/15 transition-colors">
        <svg className="w-4 h-4 text-white/50 ml-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search projects, tasks, campaigns…"
          className="bg-transparent text-white placeholder-white/40 text-[13px] font-fira px-2.5 py-2 w-48 lg:w-64 focus:outline-none"
          data-testid="input-global-search"
        />
      </div>

      {showDropdown && (
        <div className="absolute top-full right-0 mt-1 w-[22rem] max-h-[70vh] overflow-y-auto bg-white border border-[#E4E7EC] shadow-xl z-50">
          {loading && total === 0 && (
            <div className="px-4 py-3 text-[13px] font-fira text-fe-blue-gray">Searching…</div>
          )}
          {!loading && total === 0 && (
            <div className="px-4 py-3 text-[13px] font-fira text-fe-blue-gray">
              No results for “{query.trim()}”
            </div>
          )}
          {results && results.projects.length > 0 && (
            <ResultGroup title="Projects">
              {results.projects.map((r) => (
                <ResultRow key={`p-${r.id}`} onClick={() => go(r.href)} label={r.label} meta={r.workflow_type} testid={`search-project-${r.id}`} />
              ))}
            </ResultGroup>
          )}
          {results && results.tasks.length > 0 && (
            <ResultGroup title="Tasks">
              {results.tasks.map((r) => (
                <ResultRow key={`t-${r.id}`} onClick={() => go(r.href)} label={r.label} meta={r.project_name} testid={`search-task-${r.id}`} />
              ))}
            </ResultGroup>
          )}
          {results && results.campaigns.length > 0 && (
            <ResultGroup title="Campaigns">
              {results.campaigns.map((r) => (
                <ResultRow key={`c-${r.id}`} onClick={() => go(r.href)} label={r.label} meta={r.project_name || r.campaign_type} testid={`search-campaign-${r.id}`} />
              ))}
            </ResultGroup>
          )}
        </div>
      )}
    </div>
  )
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <div className="px-4 pt-2 pb-1 text-[10px] font-barlow font-bold uppercase tracking-wider text-fe-blue-gray">
        {title}
      </div>
      {children}
    </div>
  )
}

function ResultRow({ label, meta, onClick, testid }: { label: string; meta?: string; onClick: () => void; testid: string }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-2 hover:bg-[#F4F5F7] transition-colors flex items-center justify-between gap-3"
      data-testid={testid}
    >
      <span className="text-[13px] font-fira text-fe-navy truncate">{label}</span>
      {meta && <span className="text-[11px] font-fira text-fe-blue-gray whitespace-nowrap shrink-0">{meta}</span>}
    </button>
  )
}
