'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Avatar from '@/components/Avatar'
import StatusBadge from '@/components/StatusBadge'
import WorkflowBadge from '@/components/WorkflowBadge'
import ProgressBar from '@/components/ProgressBar'
import { TaskStatus, nextStatus } from '@/lib/types'

interface ProjectTask {
  id: string
  project_id: string
  phase: string
  phase_order: number
  task_name: string
  task_order: number
  due_date: string
  week_number: number
  status: TaskStatus
  owner_ids: string[]
}

interface Project {
  id: string
  name: string
  workflow_type: string
  start_date: string
  current_week: number
  status: string
}

interface TeamMember {
  id: string
  name: string
  initials: string
  color: string
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDate, setEditDate] = useState('')

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${params.id}`).then(r => r.json()),
      fetch('/api/team').then(r => r.json()),
    ]).then(([projectData, teamData]) => {
      setProject(projectData.project)
      setTasks(projectData.tasks || [])
      setTeam(teamData)
      setEditName(projectData.project?.name || '')
      setEditDate(projectData.project?.start_date || '')
      // Expand all phases by default
      const phases = new Set<string>((projectData.tasks || []).map((t: ProjectTask) => t.phase))
      setExpandedPhases(phases)
      setLoading(false)
    })
  }, [params.id])

  const teamMap = new Map(team.map(m => [m.id, m]))

  const togglePhase = (phase: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev)
      if (next.has(phase)) next.delete(phase)
      else next.add(phase)
      return next
    })
  }

  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    await fetch(`/api/projects/${params.id}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
  }

  const saveEdits = async () => {
    await fetch(`/api/projects/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, start_date: editDate }),
    })
    setProject(prev => prev ? { ...prev, name: editName, start_date: editDate } : prev)
    setEditing(false)
  }

  if (loading || !project) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-fe-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const totalTasks = tasks.length
  const doneTasks = tasks.filter(t => t.status === 'done').length
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  // Group tasks by phase (ordered by phase_order)
  const phases = Array.from(
    tasks.reduce((map, task) => {
      if (!map.has(task.phase)) {
        map.set(task.phase, { phase: task.phase, phase_order: task.phase_order, tasks: [] })
      }
      map.get(task.phase)!.tasks.push(task)
      return map
    }, new Map<string, { phase: string; phase_order: number; tasks: ProjectTask[] }>())
  ).map(([, v]) => v)
    .sort((a, b) => a.phase_order - b.phase_order)

  // Sort tasks within each phase
  phases.forEach(p => p.tasks.sort((a, b) => a.task_order - b.task_order))

  return (
    <div>
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-fe-blue-gray hover:text-fe-navy font-fira mb-4 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-fe-blue-gray font-fira mb-1">Project Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs text-fe-blue-gray font-fira mb-1">Start Date</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={e => setEditDate(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={saveEdits}
                    className="px-4 py-2 bg-fe-blue text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-blue/90"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setEditing(false); setEditName(project.name); setEditDate(project.start_date) }}
                    className="px-4 py-2 bg-gray-100 text-fe-anthracite rounded-lg text-sm font-fira hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="font-barlow font-extrabold text-2xl text-fe-navy">{project.name}</h1>
                  <WorkflowBadge type={project.workflow_type} />
                </div>
                <p className="text-sm text-fe-blue-gray font-fira">
                  Started {new Date(project.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </>
            )}
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1.5 text-sm text-fe-blue-gray hover:text-fe-navy border border-gray-200 rounded-lg font-fira hover:bg-gray-50 transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-fira text-fe-blue-gray">Overall Progress</span>
            <span className="text-sm font-fira font-bold text-fe-navy">{progress}%</span>
          </div>
          <ProgressBar percent={progress} size="md" />
          <p className="text-xs text-fe-blue-gray font-fira mt-1">
            {doneTasks} of {totalTasks} tasks complete
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {phases.map(phase => {
          const phaseDone = phase.tasks.filter(t => t.status === 'done').length
          const phaseTotal = phase.tasks.length
          const isExpanded = expandedPhases.has(phase.phase)

          return (
            <div key={phase.phase} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <button
                onClick={() => togglePhase(phase.phase)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <svg
                    className={`w-4 h-4 text-fe-blue-gray transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <h3 className="font-barlow font-bold text-sm text-fe-navy">{phase.phase}</h3>
                </div>
                <span className="text-xs text-fe-blue-gray font-fira">
                  {phaseDone}/{phaseTotal} complete
                </span>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-50">
                  {phase.tasks.map(task => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-b-0 hover:bg-gray-50/50"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex -space-x-1">
                          {task.owner_ids.map(oid => {
                            const member = teamMap.get(oid)
                            return member ? (
                              <Avatar key={oid} initials={member.initials} color={member.color} size="sm" />
                            ) : null
                          })}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-fira text-fe-anthracite truncate">{task.task_name}</p>
                          <p className="text-xs text-gray-400 font-fira">
                            Week {task.week_number} &middot; Due {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <StatusBadge
                        status={task.status}
                        onClick={(newStatus) => updateTaskStatus(task.id, newStatus)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
