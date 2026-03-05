'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import WorkflowBadge from '@/components/WorkflowBadge'
import ProgressBar from '@/components/ProgressBar'
import DuplicateProjectModal from '@/components/DuplicateProjectModal'
import Avatar from '@/components/Avatar'

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
}

interface TeamMember {
  id: string
  name: string
  initials: string
  color: string
}

interface OverdueTask {
  id: string
  task_name: string
  due_date: string
  project_id: string
  project_name: string
  owner_ids: string[]
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
  const [overdueTasks, setOverdueTasks] = useState<OverdueTask[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/team').then(r => r.json()),
      fetch('/api/tasks/overdue').then(r => r.json()),
    ]).then(([proj, tm, overdue]) => {
      setProjects(proj)
      setTeam(tm)
      setOverdueTasks(Array.isArray(overdue) ? overdue : [])
      setLoading(false)
    })
  }, [])

  const teamMap = new Map(team.map(m => [m.id, m]))
  const workflowTypes = [...new Set(projects.map(p => p.workflow_type))]
  const filtered = filter === 'all' ? projects : projects.filter(p => p.workflow_type === filter)

  const daysOverdue = (dueDate: string) => {
    const due = new Date(dueDate + 'T00:00:00')
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
  }

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

      {overdueTasks.length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-2.99L13.73 4.01c-.77-1.33-2.69-1.33-3.46 0L3.34 16.01C2.57 17.33 3.53 19 5.07 19z" />
            </svg>
            <h2 className="font-barlow font-bold text-red-700 text-sm">
              {overdueTasks.length} Overdue Task{overdueTasks.length !== 1 ? 's' : ''}
            </h2>
          </div>
          <div className="space-y-2">
            {overdueTasks.map(task => {
              const days = daysOverdue(task.due_date)
              return (
                <Link
                  key={task.id}
                  href={`/projects/${task.project_id}`}
                  className="flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-red-100 hover:border-red-300 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex -space-x-1 shrink-0">
                      {task.owner_ids?.map(oid => {
                        const member = teamMap.get(oid)
                        return member ? (
                          <Avatar key={oid} initials={member.initials} color={member.color} size="sm" />
                        ) : null
                      })}
                      {(!task.owner_ids || task.owner_ids.length === 0) && (
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                          <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-fira text-fe-anthracite truncate group-hover:text-fe-navy transition-colors">
                        {task.task_name}
                      </p>
                      <p className="text-xs font-fira text-gray-400 truncate">
                        {task.project_name}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 ml-3 px-2 py-0.5 rounded-full text-xs font-fira font-bold bg-red-100 text-red-600">
                    {days}d overdue
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

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
          <div
            key={project.id}
            className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow group relative"
          >
            <Link href={`/projects/${project.id}`} className="block">
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
            <button
              onClick={() => setDuplicating(project)}
              className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-1.5 text-fe-blue-gray hover:text-fe-navy bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-all"
              title="Duplicate project"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
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

      {filtered.length === 0 && (
        <div className="text-center py-12 text-fe-blue-gray font-fira">
          No projects found.
        </div>
      )}
    </div>
  )
}
