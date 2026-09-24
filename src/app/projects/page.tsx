'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import WorkflowBadge from '@/components/WorkflowBadge'
import ProgressBar from '@/components/ProgressBar'
import DuplicateProjectModal from '@/components/DuplicateProjectModal'
import PageHeader from '@/components/PageHeader'
import ProjectArchiveButton from '@/components/ProjectArchiveButton'

interface Project {
  id: string
  name: string
  workflow_type: string
  start_date: string
  current_week: number
  status: string
  total_tasks: number
  done_tasks: number
  progress: number
  owner_ids?: string[]
  workflow_template_id: string
  launch_date?: string | null
}

interface TeamMember {
  id: string
  name: string
  initials: string
  color: string
}

const TOTAL_WEEKS: Record<string, number> = {
  'course-launch': 8,
  'podcast': 2,
  'newsletter': 2,
  'subscription': 12,
}

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [duplicating, setDuplicating] = useState<Project | null>(null)
  const [view, setView] = useState('active')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(() => {
    return Promise.all([
      fetch('/api/projects?status=all', { cache: 'no-store' }).then(async r => {
        const data = await r.json()
        if (!r.ok || !Array.isArray(data)) throw new Error(data.error || 'Could not load projects.')
        return data
      }),
      fetch('/api/team').then(r => r.json()),
    ]).then(([proj, tm]) => {
      if (Array.isArray(proj)) {
        setProjects(proj)
      } else {
        console.error('Unexpected /api/projects response:', proj)
        setProjects([])
      }
      setTeam(Array.isArray(tm) ? tm : [])
      setError('')
    }).catch(err => setError(err.message || 'Could not load projects.'))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    const refresh = () => { load() }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [load])

  const inView = projects.filter(p => view === 'inactive' ? ['paused', 'completed'].includes(p.status) : p.status === view)
  const workflowTypes = [...new Set(inView.map(p => p.workflow_type))]
  const filtered = filter === 'all' ? inView : inView.filter(p => p.workflow_type === filter)
  const onStatusChanged = (project: Project, status: string) => {
    setProjects(rows => rows.map(p => p.id === project.id ? { ...p, status } : p))
    setNotice(`${project.name} ${status === 'archived' ? 'archived. Find it in Archived to restore it.' : 'restored to Active.'}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-fe-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="font-fira">
      <PageHeader
        title="Projects"
        actions={
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-fe-blue text-white text-sm font-fira font-bold hover:bg-fe-blue/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2 mb-3" aria-label="Project views">
        {[
          { value: 'active', label: 'Active' },
          { value: 'archived', label: 'Archived' },
          ...(projects.some(p => ['paused', 'completed'].includes(p.status)) ? [{ value: 'inactive', label: 'Other inactive' }] : []),
        ].map(tab => (
          <button key={tab.value} aria-pressed={view === tab.value}
            onClick={() => { setView(tab.value); setFilter('all') }}
            className={`px-4 py-2 text-sm border ${view === tab.value ? 'bg-fe-navy text-white border-fe-navy' : 'bg-white text-fe-navy border-gray-200'}`}>
            {tab.label} ({projects.filter(p => tab.value === 'inactive' ? ['paused', 'completed'].includes(p.status) : p.status === tab.value).length})
          </button>
        ))}
      </div>
      <p className="text-sm text-fe-blue-gray mb-4">
        {view === 'archived' ? 'Archived projects keep all their tasks and assets. Restore a project to make it active again.' : 'Finishing tasks does not archive a project. Archive it when you are ready to put it away.'}
      </p>
      {notice && <p role="status" className="text-sm text-fe-navy bg-blue-50 p-3 mb-4">{notice}</p>}
      {error && <div role="alert" className="text-sm text-red-700 mb-4">{error} <button onClick={load} className="underline">Retry</button></div>}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-sm font-fira transition-colors ${
            filter === 'all' ? 'bg-fe-navy text-white' : 'bg-white text-fe-anthracite border border-gray-200 hover:bg-gray-50'
          }`}
        >
          All
        </button>
        {workflowTypes.map(type => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-3 py-1.5 text-sm font-fira transition-colors ${
              filter === type ? 'bg-fe-navy text-white' : 'bg-white text-fe-anthracite border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {type === 'course-launch' ? 'Course Launch' : type === 'podcast' ? 'Podcast' : type === 'newsletter' ? 'Newsletter' : 'Subscription'}
          </button>
        ))}
      </div>

      <div className="fe-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' }}>
        {filtered.map(project => (
          <div
            key={project.id}
            className="min-w-0 bg-white border border-gray-100 p-5 hover:shadow-md transition-shadow group relative"
          >
            <Link href={`/projects/${project.id}`} className="block">
              <div className="flex items-start justify-between mb-3">
                <h3 className="min-w-0 break-words font-barlow font-bold text-lg text-fe-navy leading-tight pr-2">{project.name}</h3>
                <WorkflowBadge type={project.workflow_type} />
              </div>
              <p className="text-sm text-fe-blue-gray font-fira mb-4">
                Week {project.current_week} of {TOTAL_WEEKS[project.workflow_type] || '?'}
              </p>
              <ProgressBar percent={project.progress} />
              <p className="text-xs font-fira mt-2 mb-1">
                {project.launch_date ? (
                  <span className="text-fe-anthracite">📅 Launch: {new Date(project.launch_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                ) : (
                  <span className="text-gray-400">📅 No launch date</span>
                )}
              </p>
              <p className="text-xs text-fe-blue-gray font-fira">
                {project.done_tasks} of {project.total_tasks} tasks complete
              </p>
            </Link>
            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
            {project.status !== 'active' && <span className="mr-auto text-xs text-fe-blue-gray capitalize">{project.status}</span>}
            <button
              onClick={() => setDuplicating(project)}
              className="px-3 py-1.5 text-sm text-fe-blue-gray border border-gray-200 hover:bg-gray-50"
              title="Duplicate project"
            >
              Duplicate
            </button>
            <ProjectArchiveButton project={project} onChanged={status => onStatusChanged(project, status)} />
            </div>
          </div>
        ))}
      </div>

      {duplicating && (
        <DuplicateProjectModal
          sourceName={duplicating.name}
          workflowType={duplicating.workflow_type}
          workflowTemplateId={duplicating.workflow_template_id}
          onClose={() => setDuplicating(null)}
          onCreated={(newProject) => {
            setDuplicating(null)
            router.push(`/projects/${newProject.id}`)
          }}
        />
      )}

      {!error && filtered.length === 0 && (
        <div className="text-center py-12 text-fe-blue-gray font-fira">
          {view === 'archived' ? 'No archived projects found.' : 'No projects found.'}
        </div>
      )}
    </div>
  )
}
