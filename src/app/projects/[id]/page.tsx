'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Avatar from '@/components/Avatar'
import StatusBadge from '@/components/StatusBadge'
import WorkflowBadge from '@/components/WorkflowBadge'
import ProgressBar from '@/components/ProgressBar'
import { TaskStatus, nextStatus, WORKFLOW_COLORS } from '@/lib/types'
import DuplicateProjectModal from '@/components/DuplicateProjectModal'

interface WorkflowTemplate {
  id: string
  name: string
  slug: string
  color: string
  total_weeks: number
}

const WORKFLOW_LABELS: Record<string, string> = {
  'course-launch': 'Course Launch',
  'podcast': 'Podcast',
  'newsletter': 'Newsletter',
  'subscription': 'Subscription Buildout',
}

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
  workflow_template_id: string
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
  const [showDuplicate, setShowDuplicate] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplate[]>([])
  const [showWorkflowDropdown, setShowWorkflowDropdown] = useState(false)
  const [pendingWorkflow, setPendingWorkflow] = useState<WorkflowTemplate | null>(null)
  const [switchingWorkflow, setSwitchingWorkflow] = useState(false)
  const [bulkMenuPhase, setBulkMenuPhase] = useState<string | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingTaskName, setEditingTaskName] = useState('')
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null)
  const [addingToPhase, setAddingToPhase] = useState<string | null>(null)
  const [newTaskName, setNewTaskName] = useState('')
  const [newTaskOwner, setNewTaskOwner] = useState('')
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false)
  const bulkMenuRef = useRef<HTMLDivElement>(null)
  const workflowDropdownRef = useRef<HTMLDivElement>(null)
  const ownerDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (bulkMenuRef.current && !bulkMenuRef.current.contains(e.target as Node)) {
        setBulkMenuPhase(null)
      }
      if (workflowDropdownRef.current && !workflowDropdownRef.current.contains(e.target as Node)) {
        setShowWorkflowDropdown(false)
      }
      if (ownerDropdownRef.current && !ownerDropdownRef.current.contains(e.target as Node)) {
        setShowOwnerDropdown(false)
      }
    }
    if (bulkMenuPhase || showWorkflowDropdown || showOwnerDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [bulkMenuPhase, showWorkflowDropdown, showOwnerDropdown])

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${params.id}`).then(r => r.json()),
      fetch('/api/team').then(r => r.json()),
      fetch('/api/workflow-templates').then(r => r.json()),
    ]).then(([projectData, teamData, templates]) => {
      setProject(projectData.project)
      setTasks(projectData.tasks || [])
      setTeam(teamData)
      setEditName(projectData.project?.name || '')
      setEditDate(projectData.project?.start_date || '')
      setWorkflowTemplates(templates)
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

  const bulkUpdatePhase = async (phase: string, newStatus: TaskStatus) => {
    const phaseTasks = tasks.filter(t => t.phase === phase)
    await Promise.all(
      phaseTasks.map(t =>
        fetch(`/api/projects/${params.id}/tasks/${t.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        })
      )
    )
    setTasks(prev => prev.map(t => t.phase === phase ? { ...t, status: newStatus } : t))
    setBulkMenuPhase(null)
  }

  const confirmWorkflowSwitch = async () => {
    if (!pendingWorkflow) return
    setSwitchingWorkflow(true)
    const res = await fetch(`/api/projects/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflow_type: pendingWorkflow.slug,
        workflow_template_id: pendingWorkflow.id,
      }),
    })
    const data = await res.json()
    setProject(data.project)
    setTasks(data.tasks || [])
    const phases = new Set<string>((data.tasks || []).map((t: ProjectTask) => t.phase))
    setExpandedPhases(phases)
    setSwitchingWorkflow(false)
    setPendingWorkflow(null)
  }

  const deleteProject = async () => {
    setDeleting(true)
    await fetch(`/api/projects/${params.id}`, { method: 'DELETE' })
    router.push('/projects')
  }

  const renameTask = async (taskId: string) => {
    if (!editingTaskName.trim()) return
    await fetch(`/api/projects/${params.id}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_name: editingTaskName.trim() }),
    })
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, task_name: editingTaskName.trim() } : t))
    setEditingTaskId(null)
  }

  const deleteTask = async (taskId: string) => {
    await fetch(`/api/projects/${params.id}/tasks/${taskId}`, { method: 'DELETE' })
    setTasks(prev => prev.filter(t => t.id !== taskId))
    setDeletingTaskId(null)
  }

  const addTask = async (phase: string, phaseOrder: number) => {
    if (!newTaskName.trim()) return
    const res = await fetch(`/api/projects/${params.id}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_name: newTaskName.trim(),
        phase,
        phase_order: phaseOrder,
        owner_ids: newTaskOwner ? [newTaskOwner] : [],
      }),
    })
    const newTask = await res.json()
    if (res.ok) {
      setTasks(prev => [...prev, newTask])
      setNewTaskName('')
      setNewTaskOwner('')
      setAddingToPhase(null)
    }
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
                  <div className="relative" ref={workflowDropdownRef}>
                    <button
                      onClick={() => setShowWorkflowDropdown(!showWorkflowDropdown)}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-fira font-bold text-white cursor-pointer hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: WORKFLOW_COLORS[project.workflow_type] || '#647692' }}
                    >
                      {WORKFLOW_LABELS[project.workflow_type] || project.workflow_type}
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showWorkflowDropdown && (
                      <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[180px]">
                        {workflowTemplates.map(tmpl => (
                          <button
                            key={tmpl.id}
                            disabled={tmpl.slug === project.workflow_type}
                            onClick={() => {
                              setShowWorkflowDropdown(false)
                              setPendingWorkflow(tmpl)
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-fira hover:bg-gray-50 text-fe-anthracite flex items-center gap-2 disabled:opacity-40 disabled:cursor-default"
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: tmpl.color }}
                            />
                            {WORKFLOW_LABELS[tmpl.slug] || tmpl.name}
                            {tmpl.slug === project.workflow_type && (
                              <svg className="w-3 h-3 ml-auto text-fe-blue-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-sm text-fe-blue-gray font-fira">
                  Started {new Date(project.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </>
            )}
          </div>
          {!editing && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-1.5 text-sm text-red-400 hover:text-red-600 border border-gray-200 rounded-lg font-fira hover:bg-red-50 hover:border-red-200 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setShowDuplicate(true)}
                className="px-3 py-1.5 text-sm text-fe-blue-gray hover:text-fe-navy border border-gray-200 rounded-lg font-fira hover:bg-gray-50 transition-colors"
              >
                Duplicate
              </button>
              <button
                onClick={() => setEditing(true)}
                className="px-3 py-1.5 text-sm text-fe-blue-gray hover:text-fe-navy border border-gray-200 rounded-lg font-fira hover:bg-gray-50 transition-colors"
              >
                Edit
              </button>
            </div>
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
              <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                <button
                  onClick={() => togglePhase(phase.phase)}
                  className="flex items-center gap-3 flex-1 text-left"
                >
                  <svg
                    className={`w-4 h-4 text-fe-blue-gray transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <h3 className="font-barlow font-bold text-sm text-fe-navy">{phase.phase}</h3>
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-fe-blue-gray font-fira">
                    {phaseDone}/{phaseTotal} complete
                  </span>
                  <div className="relative" ref={bulkMenuPhase === phase.phase ? bulkMenuRef : undefined}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setBulkMenuPhase(bulkMenuPhase === phase.phase ? null : phase.phase)
                      }}
                      className="px-2 py-1 text-xs font-fira text-fe-blue-gray border border-gray-200 rounded-md hover:bg-gray-100 hover:text-fe-navy transition-colors"
                    >
                      Set All ▾
                    </button>
                    {bulkMenuPhase === phase.phase && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[140px]">
                        <button
                          onClick={() => bulkUpdatePhase(phase.phase, 'done')}
                          className="w-full text-left px-3 py-2 text-xs font-fira hover:bg-gray-50 text-fe-anthracite flex items-center gap-2"
                        >
                          <span className="w-2 h-2 rounded-full bg-[#046A38]" />
                          Done
                        </button>
                        <button
                          onClick={() => bulkUpdatePhase(phase.phase, 'in_progress')}
                          className="w-full text-left px-3 py-2 text-xs font-fira hover:bg-gray-50 text-fe-anthracite flex items-center gap-2"
                        >
                          <span className="w-2 h-2 rounded-full bg-[#0762C8]" />
                          In Progress
                        </button>
                        <button
                          onClick={() => bulkUpdatePhase(phase.phase, 'not_started')}
                          className="w-full text-left px-3 py-2 text-xs font-fira hover:bg-gray-50 text-fe-anthracite flex items-center gap-2"
                        >
                          <span className="w-2 h-2 rounded-full bg-[#9CA3AF]" />
                          Not Started
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-50">
                  {phase.tasks.map(task => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-b-0 hover:bg-gray-50/50 group/task"
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
                        <div className="min-w-0 flex-1">
                          {editingTaskId === task.id ? (
                            <form
                              onSubmit={e => { e.preventDefault(); renameTask(task.id) }}
                              className="flex items-center gap-2"
                            >
                              <input
                                type="text"
                                value={editingTaskName}
                                onChange={e => setEditingTaskName(e.target.value)}
                                className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
                                autoFocus
                                onKeyDown={e => { if (e.key === 'Escape') setEditingTaskId(null) }}
                              />
                              <button type="submit" className="text-fe-blue hover:text-fe-blue/80">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button type="button" onClick={() => setEditingTaskId(null)} className="text-gray-400 hover:text-gray-600">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </form>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-fira text-fe-anthracite truncate">{task.task_name}</p>
                              <button
                                onClick={() => { setEditingTaskId(task.id); setEditingTaskName(task.task_name) }}
                                className="opacity-0 group-hover/task:opacity-100 text-gray-400 hover:text-fe-navy transition-opacity shrink-0"
                                title="Rename task"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setDeletingTaskId(task.id)}
                                className="opacity-0 group-hover/task:opacity-100 text-gray-400 hover:text-red-500 transition-opacity shrink-0"
                                title="Delete task"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          )}
                          {editingTaskId !== task.id && (
                            <p className="text-xs text-gray-400 font-fira">
                              Week {task.week_number} &middot; Due {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                          )}
                        </div>
                      </div>
                      {editingTaskId !== task.id && (
                        <StatusBadge
                          status={task.status}
                          onClick={(newStatus) => updateTaskStatus(task.id, newStatus)}
                        />
                      )}
                    </div>
                  ))}

                  {addingToPhase === phase.phase ? (
                    <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newTaskName}
                          onChange={e => setNewTaskName(e.target.value)}
                          placeholder="Task name"
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Escape') { setAddingToPhase(null); setNewTaskName(''); setNewTaskOwner('') }
                            if (e.key === 'Enter' && newTaskName.trim()) addTask(phase.phase, phase.phase_order)
                          }}
                        />
                        <div className="relative" ref={showOwnerDropdown ? ownerDropdownRef : undefined}>
                          <button
                            onClick={() => setShowOwnerDropdown(!showOwnerDropdown)}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira text-fe-blue-gray hover:bg-gray-100 transition-colors flex items-center gap-1 whitespace-nowrap"
                          >
                            {newTaskOwner ? (
                              <Avatar initials={teamMap.get(newTaskOwner)?.initials || '?'} color={teamMap.get(newTaskOwner)?.color || '#999'} size="sm" />
                            ) : 'Owner'}
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {showOwnerDropdown && (
                            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[160px]">
                              <button
                                onClick={() => { setNewTaskOwner(''); setShowOwnerDropdown(false) }}
                                className="w-full text-left px-3 py-2 text-xs font-fira hover:bg-gray-50 text-gray-400"
                              >
                                No owner
                              </button>
                              {team.map(m => (
                                <button
                                  key={m.id}
                                  onClick={() => { setNewTaskOwner(m.id); setShowOwnerDropdown(false) }}
                                  className="w-full text-left px-3 py-2 text-xs font-fira hover:bg-gray-50 text-fe-anthracite flex items-center gap-2"
                                >
                                  <Avatar initials={m.initials} color={m.color} size="sm" />
                                  {m.name}
                                  {newTaskOwner === m.id && (
                                    <svg className="w-3 h-3 ml-auto text-fe-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => addTask(phase.phase, phase.phase_order)}
                          disabled={!newTaskName.trim()}
                          className="px-3 py-1.5 bg-fe-blue text-white rounded-lg text-xs font-fira font-bold hover:bg-fe-blue/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Add Task
                        </button>
                        <button
                          onClick={() => { setAddingToPhase(null); setNewTaskName(''); setNewTaskOwner(''); setShowOwnerDropdown(false) }}
                          className="px-3 py-1.5 bg-gray-100 text-fe-anthracite rounded-lg text-xs font-fira hover:bg-gray-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setAddingToPhase(phase.phase); setNewTaskName(''); setNewTaskOwner('') }}
                      className="w-full px-4 py-2.5 text-xs font-fira text-fe-blue-gray hover:text-fe-navy hover:bg-gray-50 transition-colors flex items-center gap-1.5 border-t border-gray-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Task
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showDuplicate && project && (
        <DuplicateProjectModal
          sourceName={project.name}
          workflowType={project.workflow_type}
          workflowTemplateId={project.workflow_template_id}
          onClose={() => setShowDuplicate(false)}
          onCreated={(newProject) => {
            setShowDuplicate(false)
            router.push(`/projects/${newProject.id}`)
          }}
        />
      )}

      {showDeleteConfirm && project && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(false)}>
          <div
            className="bg-white rounded-xl border border-gray-100 shadow-xl w-full max-w-md mx-4 p-6"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="font-barlow font-bold text-lg text-fe-navy mb-3">Delete Project</h2>
            <p className="text-sm text-fe-anthracite font-fira mb-6">
              Are you sure you want to delete <span className="font-bold">{project.name}</span>? This will permanently delete all tasks associated with this project.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2.5 bg-gray-100 text-fe-anthracite rounded-lg text-sm font-fira hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteProject}
                disabled={deleting}
                className="flex-1 px-6 py-2.5 bg-red-600 text-white rounded-lg text-sm font-fira font-bold hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {deleting ? 'Deleting...' : 'Delete Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingWorkflow && project && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setPendingWorkflow(null)}>
          <div
            className="bg-white rounded-xl border border-gray-100 shadow-xl w-full max-w-md mx-4 p-6"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="font-barlow font-bold text-lg text-fe-navy mb-3">Change Workflow Type</h2>
            <p className="text-sm text-fe-anthracite font-fira mb-2">
              Switch from <span className="font-bold">{WORKFLOW_LABELS[project.workflow_type] || project.workflow_type}</span> to <span className="font-bold">{WORKFLOW_LABELS[pendingWorkflow.slug] || pendingWorkflow.name}</span>?
            </p>
            <p className="text-sm text-red-600 font-fira mb-6">
              All current tasks will be deleted and replaced with the new workflow&apos;s tasks. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingWorkflow(null)}
                className="px-4 py-2.5 bg-gray-100 text-fe-anthracite rounded-lg text-sm font-fira hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmWorkflowSwitch}
                disabled={switchingWorkflow}
                className="flex-1 px-6 py-2.5 bg-fe-blue text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-blue/90 transition-colors disabled:opacity-60"
              >
                {switchingWorkflow ? 'Switching...' : 'Switch Workflow'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingTaskId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setDeletingTaskId(null)}>
          <div
            className="bg-white rounded-xl border border-gray-100 shadow-xl w-full max-w-sm mx-4 p-6"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="font-barlow font-bold text-lg text-fe-navy mb-3">Delete Task</h2>
            <p className="text-sm text-fe-anthracite font-fira mb-6">
              Are you sure you want to delete <span className="font-bold">{tasks.find(t => t.id === deletingTaskId)?.task_name}</span>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingTaskId(null)}
                className="px-4 py-2.5 bg-gray-100 text-fe-anthracite rounded-lg text-sm font-fira hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteTask(deletingTaskId)}
                className="flex-1 px-6 py-2.5 bg-red-600 text-white rounded-lg text-sm font-fira font-bold hover:bg-red-700 transition-colors"
              >
                Delete Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
