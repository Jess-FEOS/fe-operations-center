'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Avatar from '@/components/Avatar'
import WorkflowBadge from '@/components/WorkflowBadge'
import ProgressBar from '@/components/ProgressBar'

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
  const [projects, setProjects] = useState<Project[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    Promise.all([
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/team').then(r => r.json()),
    ]).then(([proj, tm]) => {
      setProjects(proj)
      setTeam(tm)
      setLoading(false)
    })
  }, [])

  const workflowTypes = [...new Set(projects.map(p => p.workflow_type))]
  const filtered = filter === 'all' ? projects : projects.filter(p => p.workflow_type === filter)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-fe-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-barlow font-extrabold text-2xl text-fe-navy">Projects</h1>
        <Link
          href="/projects/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-fe-blue text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-blue/90 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </Link>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-fira transition-colors ${
            filter === 'all' ? 'bg-fe-navy text-white' : 'bg-white text-fe-anthracite border border-gray-200 hover:bg-gray-50'
          }`}
        >
          All
        </button>
        {workflowTypes.map(type => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-3 py-1.5 rounded-lg text-sm font-fira transition-colors ${
              filter === type ? 'bg-fe-navy text-white' : 'bg-white text-fe-anthracite border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {type === 'course-launch' ? 'Course Launch' : type === 'podcast' ? 'Podcast' : type === 'newsletter' ? 'Newsletter' : 'Subscription'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map(project => (
          <Link
            key={project.id}
            href={`/projects/${project.id}`}
            className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-barlow font-bold text-lg text-fe-navy leading-tight pr-2">{project.name}</h3>
              <WorkflowBadge type={project.workflow_type} />
            </div>
            <p className="text-sm text-fe-blue-gray font-fira mb-4">
              Week {project.current_week} of {TOTAL_WEEKS[project.workflow_type] || '?'}
            </p>
            <ProgressBar percent={project.progress} />
            <p className="text-xs text-fe-blue-gray font-fira mt-2">
              {project.done_tasks} of {project.total_tasks} tasks complete
            </p>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-fe-blue-gray font-fira">
          No projects found.
        </div>
      )}
    </div>
  )
}
